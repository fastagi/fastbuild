.PHONY: release-check init-project dev dev-down dev-reset check agent-check agent-check-changed agent-sync agent-context skill-routing-check governance contract-check contract-generate api-check web-check admin-check dependency-scan sbom container-scan container-sbom clean clean-all

# Turn a fresh copy of the scaffold into a named project (run once, before the first commit):
#   make init-project NAME="Acme Platform" SLUG=acme MODULE=github.com/acme/platform/api \
#     [REPOSITORY=https://github.com/acme/platform] [STARTERS=organization,permission,operator] \
#     [TEMPLATE=<registry template, see plugin:search --kind=template>]
init-project:
	@test -n "$(NAME)" && test -n "$(SLUG)" && test -n "$(MODULE)" || \
		{ echo 'usage: make init-project NAME="Acme Platform" SLUG=acme MODULE=github.com/acme/platform/api [REPOSITORY=...] [STARTERS=...] [TEMPLATE=...]' >&2; exit 2; }
	cd api && go run ./cmd/fastbuild project:init --name="$(NAME)" --slug="$(SLUG)" --module="$(MODULE)" \
		$(if $(REPOSITORY),--repository="$(REPOSITORY)") $(if $(STARTERS),--starters="$(STARTERS)") \
		$(if $(TEMPLATE),--template="$(TEMPLATE)")
	cd api && go mod tidy

# Verify main is ready to tag; see docs/scaffold/VERSIONING.md.
release-check:
	@test -n "$(VERSION)" || { echo 'usage: make release-check VERSION=v0.22.0' >&2; exit 2; }
	@[ ! -d tools/scaffold ] || bash tools/scaffold/release-check.sh "$(VERSION)"

# One-command local stack: PostgreSQL in Docker, API, Web, and Admin on the host.
# Override ports with FASTBUILD_API_PORT, FASTBUILD_WEB_PORT, FASTBUILD_ADMIN_PORT, FASTBUILD_DB_PORT.
dev:
	@bash tools/dev/dev.sh up

dev-down:
	@bash tools/dev/dev.sh down

dev-reset:
	@bash tools/dev/dev.sh reset

check: governance contract-check api-check web-check admin-check

contract-check:
	cd packages/contracts && corepack pnpm check
	cd packages/contracts && corepack pnpm check:routes
	cd packages/contracts && corepack pnpm check:registry

contract-generate:
	cd packages/contracts && corepack pnpm generate

agent-check:
	@[ ! -d tools/scaffold ] || bash tools/scaffold/check-vocabulary.sh
	@PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-doc-links.py
	@PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-english-source.py
	@bash .agents/skills/scripts/validate-skill.sh --all
	@PYTHONDONTWRITEBYTECODE=1 python3 .agents/skills/scripts/render-skill-index.py --check
	@PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-tracked-artifacts.py
	@PYTHONDONTWRITEBYTECODE=1 python3 .agents/skills/scripts/check-skill-routing.py
	@git diff --check

agent-check-changed:
	@bash .agents/skills/scripts/check-agent-changed.sh

agent-sync:
	cd api && go run ./cmd/fastbuild agent:sync

agent-context:
	cd api && go run ./cmd/fastbuild context --changed --format=agent

skill-routing-check:
	@PYTHONDONTWRITEBYTECODE=1 python3 .agents/skills/scripts/check-skill-routing.py

governance: agent-check
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-error-contracts.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-route-contract-discovery.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-auth-contract-boundary.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-rate-limit-boundary.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-cache-boundary.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-database-boundary.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-web-performance-boundary.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-web-security-boundary.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-web-ui-primitive-boundary.py
	node apps/admin/scripts/check-architecture.mjs
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-api-key-boundary.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-audit-boundary.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-permission-boundary.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-notification-boundary.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-asset-boundary.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-setting-boundary.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-usage-boundary.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-webhook-boundary.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-ai-boundary.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-sensitive-telemetry.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-config-authority.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-email-boundary.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-ci-actions.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-dependency-supply-chain.py
	PYTHONDONTWRITEBYTECODE=1 python3 tools/guards/check-container-supply-chain.py
	[ ! -d tools/scaffold ] || PYTHONDONTWRITEBYTECODE=1 python3 tools/scaffold/check-surface-catalog.py
	[ ! -d tools/scaffold ] || PYTHONDONTWRITEBYTECODE=1 python3 tools/scaffold/check-starter-catalog.py
	bash tools/guards/check-api-boundaries.sh
	[ ! -d tools/scaffold ] || bash tools/scaffold/check-branch-governance.sh

api-check:
	cd api && bash ../.agents/skills/core/verification-before-completion/scripts/run-tiers.sh 1
	cd api && make route-catalog-check

web-check:
	cd apps/web && bash ../../.agents/skills/core/verification-before-completion/scripts/run-tiers.sh 2

admin-check:
	cd apps/admin && bash ../../.agents/skills/core/verification-before-completion/scripts/run-tiers.sh 2

dependency-scan:
	bash tools/ci/dependency-security.sh scan

sbom:
	bash tools/ci/dependency-security.sh sbom "$${SBOM_OUTPUT:-$${TMPDIR:-/tmp}/fastbuild.cdx.json}"

container-scan:
	@test -n "$${IMAGE:-}" || { echo "IMAGE is required (for example, IMAGE=fastbuild-api:container-check)" >&2; exit 2; }
	bash tools/ci/container-security.sh scan "$${IMAGE}"

container-sbom:
	@test -n "$${IMAGE:-}" || { echo "IMAGE is required (for example, IMAGE=fastbuild-api:container-check)" >&2; exit 2; }
	bash tools/ci/container-security.sh sbom "$${IMAGE}" "$${SBOM_OUTPUT:-$${TMPDIR:-/tmp}/fastbuild-container.cdx.json}"

# Remove generated build, test, log, and language-tool output while preserving
# installed dependencies and reusable scanner caches.
clean:
	$(MAKE) -C api clean
	rm -f api/*.test
	find api -type d -path '*/storage/logs' -prune -exec rm -rf {} +
	cd apps/web && corepack pnpm clean
	rm -f apps/web/next-env.d.ts
	cd apps/admin && corepack pnpm clean
	rm -rf .ruff_cache .pytest_cache
	find . \( -path './.git' -o -name node_modules -o -name .next \) -prune -o -type d -name __pycache__ -exec rm -rf {} +

# Also remove installed JavaScript dependencies for a cold workspace reset.
clean-all: clean
	rm -rf packages/contracts/node_modules web/node_modules admin/node_modules
