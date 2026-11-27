#!/usr/bin/env bash
# Proves the code generators end to end in a scratch copy of this checkout: generate an
# organization-scoped starter and its Web feature, regenerate the derived artifacts, and run the
# checks a builder would run. The embedded Web feature templates are not compiled anywhere else,
# so this is what keeps them from drifting away from apps/web. The checkout is never changed.
#
#   tools/scaffold/verify-generators.sh [name]
#
# FASTBUILD_TEST_POSTGRES_DSN enables the generated PostgreSQL isolation test. packages/contracts/
# and apps/web/ need their dependencies installed (pnpm install).
set -euo pipefail

name=${1:-ledger}
repo=$(cd "$(dirname "$0")/../.." && pwd)
scratch=$(mktemp -d "${TMPDIR:-/tmp}/fastbuild-generators-XXXXXX")
trap 'rm -rf "$scratch"' EXIT

step() { printf '\n==> %s\n' "$*"; }

# Gives a scratch app its dependencies without installing: every entry links to the checkout's
# node_modules, except the @fastbuild workspace packages, which link to the scratch copy so that
# regenerated or edited package sources are the ones the scratch app compiles against.
link_node_modules() {
  local half=$1 source="$repo/$1/node_modules" target="$scratch/$1/node_modules" entry package real
  mkdir -p "$target"
  for entry in "$source"/* "$source"/.[!.]*; do
    [[ -e "$entry" || -L "$entry" ]] || continue
    [[ "$(basename "$entry")" == "@fastbuild" ]] && continue
    ln -s "$entry" "$target/$(basename "$entry")"
  done
  [[ -d "$source/@fastbuild" ]] || return 0
  mkdir -p "$target/@fastbuild"
  for package in "$source/@fastbuild"/*; do
    real=$(cd "$package" && pwd -P)
    ln -s "$scratch/${real#"$repo/"}" "$target/@fastbuild/$(basename "$package")"
  done
}

step "Copying the checkout to $scratch"
rsync -a --exclude node_modules --exclude .git --exclude .next --exclude dist \
  --exclude .fastbuild-dev --exclude coverage "$repo/" "$scratch/"
for half in packages/contracts apps/web; do
  if [[ ! -d "$repo/$half/node_modules" ]]; then
    echo "$half/node_modules is missing; run corepack pnpm install there first." >&2
    exit 2
  fi
  link_node_modules "$half"
done

fastbuild() { (cd "$scratch/api" && go run ./cmd/fastbuild "$@"); }

step "make:module $name --scope=organization"
fastbuild make:module "$name" --scope=organization

step "make sync"
(cd "$scratch" && bash tools/dev/sync.sh)

step "make:feature $name --web"
fastbuild make:feature "$name" --web

step "API: build, analyzers, generated tests, routes"
(cd "$scratch/api" && go build ./... && make -s archlint && go test "./internal/modules/$name/..." && make -s route-catalog-check)

step "Contract gate"
(cd "$scratch/packages/contracts" && corepack pnpm -s check && corepack pnpm -s check:routes)

step "Web: type-check, lint, tests"
(cd "$scratch/apps/web" && corepack pnpm -s type-check && corepack pnpm -s lint && CI=true corepack pnpm -s test -- --run)

printf '\nGenerators verified with "%s".\n' "$name"
