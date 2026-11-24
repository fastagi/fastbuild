#!/usr/bin/env bash

# Summarize local agent workflow papercuts from .agents/papercuts/log.jsonl.
#
# Usage:
#   summarize.sh [--dir <path>] [--limit <n>]

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || pwd)

OUT_DIR="${PAPERCUT_DIR:-$REPO_ROOT/.agents/papercuts}"
LIMIT=5

usage() {
    cat <<'EOF'
Usage: summarize.sh [options]

Options:
  --dir <path>    Override papercut directory (default: <repo>/.agents/papercuts)
  --limit <n>     Number of latest entries to display (default: 5)
  -h, --help      Show this help message
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --dir)
            [ $# -ge 2 ] || { echo "error: --dir requires a value" >&2; exit 2; }
            OUT_DIR="$2"
            shift 2
            ;;
        --dir=*)
            OUT_DIR="${1#*=}"
            shift
            ;;
        --limit)
            [ $# -ge 2 ] || { echo "error: --limit requires a value" >&2; exit 2; }
            LIMIT="$2"
            shift 2
            ;;
        --limit=*)
            LIMIT="${1#*=}"
            shift
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

LOG_FILE="$OUT_DIR/log.jsonl"

if [ ! -f "$LOG_FILE" ] || [ ! -s "$LOG_FILE" ]; then
    echo "No papercuts logged yet ($LOG_FILE)."
    exit 0
fi

python3 - "$LOG_FILE" "$LIMIT" <<'PY'
import collections
import json
import sys

log_file = sys.argv[1]
try:
    limit = int(sys.argv[2])
    if limit < 0:
        raise ValueError()
except ValueError:
    sys.exit(f"error: invalid --limit '{sys.argv[2]}'")

entries = []
with open(log_file, "r", encoding="utf-8") as f:
    for lineno, raw in enumerate(f, 1):
        line = raw.strip()
        if not line:
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError as exc:
            sys.exit(f"error: {log_file}:{lineno}: invalid JSON: {exc}")

if not entries:
    print(f"No papercuts logged yet ({log_file}).")
    sys.exit(0)

by_area_sev = collections.Counter()
by_sev = collections.Counter()
for e in entries:
    area = e.get("area", "unknown")
    sev = e.get("severity", "unknown")
    by_area_sev[(area, sev)] += 1
    by_sev[sev] += 1

print(f"Total papercuts: {len(entries)} (high={by_sev['high']}, med={by_sev['med']}, low={by_sev['low']})")
print("\nBy area and severity:")
sev_rank = {"high": 0, "med": 1, "low": 2}
for (area, sev), count in sorted(by_area_sev.items(), key=lambda item: (item[0][0], sev_rank.get(item[0][1], 9))):
    print(f"  - {area} [{sev}]: {count}")

if limit > 0:
    recent = entries[-limit:]
    print(f"\nLatest {len(recent)} entries:")
    for e in reversed(recent):
        ts = e.get("timestamp", "?")
        area = e.get("area", "unknown")
        sev = e.get("severity", "unknown")
        summary = e.get("summary", "")
        print(f"  - [{ts}] ({area}/{sev}) {summary}")
        if e.get("cmd"):
            print(f"      cmd: {e['cmd']}")
        if e.get("workaround"):
            print(f"      workaround: {e['workaround']}")
PY
