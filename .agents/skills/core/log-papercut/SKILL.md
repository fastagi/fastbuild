---
name: log-papercut
description: Record and summarize recurring local agent workflow friction in .agents/papercuts/ without polluting git history. Use when a command, doc, or guardrail slows down work.
---

# Log Papercut

## Purpose

Capture small, recurring friction points encountered during agent or developer sessions (misleading docs, flaky commands, missing shortcuts, slow checks, unclear error messages) in a local, gitignored JSONL log so patterns can be reviewed and fixed systematically.

> **Important:** `.agents/papercuts/` is gitignored and local-only. Never force-add or commit `.agents/papercuts/log.jsonl`.

## When to Use

Use this skill when:

- a repository command, script, or Makefile target behaves unexpectedly or requires an undocumented workaround,
- an `AGENTS.md`, skill, or contract doc is stale or caused a wrong turn,
- you want to review accumulated local friction before a cleanup or framework-quality pass.

Skip this skill for active production bugs (fix or file them directly) or one-off user typos.

## Workflow

### 1. Append a papercut

Run `append.sh` with `--area`, `--severity` (`low`, `med`, or `high`), and `--summary`, plus optional `--cmd` and `--workaround`:

```bash
bash .agents/skills/core/log-papercut/scripts/append.sh \
  --area api \
  --severity med \
  --summary "make wire fails silently when GOPATH/bin is missing from PATH" \
  --cmd "cd api && make wire" \
  --workaround "export PATH=\"$(go env GOPATH)/bin:$PATH\""
```

Each call appends one UTC-timestamped JSON object to `.agents/papercuts/log.jsonl`.

### 2. Summarize logged papercuts

Run `summarize.sh` to group entries by `area` and `severity` and view the most recent items:

```bash
bash .agents/skills/core/log-papercut/scripts/summarize.sh
```

Pass `--limit <n>` to adjust how many recent entries are shown (default: `5`). If `.agents/papercuts/log.jsonl` does not exist or is empty, `summarize.sh` exits `0` cleanly.

### 3. Override directory (optional)

Both scripts default to `<repo-root>/.agents/papercuts` and accept `--dir <path>` (or the `PAPERCUT_DIR` environment variable) for isolated testing.

## Severity Guide

- `low`: minor annoyance or wording ambiguity with an obvious workaround.
- `med`: repeated detour, slow feedback loop, or stale command/doc that wastes several minutes.
- `high`: broken local workflow, misleading guardrail, or missing prerequisite that blocks a task.

## Verification

Confirm `.agents/papercuts/` remains untracked/ignored (`git status --short` shows no papercut files).
