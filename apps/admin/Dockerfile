# syntax=docker.io/docker/dockerfile:1.24.0@sha256:87999aa3d42bdc6bea60565083ee17e86d1f3339802f543c0d03998580f9cb89
ARG OCI_SOURCE=https://github.com/fastagi/fastbuild
ARG OCI_REVISION=unknown
ARG OCI_VERSION=dev

# Build the static console with the same reviewed Node base as the Web image.
FROM docker.io/library/node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

# VITE_* values are public and compiled into the assets; never pass secrets here. Build once per
# public configuration. The container serves the console at `/`.
ARG VITE_APP_NAME=FastBuild
ARG VITE_API_BASE_URL=/api
ARG VITE_API_TIMEOUT_MS=8000
ARG VITE_API_MAX_RESPONSE_BYTES=1048576
ARG VITE_DEFAULT_LOCALE=en-US
ARG VITE_OPTIONAL_FEATURES=
ENV VITE_BASE_PATH=/

COPY . .
RUN corepack enable pnpm && pnpm run build

# Materialize a runtime root without the package manager, the stock site, or writable config. The
# scratch copy prevents removed files from surviving in older layers. /lib/apk/db stays so image
# scanners can still inventory the installed OS packages.
FROM docker.io/nginxinc/nginx-unprivileged:1.30.6-alpine3.24-slim@sha256:5d8bb9437d74a600ec5dbf90c035451c724dc33eac8d3a71078f6f8612c345f6 AS runtime-root
USER 0
RUN rm -rf /sbin/apk /etc/apk /usr/share/apk /var/cache/apk \
        /etc/nginx/conf.d /usr/share/nginx/html/* \
        /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh \
    && chown -R 0:0 /etc/nginx /usr/share/nginx /docker-entrypoint.d \
    && chmod -R go-w /etc/nginx /usr/share/nginx /docker-entrypoint.d
COPY --chown=0:0 deploy/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --chown=0:0 deploy/nginx/templates/ /etc/nginx/templates/
COPY --chown=0:0 --chmod=0755 deploy/nginx/05-admin-render-dir.sh /docker-entrypoint.d/
COPY --from=builder --chown=0:0 /app/dist/ /usr/share/nginx/html/
RUN rm -rf /usr/share/nginx/html/.vite

FROM scratch AS runner

ARG OCI_SOURCE
ARG OCI_REVISION
ARG OCI_VERSION

LABEL org.opencontainers.image.title="FastBuild Admin" \
    org.opencontainers.image.description="Static nginx runtime for the FastBuild Admin Console" \
    org.opencontainers.image.source="${OCI_SOURCE}" \
    org.opencontainers.image.revision="${OCI_REVISION}" \
    org.opencontainers.image.version="${OCI_VERSION}" \
    org.opencontainers.image.base.name="docker.io/nginxinc/nginx-unprivileged:1.30.6-alpine3.24-slim" \
    org.opencontainers.image.base.digest="sha256:5d8bb9437d74a600ec5dbf90c035451c724dc33eac8d3a71078f6f8612c345f6"

COPY --from=runtime-root / /

ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# Same-origin API gateway target and CSP connect-src; override per deployment at runtime.
ENV ADMIN_API_UPSTREAM=http://fastbuild-api:8025
ENV ADMIN_CSP_CONNECT_SRC="'self'"
ENV NGINX_ENVSUBST_FILTER=^ADMIN_
ENV NGINX_ENVSUBST_OUTPUT_DIR=/tmp/nginx

USER 101:101

EXPOSE 8080

STOPSIGNAL SIGQUIT

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/healthz"]

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
