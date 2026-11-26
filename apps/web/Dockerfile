# syntax=docker.io/docker/dockerfile:1.24.0@sha256:87999aa3d42bdc6bea60565083ee17e86d1f3339802f543c0d03998580f9cb89
ARG OCI_SOURCE=https://github.com/fastagi/fastbuild
ARG OCI_REVISION=unknown
ARG OCI_VERSION=dev

# Keep native dependencies ABI-compatible between build and runtime.
FROM docker.io/library/node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS base

# The build context is this directory. The shared workspace packages live outside it and arrive
# through a second, named context:
#
#   docker buildx build --build-context packages=../../packages .
#
# Every package listed in pnpm-workspace.yaml is copied below at the same relative path
# (../../packages/<name>) that the workspace file and the lockfile use.

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /workspace/apps/web

# Install dependencies based on the preferred package manager
COPY --from=packages tokens/package.json /workspace/packages/tokens/package.json
COPY --from=packages contract-types/package.json /workspace/packages/contract-types/package.json
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /workspace/apps/web
COPY --from=deps /workspace/apps/web/node_modules ./node_modules
COPY --from=packages tokens /workspace/packages/tokens
COPY --from=packages contract-types /workspace/packages/contract-types
COPY . .
RUN mkdir -p public

# Disable anonymous Next.js telemetry in the build and production runtime.
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable pnpm && pnpm run build

# Materialize a runtime root without development package managers. The scratch
# copy prevents removed npm/Corepack/Yarn files from surviving in older layers.
FROM base AS runtime-root
RUN rm -rf /usr/local/lib/node_modules /usr/local/include \
        /usr/local/share/doc /usr/local/share/man /opt/yarn-* \
    && rm -f /usr/local/bin/corepack /usr/local/bin/npm /usr/local/bin/npx \
        /usr/local/bin/pnpm /usr/local/bin/pnpx /usr/local/bin/yarn \
        /usr/local/bin/yarnpkg /usr/local/bin/docker-entrypoint.sh /sbin/apk

# Production image, copy only the cleaned runtime and standalone application.
FROM scratch AS runner

ARG OCI_SOURCE
ARG OCI_REVISION
ARG OCI_VERSION

LABEL org.opencontainers.image.title="FastBuild Web" \
    org.opencontainers.image.description="Production runtime for the FastBuild Next.js scaffold" \
    org.opencontainers.image.source="${OCI_SOURCE}" \
    org.opencontainers.image.revision="${OCI_REVISION}" \
    org.opencontainers.image.version="${OCI_VERSION}" \
    org.opencontainers.image.base.name="docker.io/library/node:22.23.3-alpine3.24" \
    org.opencontainers.image.base.digest="sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402"

COPY --from=runtime-root / /

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
# next.config.ts roots tracing at the workspace, so the standalone tree mirrors it and the server
# lives at apps/web/server.js. Static assets and public files sit beside that server.
COPY --from=builder --chown=1000:1000 /workspace/apps/web/.next/standalone ./
COPY --from=builder --chown=1000:1000 /workspace/apps/web/public ./apps/web/public
COPY --from=builder --chown=1000:1000 /workspace/apps/web/.next/static ./apps/web/.next/static

WORKDIR /app/apps/web

USER 1000:1000

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
    CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT || '3000'}/robots.txt`).then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"]
