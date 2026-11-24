# FastBuild Skill Ablation Harness

Lightweight A/B harness for measuring whether repository agent guidance (`AGENTS.md` and `.agents/skills/`) improves task pass rate, speed, and diff discipline across FastBuild's deployable units.

## Methodology

Each task in [tasks.yaml](tasks.yaml) can be executed in two isolated, disposable `git worktree add --detach` workspaces:

- **`with-agents`**: unmodified checkout of `HEAD` with `AGENTS.md`, unit `AGENTS.md` files, and `.agents/` intact.
- **`without-agents`**: detached checkout with `.agents/`, `AGENTS.md`, `api/AGENTS.md`, `apps/web/AGENTS.md`, `apps/admin/AGENTS.md`, `.claude/`, `.cursor/`, and `.codex/` stripped before invoking the agent.

All worktrees are created under `${TMPDIR:-/tmp}/fastbuild-ablation-<pid>/` and removed automatically via a `trap` handler (`git worktree remove --force`). The main working tree is never modified.

## Task Suite

`tasks.yaml` defines 5 core tasks covering FastBuild's primary surfaces:

| Task ID | Unit | Focus |
|---|---|---|
| `01-api-module-endpoint` | `api` | Validated Gin endpoint, `error_code`, and unit test |
| `02-contract-evolution` | `contracts` | Backwards-compatible OpenAPI field addition and contract sync |
| `03-web-component-test` | `web` | Vitest + Testing Library test without server-only leakage |
| `04-admin-surface-guard` | `admin` | Admin Console view preserving static-SPA architecture guard |
| `05-api-regression-tdd` | `api` | Red/green regression test and narrow fix for boundary input |

## Usage

### CI-safe dry run (no LLM invoked)

Validates `tasks.yaml`, verifies detached worktree creation, `without-agents` stripping, and cleanup, then prints the execution plan:

```bash
bash .agents/evals/ablation/run-ablation.sh --dry-run
```

### Run a single task or full A/B suite

```bash
# Single task, both variants
bash .agents/evals/ablation/run-ablation.sh \
  --task=01-api-module-endpoint \
  --variant=both \
  --agent-cmd='your-agent-cli --prompt-file "$ABLATION_PROMPT_FILE"'

# All tasks, only with-agents variant
bash .agents/evals/ablation/run-ablation.sh \
  --task=all \
  --variant=with-agents \
  --agent-cmd='your-agent-cli --prompt-file "$ABLATION_PROMPT_FILE"'
```

### Environment Variables Passed to `--agent-cmd`

`--agent-cmd` runs inside the isolated worktree directory with these environment variables set:

- `ABLATION_TASK_ID`: task identifier from `tasks.yaml`
- `ABLATION_TASK_TITLE`: short task title
- `ABLATION_TASK_UNIT`: deployable unit (`api`, `contracts`, `web`, `admin`)
- `ABLATION_TASK_PROMPT`: task prompt text
- `ABLATION_PROMPT_FILE`: path to a temp file outside the worktree containing the prompt
- `ABLATION_VERIFY_CMD`: verification command run after the agent finishes
- `ABLATION_VARIANT`: `with-agents` or `without-agents`
- `ABLATION_WORKDIR`: absolute path to the isolated worktree

## Results and Metrics

Non-dry-run executions write both JSONL and TSV summaries to `.agents/evals/ablation/results/` (gitignored):

- `task`: task ID
- `variant`: `with-agents` or `without-agents`
- `passed`: `true` if `verify_cmd` exited 0, else `false`
- `duration_s`: wall-clock seconds for agent execution + verification
- `diff_files`: count of modified or untracked files in the worktree (`git status --porcelain`)

### Interpreting Results

- Prefer **higher `passed`** on `with-agents` without inflated `diff_files`.
- If `with-agents` is slower with equal pass rate, inspect whether skills or `AGENTS.md` are causing unnecessary file reads.
- If a task fails identically in both variants, log the recurring friction with `$log-papercut` and refine the underlying docs or guardrails.
