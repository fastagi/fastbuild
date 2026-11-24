#!/usr/bin/env bash

# Append one local agent workflow papercut entry to .agents/papercuts/log.jsonl.
#
# Usage:
#   append.sh --area <area> --severity <low|med|high> --summary <text> \
#             [--cmd <cmd>] [--workaround <text>] [--dir <path>]

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || pwd)

OUT_DIR="${PAPERCUT_DIR:-$REPO_ROOT/.agents/papercuts}"
AREA=""
SEVERITY=""
SUMMARY=""
CMD=""
WORKAROUND=""

usage() {
    cat <<'EOF'
Usage: append.sh --area <area> --severity <low|med|high> --summary <text> [options]

Required:
  --area <area>           Surface or subsystem (e.g., api, web, admin, contracts, skills, ci)
  --severity <level>      One of: low, med, high
  --summary <text>        Short description of the friction point

Optional:
  --cmd <cmd>             Command that triggered or exposed the friction
  --workaround <text>     Workaround used to proceed
  --dir <path>            Override output directory (default: <repo>/.agents/papercuts)
  -h, --help              Show this help message
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --area)
            [ $# -ge 2 ] || { echo "error: --area requires a value" >&2; exit 2; }
            AREA="$2"
            shift 2
            ;;
        --area=*)
            AREA="${1#*=}"
            shift
            ;;
        --severity)
            [ $# -ge 2 ] || { echo "error: --severity requires a value" >&2; exit 2; }
            SEVERITY="$2"
            shift 2
            ;;
        --severity=*)
            SEVERITY="${1#*=}"
            shift
            ;;
        --summary)
            [ $# -ge 2 ] || { echo "error: --summary requires a value" >&2; exit 2; }
            SUMMARY="$2"
            shift 2
            ;;
        --summary=*)
            SUMMARY="${1#*=}"
            shift
            ;;
        --cmd)
            [ $# -ge 2 ] || { echo "error: --cmd requires a value" >&2; exit 2; }
            CMD="$2"
            shift 2
            ;;
        --cmd=*)
            CMD="${1#*=}"
            shift
            ;;
        --workaround)
            [ $# -ge 2 ] || { echo "error: --workaround requires a value" >&2; exit 2; }
            WORKAROUND="$2"
            shift 2
            ;;
        --workaround=*)
            WORKAROUND="${1#*=}"
            shift
            ;;
        --dir)
            [ $# -ge 2 ] || { echo "error: --dir requires a value" >&2; exit 2; }
            OUT_DIR="$2"
            shift 2
            ;;
        --dir=*)
            OUT_DIR="${1#*=}"
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

if [ -z "$AREA" ]; then
    echo "error: --area is required" >&2
    exit 2
fi

case "$SEVERITY" in
    low|med|high) ;;
    *)
        echo "error: --severity must be one of: low, med, high" >&2
        exit 2
        ;;
esac

if [ -z "$SUMMARY" ]; then
    echo "error: --summary is required" >&2
    exit 2
fi

mkdir -p "$OUT_DIR"
LOG_FILE="$OUT_DIR/log.jsonl"

python3 - "$LOG_FILE" "$AREA" "$SEVERITY" "$SUMMARY" "$CMD" "$WORKAROUND" <<'PY'
import datetime
import json
import sys

log_file, area, severity, summary, cmd, workaround = sys.argv[1:7]

entry = {
    "timestamp": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "area": area,
    "severity": severity,
    "summary": summary,
}
if cmd:
    entry["cmd"] = cmd
if workaround:
    entry["workaround"] = workaround

with open(log_file, "a", encoding="utf-8") as f:
    f.write(json.dumps(entry, ensure_ascii=False) + "\n")
PY

echo "Logged papercut to $LOG_FILE (area=$AREA severity=$SEVERITY)"
