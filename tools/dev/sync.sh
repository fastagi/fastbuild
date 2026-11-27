#!/usr/bin/env bash

# Regenerate every derived artifact after a code or contract edit, or verify that none is stale.
#
#   tools/dev/sync.sh           regenerate
#   tools/dev/sync.sh --check   fail when a regenerate would change the tree (writes nothing)
#
# Steps: Wire graph, pending OpenAPI fragments, generated TypeScript contract types, the starter
# catalog, and the golden schema. The golden schema needs a disposable PostgreSQL database and is
# skipped, with a notice, when FASTBUILD_TEST_POSTGRES_DSN is unset.

set -uo pipefail
export LC_ALL=C

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$REPO_ROOT"

MODE=write
case "${1:-}" in
    "") ;;
    --check) MODE=check ;;
    *) echo "usage: sync.sh [--check]" >&2; exit 2 ;;
esac

FAILED=0
LOG=$(mktemp "${TMPDIR:-/tmp}/fastbuild-sync.XXXXXX")
trap 'rm -f "$LOG"' EXIT

step() {
    local label=$1
    shift
    if "$@" >"$LOG" 2>&1; then
        echo "  ok    $label"
    else
        echo "  FAIL  $label"
        sed 's/^/        /' "$LOG" | tail -n 40
        FAILED=1
    fi
}

skip() {
    echo "  skip  $1"
}

pending_fragments() {
    find packages/contracts/fragments -maxdepth 1 -name '*.yaml' 2>/dev/null | sort
}

merge_fragments() {
    local fragment
    while IFS= read -r fragment; do
        [ -n "$fragment" ] || continue
        (cd packages/contracts && corepack pnpm --silent merge-fragment "fragments/$(basename "$fragment")") || return 1
    done < <(pending_fragments)
    rmdir packages/contracts/fragments 2>/dev/null || true
}

no_pending_fragments() {
    local pending
    pending=$(pending_fragments)
    [ -z "$pending" ] && return 0
    echo "unmerged OpenAPI fragments (run 'make sync'):"
    echo "$pending"
    return 1
}

starter_catalog() {
    (cd api && env "$@" go test ./internal/infra/console/commands \
        -run '^TestModulesReadmeStarterCatalogIsGenerated$' -count=1)
}

golden_schema() {
    (cd api && env "$@" go test ./database/migrations -run '^TestMigrationsProduceGoldenSchema$' -count=1)
}

if [ "$MODE" = write ]; then
    echo "Sync: regenerating derived artifacts"
    step "wire graph" make -C api wire
    step "openapi fragments" merge_fragments
    step "contract types" bash -c 'cd packages/contracts && corepack pnpm --silent generate'
    step "starter catalog" starter_catalog FASTBUILD_UPDATE_STARTER_CATALOG=1
    if [ -n "${FASTBUILD_TEST_POSTGRES_DSN:-}" ]; then
        step "golden schema" golden_schema FASTBUILD_UPDATE_GOLDEN_SCHEMA=1
    else
        skip "golden schema (set FASTBUILD_TEST_POSTGRES_DSN after adding or changing a migration)"
    fi
else
    echo "Sync check: derived artifacts must match their sources"
    step "wire graph" make -C api wire-check
    step "openapi fragments" no_pending_fragments
    step "contract types" bash -c 'cd packages/contracts && node scripts/generate-types.mjs --check'
    step "starter catalog" starter_catalog FASTBUILD_UPDATE_STARTER_CATALOG=
    if [ -n "${FASTBUILD_TEST_POSTGRES_DSN:-}" ]; then
        step "golden schema" golden_schema FASTBUILD_UPDATE_GOLDEN_SCHEMA=
    else
        skip "golden schema (FASTBUILD_TEST_POSTGRES_DSN is unset)"
    fi
fi

if [ "$FAILED" -ne 0 ]; then
    [ "$MODE" = check ] && echo "Derived artifacts are stale: run 'make sync' and commit the result." >&2
    exit 1
fi
echo "Sync passed."
