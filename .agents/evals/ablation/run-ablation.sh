#!/usr/bin/env bash

# Lightweight A/B ablation harness for FastBuild agent guidance and skills.
#
# Usage:
#   run-ablation.sh --dry-run [--task=<id|all>] [--variant=both|with-agents|without-agents]
#   run-ablation.sh [--task=<id|all>] [--variant=both|with-agents|without-agents] --agent-cmd="<cmd>"

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)
TASKS_FILE="$SCRIPT_DIR/tasks.yaml"
RESULTS_DIR="$SCRIPT_DIR/results"

DRY_RUN=0
TASK_FILTER="all"
VARIANT="both"
AGENT_CMD="${ABLATION_AGENT_CMD:-}"

TMP_BASE="${TMPDIR:-/tmp}/fastbuild-ablation-$$"
CREATED_WORKTREES=()

usage() {
    cat <<'EOF'
Usage: run-ablation.sh [options]

Options:
  --dry-run                                 Validate tasks.yaml, test worktree create/strip/cleanup, print plan, exit 0
  --task=<id|all>                           Task ID to run or 'all' (default: all)
  --variant=both|with-agents|without-agents Variant(s) to run (default: both)
  --agent-cmd="<cmd>"                       Shell command invoked inside each isolated worktree
  -h, --help                                Show this help message
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --dry-run)
            DRY_RUN=1
            shift
            ;;
        --task=*)
            TASK_FILTER="${1#*=}"
            shift
            ;;
        --task)
            [ $# -ge 2 ] || { echo "error: --task requires a value" >&2; exit 2; }
            TASK_FILTER="$2"
            shift 2
            ;;
        --variant=*)
            VARIANT="${1#*=}"
            shift
            ;;
        --variant)
            [ $# -ge 2 ] || { echo "error: --variant requires a value" >&2; exit 2; }
            VARIANT="$2"
            shift 2
            ;;
        --agent-cmd=*)
            AGENT_CMD="${1#*=}"
            shift
            ;;
        --agent-cmd)
            [ $# -ge 2 ] || { echo "error: --agent-cmd requires a value" >&2; exit 2; }
            AGENT_CMD="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "error: unknown argument: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
done

case "$VARIANT" in
    both|with-agents|without-agents) ;;
    *)
        echo "error: invalid --variant '$VARIANT' (expected: both, with-agents, or without-agents)" >&2
        exit 2
        ;;
esac

if [ "$DRY_RUN" -eq 0 ] && [ -z "$AGENT_CMD" ]; then
    echo "error: --agent-cmd is required unless --dry-run is set" >&2
    exit 2
fi

if [ ! -f "$TASKS_FILE" ]; then
    echo "error: tasks file not found: $TASKS_FILE" >&2
    exit 1
fi

cleanup() {
    local wt
    if [ "${#CREATED_WORKTREES[@]}" -gt 0 ]; then
        for wt in "${CREATED_WORKTREES[@]}"; do
            if [ -d "$wt" ]; then
                git -C "$REPO_ROOT" worktree remove --force "$wt" >/dev/null 2>&1 || rm -rf "$wt"
            fi
        done
    fi
    git -C "$REPO_ROOT" worktree prune >/dev/null 2>&1 || true
    if [ -d "$TMP_BASE" ]; then
        rm -rf "$TMP_BASE"
    fi
}
trap cleanup EXIT INT TERM

# Parse and validate tasks.yaml using Python stdlib only (no external YAML dep).
TASKS_JSON=$(python3 - "$TASKS_FILE" "$TASK_FILTER" <<'PY'
import json
import sys

tasks_file, task_filter = sys.argv[1], sys.argv[2]

required_fields = ("id", "title", "unit", "prompt", "verify_cmd", "max_minutes")
expected_core_ids = {
    "01-api-module-endpoint",
    "02-contract-evolution",
    "03-web-component-test",
    "04-admin-surface-guard",
    "05-api-regression-tdd",
}

def unquote(val: str) -> str:
    val = val.strip()
    if len(val) >= 2 and ((val[0] == '"' and val[-1] == '"') or (val[0] == "'" and val[-1] == "'")):
        inner = val[1:-1]
        if val[0] == '"':
            return inner.replace('\\"', '"').replace("\\\\", "\\")
        return inner
    return val

tasks = []
current = None
in_tasks = False

with open(tasks_file, "r", encoding="utf-8") as f:
    for lineno, raw in enumerate(f, 1):
        line = raw.rstrip("\r\n")
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped == "tasks:":
            in_tasks = True
            continue
        if not in_tasks:
            sys.exit(f"error: {tasks_file}:{lineno}: expected top-level 'tasks:' key")
        if stripped.startswith("- "):
            if current is not None:
                tasks.append(current)
            current = {}
            rest = stripped[2:].strip()
            if rest:
                if ":" not in rest:
                    sys.exit(f"error: {tasks_file}:{lineno}: invalid task field '{rest}'")
                k, v = rest.split(":", 1)
                current[k.strip()] = unquote(v)
        else:
            if current is None or ":" not in stripped:
                sys.exit(f"error: {tasks_file}:{lineno}: invalid line '{stripped}'")
            k, v = stripped.split(":", 1)
            current[k.strip()] = unquote(v)

if current is not None:
    tasks.append(current)

if len(tasks) < 5:
    sys.exit(f"error: expected at least 5 tasks in {tasks_file}, found {len(tasks)}")

seen_ids = set()
for idx, task in enumerate(tasks, 1):
    for field in required_fields:
        if not task.get(field):
            sys.exit(f"error: task #{idx} missing required field '{field}'")
    tid = task["id"]
    if tid in seen_ids:
        sys.exit(f"error: duplicate task id '{tid}'")
    seen_ids.add(tid)
    try:
        minutes = int(task["max_minutes"])
        if minutes <= 0:
            raise ValueError()
        task["max_minutes"] = minutes
    except ValueError:
        sys.exit(f"error: task '{tid}' has invalid max_minutes '{task['max_minutes']}'")

missing_core = sorted(expected_core_ids - seen_ids)
if missing_core:
    sys.exit(f"error: missing core tasks in {tasks_file}: {', '.join(missing_core)}")

if task_filter == "all":
    selected = tasks
else:
    selected = [t for t in tasks if t["id"] == task_filter]
    if not selected:
        sys.exit(f"error: task '{task_filter}' not found in {tasks_file}")

print(json.dumps(selected))
PY
)

strip_agent_files() {
    local wt="$1"
    rm -rf \
        "$wt/.agents" \
        "$wt/AGENTS.md" \
        "$wt/api/AGENTS.md" \
        "$wt/apps/web/AGENTS.md" \
        "$wt/apps/admin/AGENTS.md" \
        "$wt/.claude" \
        "$wt/.cursor" \
        "$wt/.codex"
}

create_worktree() {
    local wt="$1"
    local variant="$2"
    mkdir -p "$(dirname "$wt")"
    git -C "$REPO_ROOT" worktree add --detach --quiet "$wt" HEAD
    CREATED_WORKTREES+=("$wt")
    if [ "$variant" = "without-agents" ]; then
        strip_agent_files "$wt"
    fi
}

remove_worktree() {
    local wt="$1"
    if [ -d "$wt" ]; then
        git -C "$REPO_ROOT" worktree remove --force "$wt" >/dev/null 2>&1 || rm -rf "$wt"
    fi
}

VARIANTS=()
if [ "$VARIANT" = "both" ]; then
    VARIANTS=("with-agents" "without-agents")
else
    VARIANTS=("$VARIANT")
fi

mkdir -p "$TMP_BASE"

if [ "$DRY_RUN" -eq 1 ]; then
    echo "[dry-run] tasks.yaml validated successfully ($TASKS_FILE)"

    # Verify worktree create, strip, and cleanup in TMP_BASE
    test_wt="$TMP_BASE/dry-run-without-agents"
    create_worktree "$test_wt" "without-agents"
    if [ -e "$test_wt/AGENTS.md" ] || [ -d "$test_wt/.agents" ]; then
        echo "error: without-agents worktree still contains agent guidance files" >&2
        exit 1
    fi
    remove_worktree "$test_wt"
    echo "[dry-run] worktree create/strip/cleanup verified under $TMP_BASE"

    echo "[dry-run] execution plan (variant=$VARIANT, task=$TASK_FILTER):"
    python3 - "$TASKS_JSON" "${VARIANTS[@]}" <<'PY'
import json
import sys

tasks = json.loads(sys.argv[1])
variants = sys.argv[2:]
for task in tasks:
    for v in variants:
        print(f"  - task={task['id']} variant={v} unit={task['unit']} max_minutes={task['max_minutes']} verify=\"{task['verify_cmd']}\"")
PY
    exit 0
fi

mkdir -p "$RESULTS_DIR"
RUN_STAMP=$(date -u +"%Y%m%dT%H%M%SZ")
JSONL_OUT="$RESULTS_DIR/ablation-${RUN_STAMP}.jsonl"
TSV_OUT="$RESULTS_DIR/ablation-${RUN_STAMP}.tsv"
printf 'task\tvariant\tpassed\tduration_s\tdiff_files\n' > "$TSV_OUT"

TASK_COUNT=$(python3 -c 'import json,sys; print(len(json.loads(sys.argv[1])))' "$TASKS_JSON")

for ((i = 0; i < TASK_COUNT; i++)); do
    TASK_ID=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])[int(sys.argv[2])]["id"])' "$TASKS_JSON" "$i")
    TASK_TITLE=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])[int(sys.argv[2])]["title"])' "$TASKS_JSON" "$i")
    TASK_UNIT=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])[int(sys.argv[2])]["unit"])' "$TASKS_JSON" "$i")
    TASK_PROMPT=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])[int(sys.argv[2])]["prompt"])' "$TASKS_JSON" "$i")
    VERIFY_CMD=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])[int(sys.argv[2])]["verify_cmd"])' "$TASKS_JSON" "$i")

    PROMPT_FILE="$TMP_BASE/prompt-${TASK_ID}.txt"
    printf '%s\n' "$TASK_PROMPT" > "$PROMPT_FILE"

    for v in "${VARIANTS[@]}"; do
        wt="$TMP_BASE/${TASK_ID}-${v}"
        echo "==> Running task=${TASK_ID} variant=${v}"
        create_worktree "$wt" "$v"

        start_s=$(date +%s)
        agent_ok=0
        if (
            cd "$wt"
            export ABLATION_TASK_ID="$TASK_ID"
            export ABLATION_TASK_TITLE="$TASK_TITLE"
            export ABLATION_TASK_UNIT="$TASK_UNIT"
            export ABLATION_TASK_PROMPT="$TASK_PROMPT"
            export ABLATION_PROMPT_FILE="$PROMPT_FILE"
            export ABLATION_VERIFY_CMD="$VERIFY_CMD"
            export ABLATION_VARIANT="$v"
            export ABLATION_WORKDIR="$wt"
            eval "$AGENT_CMD"
        ); then
            agent_ok=1
        fi

        passed="false"
        if [ "$agent_ok" -eq 1 ]; then
            if (cd "$wt" && bash -c "$VERIFY_CMD"); then
                passed="true"
            fi
        fi

        end_s=$(date +%s)
        duration_s=$((end_s - start_s))
        diff_files=$(git -C "$wt" status --porcelain | wc -l | tr -d ' ')

        printf '%s\t%s\t%s\t%s\t%s\n' "$TASK_ID" "$v" "$passed" "$duration_s" "$diff_files" >> "$TSV_OUT"
        python3 - "$TASK_ID" "$v" "$passed" "$duration_s" "$diff_files" >> "$JSONL_OUT" <<'PY'
import json
import sys

record = {
    "task": sys.argv[1],
    "variant": sys.argv[2],
    "passed": sys.argv[3] == "true",
    "duration_s": int(sys.argv[4]),
    "diff_files": int(sys.argv[5]),
}
print(json.dumps(record))
PY

        remove_worktree "$wt"
        echo "    result: passed=${passed} duration_s=${duration_s} diff_files=${diff_files}"
    done
done

echo "Results written to:"
echo "  JSONL: $JSONL_OUT"
echo "  TSV:   $TSV_OUT"
