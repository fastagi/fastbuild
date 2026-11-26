#!/usr/bin/env python3
"""Run the narrowest checks that cover the files changed in this working tree.

Changed files are everything that differs from the base branch (default ``main``), plus staged,
unstaged, and untracked work. Each changed area selects its own checks:

  api/                     derived-artifact check, ``go vet ./...``, the architecture analyzers,
                           lint and ``go test -short`` on the changed packages, and the route
                           catalog when routes changed
  packages/contracts/,     the contract gate, plus a type-check of both browser apps when the
  packages/contract-types/ generated types changed
  apps/web, apps/admin     type-check, lint, and the tests related to the changed files
  apps/desktop, mobile     type-check and tests
  packages/<name>/         that package's own tests
  any code or tooling      the governance gate (it includes the guidance checks)
  guidance only            the changed-file guidance check

Markdown and ``.agents/`` files never select a unit's build or test checks.

This is the inner loop, not the release gate: it does not run the tests of packages that merely
depend on a changed package. ``make check`` remains the full gate.

  verify_changed.py            run the selected checks
  verify_changed.py --list     print the selected checks without running them
  verify_changed.py --json     print a machine-readable summary on stdout (progress goes to stderr)
  verify_changed.py --base=REF compare against REF instead of main
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
LOG_TAIL_LINES = 60

BROWSER_APPS = ("apps/web", "apps/admin")
NATIVE_APPS = ("apps/desktop", "apps/mobile")
TESTED_PACKAGES = ("packages/ui", "packages/core", "packages/api-client", "packages/tokens")
ROUTE_FILE_NAMES = ("routes.go", "handler.go")
GUIDANCE_SUFFIXES = (".md", ".mdc")


@dataclass
class Step:
    label: str
    command: list[str]
    cwd: str = "."
    status: str = "pending"
    seconds: float = 0.0
    tail: list[str] = field(default_factory=list)


def git_lines(*args: str) -> list[str]:
    result = subprocess.run(
        ["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        sys.exit(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return [line for line in result.stdout.splitlines() if line]


def changed_files(base: str) -> list[str]:
    if subprocess.run(
        ["git", "rev-parse", "--verify", "--quiet", f"{base}^{{commit}}"],
        cwd=REPO_ROOT,
        capture_output=True,
        check=False,
    ).returncode != 0:
        sys.exit(f"unknown base ref: {base}")
    files: set[str] = set()
    files.update(git_lines("diff", "--name-only", f"{base}...HEAD"))
    files.update(git_lines("diff", "--name-only", "--cached"))
    files.update(git_lines("diff", "--name-only"))
    files.update(git_lines("ls-files", "--others", "--exclude-standard"))
    return sorted(files)


def under(path: str, prefix: str) -> bool:
    return path == prefix or path.startswith(prefix + "/")


def go_packages(api_files: list[str]) -> list[str]:
    """Return the existing package directories that own the changed Go files."""
    packages: set[str] = set()
    for path in api_files:
        if not path.endswith(".go"):
            continue
        directory = Path(path).parent
        if (REPO_ROOT / directory).is_dir():
            relative = directory.relative_to("api").as_posix()
            packages.add("./" + relative if relative != "." else ".")
    return sorted(packages)


def pnpm() -> list[str]:
    return ["corepack", "pnpm"] if shutil.which("corepack") else ["pnpm"]


def has_script(app: str, script: str) -> bool:
    manifest = REPO_ROOT / app / "package.json"
    if not manifest.is_file():
        return False
    return script in json.loads(manifest.read_text(encoding="utf-8")).get("scripts", {})


def is_guidance(path: str) -> bool:
    return path.endswith(GUIDANCE_SUFFIXES) or "/.agents/" in f"/{path}"


def plan(files: list[str]) -> list[Step]:
    steps: list[Step] = []
    all_files = files
    # Guidance inside a unit does not change what that unit builds or tests.
    files = [path for path in files if not is_guidance(path)]

    api_files = [path for path in files if under(path, "api")]
    if api_files:
        steps.append(Step("derived artifacts are current", ["bash", "tools/dev/sync.sh", "--check"]))
        steps.append(Step("go vet ./...", ["go", "vet", "./..."], "api"))
        steps.append(Step("architecture analyzers", ["make", "archlint"], "api"))
        packages = go_packages(api_files)
        whole_tree = any(Path(path).name in ("go.mod", "go.sum") for path in api_files)
        scope = ["./..."] if whole_tree else packages
        if scope:
            if shutil.which("golangci-lint"):
                steps.append(
                    Step(
                        f"golangci-lint ({len(scope)} package(s))",
                        ["golangci-lint", "run", "--timeout=2m", *scope],
                        "api",
                    )
                )
            steps.append(
                Step(f"go test -short ({len(scope)} package(s))", ["go", "test", "-short", *scope], "api")
            )
        if any(Path(path).name in ROUTE_FILE_NAMES for path in api_files):
            steps.append(Step("route catalog matches the contract", ["make", "route-catalog-check"], "api"))

    # The generated types change only with the contract, and both browser apps compile against them.
    contract_files = [
        path
        for path in files
        if under(path, "packages/contracts") or under(path, "packages/contract-types")
    ]
    if contract_files:
        steps.append(Step("contract gate", ["make", "contract-check"]))
        if not any(step.label.startswith("route catalog") for step in steps):
            steps.append(Step("route catalog matches the contract", ["make", "route-catalog-check"], "api"))

    for app in BROWSER_APPS:
        app_files = [path for path in files if under(path, app)]
        if not app_files:
            if any(under(path, "packages/contract-types") for path in files):
                steps.append(Step(f"{app} type-check", [*pnpm(), "type-check"], app))
            continue
        steps.append(Step(f"{app} type-check", [*pnpm(), "type-check"], app))
        steps.append(Step(f"{app} lint", [*pnpm(), "lint"], app))
        sources = [
            Path(path).relative_to(app).as_posix()
            for path in app_files
            if under(path, f"{app}/src") and (REPO_ROOT / path).is_file()
        ]
        if sources and len(sources) == len(app_files):
            steps.append(
                Step(
                    f"{app} related tests ({len(sources)} file(s))",
                    [*pnpm(), "vitest", "related", "--run", "--passWithNoTests", *sources],
                    app,
                )
            )
        else:
            # A configuration, dependency, or deleted file can affect any test.
            steps.append(Step(f"{app} tests", [*pnpm(), "test", "--", "--run"], app))

    for app in NATIVE_APPS:
        app_files = [path for path in files if under(path, app)]
        if not app_files:
            continue
        steps.append(Step(f"{app} type-check", [*pnpm(), "type-check"], app))
        if has_script(app, "test"):
            steps.append(Step(f"{app} tests", [*pnpm(), "test"], app))

    for package in TESTED_PACKAGES:
        package_files = [path for path in files if under(path, package)]
        if not package_files:
            continue
        if has_script(package, "test"):
            steps.append(Step(f"{package} tests", [*pnpm(), "test"], package))

    if all_files and not files:
        steps.append(Step("changed guidance", ["make", "agent-check-changed"]))
    elif files:
        # Boundary guards read across units, so any code or tooling change runs all of them.
        steps.append(Step("governance", ["make", "governance"]))
    return steps


def run(step: Step) -> None:
    started = time.monotonic()
    result = subprocess.run(
        step.command,
        cwd=REPO_ROOT / step.cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
        env={**os.environ, "CI": os.environ.get("CI", "true")},
    )
    step.seconds = round(time.monotonic() - started, 1)
    step.status = "passed" if result.returncode == 0 else "failed"
    if result.returncode != 0:
        step.tail = result.stdout.splitlines()[-LOG_TAIL_LINES:]


def main(argv: list[str]) -> int:
    base = os.environ.get("VERIFY_BASE_REF", "main")
    as_json = list_only = False
    for argument in argv:
        if argument == "--json":
            as_json = True
        elif argument == "--list":
            list_only = True
        elif argument.startswith("--base="):
            base = argument.split("=", 1)[1]
        else:
            print(__doc__, file=sys.stderr)
            return 2

    files = changed_files(base)
    steps = plan(files)
    progress = sys.stderr if as_json else sys.stdout

    print(f"Verify changed: {len(files)} file(s) against {base}, {len(steps)} check(s)", file=progress)
    if not list_only:
        for step in steps:
            run(step)
            mark = "ok  " if step.status == "passed" else "FAIL"
            print(f"  {mark}  {step.label}  ({step.seconds}s)", file=progress, flush=True)
            if step.status == "failed":
                print(f"        command: (cd {step.cwd} && {' '.join(step.command)})", file=progress)
                for line in step.tail:
                    print(f"        {line}", file=progress)
    else:
        for step in steps:
            print(f"  (cd {step.cwd} && {' '.join(step.command)})", file=progress)

    failed = [step for step in steps if step.status == "failed"]
    if as_json:
        print(
            json.dumps(
                {
                    "base": base,
                    "changed_files": files,
                    "passed": not failed and not list_only,
                    "seconds": round(sum(step.seconds for step in steps), 1),
                    "checks": [
                        {
                            "label": step.label,
                            "cwd": step.cwd,
                            "command": step.command,
                            "status": step.status,
                            "seconds": step.seconds,
                            "output_tail": step.tail,
                        }
                        for step in steps
                    ],
                },
                indent=2,
            )
        )
    if list_only:
        return 0
    if failed:
        print(f"{len(failed)} check(s) failed.", file=progress)
        return 1
    print("All selected checks passed. Full gate before a release: make check", file=progress)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
