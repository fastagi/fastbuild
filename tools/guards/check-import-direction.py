#!/usr/bin/env python3

"""Enforce FastBuild monorepo import direction, platform neutrality, and acyclic packages.

Rules enforced:
1. `apps/<A>` never imports `apps/<B>`.
2. `packages/*` never imports `apps/*`.
3. Platform-neutral packages (`packages/tokens`, `packages/core`, `packages/api-client`)
   never import `react-dom`, `next`, `next/*`, `electron`, or `react-native` (`react-native/*`).
4. `packages/*` dependency graph has no cycles (checked via both `package.json` and source imports).
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APPS_DIR = ROOT / "apps"
PACKAGES_DIR = ROOT / "packages"

SKIP_DIRS = {
    ".git",
    ".next",
    ".turbo",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "out",
    "storybook-static",
}

SOURCE_EXTS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"}

PLATFORM_NEUTRAL_PACKAGES = {"tokens", "core", "api-client"}

FORBIDDEN_NEUTRAL_PREFIXES = (
    "react-dom",
    "next",
    "electron",
    "react-native",
)

IMPORT_RE = re.compile(
    r"""(?mx)
    (?:
        \b(?:import|export)\s+(?:type\s+)?(?:[^'"`]*?\s+from\s+)?['"]([^'"]+)['"]
        |
        \bimport\s*\(\s*['"]([^'"]+)['"]\s*\)
        |
        \brequire\s*\(\s*['"]([^'"]+)['"]\s*\)
    )
    """
)


def iter_source_files(base: Path) -> list[Path]:
    if not base.exists():
        return []
    files: list[Path] = []
    for path in sorted(base.rglob("*")):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.is_file() and path.suffix in SOURCE_EXTS:
            files.append(path)
    return files


def extract_specifiers(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    # Strip single-line and multi-line comments to avoid false positives in docstrings.
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"(?m)//.*$", "", text)
    specifiers: list[str] = []
    for match in IMPORT_RE.finditer(text):
        spec = match.group(1) or match.group(2) or match.group(3)
        if spec:
            specifiers.append(spec)
    return specifiers


def read_package_json(directory: Path) -> dict[str, object]:
    pkg_json = directory / "package.json"
    if not pkg_json.is_file():
        return {}
    try:
        data = json.loads(pkg_json.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def is_forbidden_neutral_spec(spec: str) -> bool:
    for prefix in FORBIDDEN_NEUTRAL_PREFIXES:
        if spec == prefix or spec.startswith(f"{prefix}/"):
            return True
    return False


def resolve_relative_target(source_file: Path, spec: str) -> Path | None:
    if not spec.startswith("."):
        return None
    try:
        return (source_file.parent / spec).resolve()
    except OSError:
        return None


def find_cycles(graph: dict[str, set[str]]) -> list[list[str]]:
    visited: set[str] = set()
    visiting: set[str] = set()
    stack: list[str] = []
    cycles: list[list[str]] = []

    def dfs(node: str) -> None:
        visiting.add(node)
        stack.append(node)
        for neighbor in sorted(graph.get(node, ())):
            if neighbor not in graph:
                continue
            if neighbor in visiting:
                idx = stack.index(neighbor)
                cycles.append(stack[idx:] + [neighbor])
            elif neighbor not in visited:
                dfs(neighbor)
        stack.pop()
        visiting.remove(node)
        visited.add(node)

    for node in sorted(graph):
        if node not in visited:
            dfs(node)
    return cycles


def main() -> int:
    failures: list[str] = []

    # Discover apps and their package names.
    app_dirs: dict[str, Path] = {}
    app_pkg_names: dict[str, str] = {}
    if APPS_DIR.is_dir():
        for entry in sorted(APPS_DIR.iterdir()):
            if entry.is_dir() and not entry.name.startswith("."):
                app_dirs[entry.name] = entry.resolve()
                pkg = read_package_json(entry)
                name = pkg.get("name")
                if isinstance(name, str) and name:
                    app_pkg_names[name] = entry.name

    # Discover packages and their package names.
    pkg_dirs: dict[str, Path] = {}
    pkg_name_to_dir: dict[str, str] = {}
    if PACKAGES_DIR.is_dir():
        for entry in sorted(PACKAGES_DIR.iterdir()):
            if entry.is_dir() and not entry.name.startswith("."):
                pkg_dirs[entry.name] = entry.resolve()
                pkg = read_package_json(entry)
                name = pkg.get("name")
                if isinstance(name, str) and name:
                    pkg_name_to_dir[name] = entry.name

    # Rule 1: apps/<A> never imports apps/<B>.
    for app_name, app_path in app_dirs.items():
        pkg = read_package_json(app_path)
        for dep_section in ("dependencies", "devDependencies", "peerDependencies"):
            deps = pkg.get(dep_section)
            if isinstance(deps, dict):
                for dep_name in deps:
                    target_app = app_pkg_names.get(dep_name)
                    if target_app and target_app != app_name:
                        failures.append(
                            f"apps/{app_name}/package.json depends on apps/{target_app} ({dep_name})"
                        )

        for src in iter_source_files(app_path):
            rel_src = src.relative_to(ROOT)
            for spec in extract_specifiers(src):
                for other_pkg_name, other_app in app_pkg_names.items():
                    if other_app != app_name and (
                        spec == other_pkg_name or spec.startswith(f"{other_pkg_name}/")
                    ):
                        failures.append(
                            f"{rel_src} imports another app package {spec!r} (apps/{other_app})"
                        )
                resolved = resolve_relative_target(src, spec)
                if resolved is not None:
                    for other_app, other_path in app_dirs.items():
                        if other_app != app_name and (
                            resolved == other_path or other_path in resolved.parents
                        ):
                            failures.append(
                                f"{rel_src} imports across apps boundary into apps/{other_app} via {spec!r}"
                            )

    # Rules 2, 3, and 4 on packages/*.
    pkg_graph: dict[str, set[str]] = {name: set() for name in pkg_dirs}

    for pkg_dir_name, pkg_path in pkg_dirs.items():
        pkg = read_package_json(pkg_path)
        is_neutral = pkg_dir_name in PLATFORM_NEUTRAL_PACKAGES

        # Check package.json dependencies.
        for dep_section in ("dependencies", "peerDependencies", "optionalDependencies"):
            deps = pkg.get(dep_section)
            if not isinstance(deps, dict):
                continue
            for dep_name in deps:
                if dep_name in app_pkg_names:
                    failures.append(
                        f"packages/{pkg_dir_name}/package.json must not depend on app {dep_name!r}"
                    )
                if is_neutral and is_forbidden_neutral_spec(dep_name):
                    failures.append(
                        f"packages/{pkg_dir_name}/package.json is platform-neutral and must not depend on {dep_name!r}"
                    )
                target_pkg = pkg_name_to_dir.get(dep_name)
                if target_pkg and target_pkg != pkg_dir_name:
                    pkg_graph[pkg_dir_name].add(target_pkg)

        # Check source files inside package.
        for src in iter_source_files(pkg_path):
            rel_src = src.relative_to(ROOT)
            for spec in extract_specifiers(src):
                # Rule 2: packages/* never imports apps/*.
                if spec in app_pkg_names or any(
                    spec.startswith(f"{app_pkg}/") for app_pkg in app_pkg_names
                ):
                    failures.append(f"{rel_src} must not import app package {spec!r}")
                if spec.startswith("apps/"):
                    failures.append(f"{rel_src} must not import from apps ({spec!r})")

                resolved = resolve_relative_target(src, spec)
                if resolved is not None:
                    if APPS_DIR.exists() and (
                        resolved == APPS_DIR.resolve() or APPS_DIR.resolve() in resolved.parents
                    ):
                        failures.append(
                            f"{rel_src} must not import from apps/ via relative path {spec!r}"
                        )
                    for other_pkg, other_path in pkg_dirs.items():
                        if other_pkg != pkg_dir_name and (
                            resolved == other_path or other_path in resolved.parents
                        ):
                            pkg_graph[pkg_dir_name].add(other_pkg)

                # Rule 3: platform-neutral packages never import platform-specific runtimes.
                if is_neutral and is_forbidden_neutral_spec(spec):
                    failures.append(
                        f"{rel_src} is in platform-neutral package packages/{pkg_dir_name} and must not import {spec!r}"
                    )

                # Rule 4: track package-to-package imports for cycle detection.
                for other_pkg_name, target_pkg in pkg_name_to_dir.items():
                    if target_pkg != pkg_dir_name and (
                        spec == other_pkg_name or spec.startswith(f"{other_pkg_name}/")
                    ):
                        pkg_graph[pkg_dir_name].add(target_pkg)

    for cycle in find_cycles(pkg_graph):
        failures.append("Package dependency cycle detected: " + " -> ".join(cycle))

    if failures:
        print("Import-direction guard check failed:", file=sys.stderr)
        for failure in failures:
            print(f"  {failure}", file=sys.stderr)
        return 1

    print(
        f"Import-direction guard check passed "
        f"({len(app_dirs)} apps, {len(pkg_dirs)} packages)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
