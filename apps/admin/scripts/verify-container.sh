#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPOSITORY_ROOT="$(git -C "${ROOT_DIR}" rev-parse --show-toplevel 2>/dev/null || dirname "${ROOT_DIR}")"
IMAGE_TAG="${1:-fastbuild-admin:container-check}"
CONTAINER_NAME="fastbuild-admin-container-check-$$"
TMP_DIR="$(mktemp -d)"
BUILD_METADATA_OUTPUT="${BUILD_METADATA_OUTPUT:-${TMP_DIR}/fastbuild-admin.build-metadata.json}"
OCI_SOURCE="${OCI_SOURCE:-https://github.com/fastagi/fastbuild}"
OCI_REVISION="${OCI_REVISION:-$(git -C "${REPOSITORY_ROOT}" rev-parse HEAD 2>/dev/null || printf 'unknown')}"
OCI_VERSION="${OCI_VERSION:-$(git -C "${REPOSITORY_ROOT}" describe --tags --always 2>/dev/null || printf 'dev')}"

cleanup() {
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

fail() {
  printf 'admin container verification failed: %s\n' "$1" >&2
  docker logs "${CONTAINER_NAME}" >&2 2>/dev/null || true
  exit 1
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

assert_label() {
  local key="$1" expected="$2" actual
  actual="$(docker image inspect "${IMAGE_TAG}" --format "{{ index .Config.Labels \"${key}\" }}")"
  [[ "${actual}" == "${expected}" ]] || fail "label ${key} is '${actual}', expected '${expected}'"
}

# fetch <path> <name>: writes <name>.headers and <name>.body, prints the HTTP status.
fetch() {
  curl --noproxy '*' --silent --show-error \
    --dump-header "${TMP_DIR}/$2.headers" \
    --output "${TMP_DIR}/$2.body" \
    --write-out '%{http_code}' \
    "http://127.0.0.1:${published_port}$1"
}

header_value() {
  awk -v name="$2" 'tolower($0) ~ "^" name ":" { sub(/^[^:]*:[ \t]*/, ""); sub(/\r$/, ""); print; exit }' \
    "${TMP_DIR}/$1.headers"
}

command -v docker >/dev/null 2>&1 || fail "docker is not installed"
command -v curl >/dev/null 2>&1 || fail "curl is not installed"
command -v python3 >/dev/null 2>&1 || fail "python3 is not installed"
command -v shasum >/dev/null 2>&1 || command -v sha256sum >/dev/null 2>&1 || fail "SHA-256 utility is not installed"
docker info >/dev/null 2>&1 || fail "docker daemon is unavailable"
docker buildx version >/dev/null 2>&1 || fail "docker buildx is unavailable"
mkdir -p "$(dirname "${BUILD_METADATA_OUTPUT}")"

BUILDX_METADATA_PROVENANCE=max BUILDX_METADATA_WARNINGS=1 \
  docker buildx build --progress=plain --load \
    --metadata-file "${BUILD_METADATA_OUTPUT}" \
    --build-arg "OCI_SOURCE=${OCI_SOURCE}" \
    --build-arg "OCI_REVISION=${OCI_REVISION}" \
    --build-arg "OCI_VERSION=${OCI_VERSION}" \
    --build-arg "VITE_OPTIONAL_FEATURES=operator" \
    --tag "${IMAGE_TAG}" "${ROOT_DIR}"

python3 - "${BUILD_METADATA_OUTPUT}" <<'PY'
import json
import re
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    metadata = json.load(handle)

digest = metadata.get("containerimage.digest", "")
if re.fullmatch(r"sha256:[0-9a-f]{64}", digest) is None:
    raise SystemExit("build metadata is missing a valid container image digest")

statement = metadata.get("buildx.build.provenance")
if not isinstance(statement, dict):
    raise SystemExit("build metadata is missing Buildx provenance")
predicate = statement.get("predicate", statement)
if predicate.get("buildType") != "https://mobyproject.org/buildkit@v1":
    raise SystemExit("build metadata has an unexpected provenance buildType")
entrypoint = predicate.get("invocation", {}).get("configSource", {}).get("entryPoint")
if entrypoint != "Dockerfile":
    raise SystemExit("build provenance does not identify Dockerfile as the entry point")

materials = predicate.get("materials")
if not isinstance(materials, list) or len(materials) < 3:
    raise SystemExit("build provenance must contain Dockerfile, Node, and nginx materials")
observed = {
    value
    for material in materials
    if isinstance(material, dict)
    for value in [material.get("digest", {}).get("sha256")]
    if isinstance(value, str)
}
expected = {
    "87999aa3d42bdc6bea60565083ee17e86d1f3339802f543c0d03998580f9cb89",
    "0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402",
    "5d8bb9437d74a600ec5dbf90c035451c724dc33eac8d3a71078f6f8612c345f6",
}
if not expected.issubset(observed):
    raise SystemExit("build provenance does not contain every reviewed Admin material digest")

print(f"validated BuildKit provenance with {len(materials)} immutable materials")
PY

assert_label "org.opencontainers.image.source" "${OCI_SOURCE}"
assert_label "org.opencontainers.image.revision" "${OCI_REVISION}"
assert_label "org.opencontainers.image.version" "${OCI_VERSION}"
assert_label "org.opencontainers.image.base.digest" "sha256:5d8bb9437d74a600ec5dbf90c035451c724dc33eac8d3a71078f6f8612c345f6"

image_user="$(docker image inspect "${IMAGE_TAG}" --format '{{.Config.User}}')"
case "${image_user}" in
  ""|0|root|0:0|root:root) fail "image must run as a non-root user" ;;
esac

healthcheck="$(docker image inspect "${IMAGE_TAG}" --format '{{json .Config.Healthcheck}}')"
[[ "${healthcheck}" != "null" ]] || fail "image has no HEALTHCHECK"

docker run --rm --entrypoint sh "${IMAGE_TAG}" -c '
  present=""
  for path in /sbin/apk /etc/apk /usr/local/bin/node /etc/nginx/conf.d \
      /usr/share/nginx/html/.vite; do
    [ -e "${path}" ] && present="${present} ${path}"
  done
  for path in /usr/share/nginx/html/.env* /etc/nginx/.env*; do
    [ -e "${path}" ] && present="${present} ${path}"
  done
  [ -f /lib/apk/db/installed ] || present="${present} missing:/lib/apk/db/installed"
  for path in /etc/nginx/nginx.conf /etc/nginx/templates /usr/share/nginx/html/index.html; do
    [ -w "${path}" ] && present="${present} writable:${path}"
  done
  if [ -n "${present}" ]; then
    echo "forbidden runtime paths:${present}" >&2
    exit 1
  fi
' || fail "image contains a package manager, build evidence, an environment file, or writable config"

# Run as Kubernetes does: read-only root, no capabilities, writable /tmp only. The API upstream is a
# closed local port so /api/* must answer 502 from the proxy, not 200 from the SPA fallback.
docker run --detach \
  --name "${CONTAINER_NAME}" \
  --read-only \
  --tmpfs /tmp:uid=101,gid=101 \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --env ADMIN_API_UPSTREAM=http://127.0.0.1:9 \
  --publish 127.0.0.1::8080 \
  "${IMAGE_TAG}" >/dev/null

deadline=$((SECONDS + 60))
while (( SECONDS < deadline )); do
  container_health="$(docker inspect "${CONTAINER_NAME}" --format '{{.State.Health.Status}}')"
  case "${container_health}" in
    healthy) break ;;
    unhealthy) fail "container became unhealthy" ;;
  esac
  sleep 1
done
[[ "${container_health:-}" == "healthy" ]] || fail "container did not become healthy within 60 seconds"

published_port="$(docker port "${CONTAINER_NAME}" 8080/tcp | awk -F: 'NR == 1 { print $NF }')"
[[ -n "${published_port}" ]] || fail "container port 8080 was not published"

root_status="$(fetch / root)"
[[ "${root_status}" == "200" ]] || fail "index returned HTTP ${root_status}"
[[ "$(header_value root cache-control)" == "no-cache" ]] || fail "index must be served with Cache-Control: no-cache"

deep_status="$(fetch '/console/preferences?tab=display' deep)"
[[ "${deep_status}" == "200" ]] || fail "deep link returned HTTP ${deep_status}, expected SPA fallback 200"
cmp -s "${TMP_DIR}/root.body" "${TMP_DIR}/deep.body" || fail "deep link did not render index.html"
[[ "$(header_value deep cache-control)" == "no-cache" ]] || fail "SPA fallback must be served with Cache-Control: no-cache"

asset_path="$(grep -o '/assets/[A-Za-z0-9._-]*\.js' "${TMP_DIR}/root.body" | head -n 1)"
[[ -n "${asset_path}" ]] || fail "index.html does not reference a hashed module asset"
asset_status="$(fetch "${asset_path}" asset)"
[[ "${asset_status}" == "200" ]] || fail "hashed asset ${asset_path} returned HTTP ${asset_status}"
[[ "$(header_value asset cache-control)" == "public, max-age=31536000, immutable" ]] \
  || fail "hashed assets must be immutable"
[[ "$(header_value asset content-type)" == application/javascript* ]] || fail "module asset has the wrong Content-Type"

missing_asset_status="$(fetch /assets/missing-0000.js missing-asset)"
[[ "${missing_asset_status}" == "404" ]] || fail "missing asset returned HTTP ${missing_asset_status}, expected 404"

manifest_status="$(fetch /.vite/manifest.json manifest)"
[[ "${manifest_status}" == "404" ]] || fail "build manifest returned HTTP ${manifest_status}, expected 404"

api_status="$(fetch /api/v1/operator/session api)"
[[ "${api_status}" == "502" ]] || fail "/api/* returned HTTP ${api_status}, expected the proxy's 502 for a closed upstream"

python3 - "${TMP_DIR}/deep.headers" <<'PY'
import sys

expected = {
    "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    "cross-origin-opener-policy": "same-origin",
    "permissions-policy": "browsing-topics=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    "referrer-policy": "strict-origin-when-cross-origin",
    "strict-transport-security": "max-age=31536000",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "x-permitted-cross-domain-policies": "none",
}

observed: dict[str, list[str]] = {}
with open(sys.argv[1], encoding="utf-8") as handle:
    for raw_line in handle:
        line = raw_line.rstrip("\r\n")
        if not line or line.startswith("HTTP/") or ":" not in line:
            continue
        name, value = line.split(":", 1)
        observed.setdefault(name.lower(), []).append(value.strip())

failures = []
for name, value in expected.items():
    values = observed.get(name, [])
    if values != [value]:
        failures.append(f"{name}={values!r}, expected {[value]!r}")
if observed.get("server", [""])[0] not in ("", "nginx"):
    failures.append(f"server header discloses a version: {observed['server']!r}")

if failures:
    raise SystemExit("browser security response mismatch: " + "; ".join(failures))

print(f"validated {len(expected)} browser security response headers")
PY

docker stop --time 15 "${CONTAINER_NAME}" >/dev/null
exit_code="$(docker inspect "${CONTAINER_NAME}" --format '{{.State.ExitCode}}')"
oom_killed="$(docker inspect "${CONTAINER_NAME}" --format '{{.State.OOMKilled}}')"
[[ "${oom_killed}" == "false" ]] || fail "container was OOM-killed"
[[ "${exit_code}" == "0" ]] || fail "container exited with code ${exit_code} after graceful stop"

image_size="$(docker image inspect "${IMAGE_TAG}" --format '{{.Size}}')"
printf 'admin container image: %s bytes\n' "${image_size}"
printf 'admin container user: %s\n' "${image_user}"
printf 'admin container health: %s\n' "${container_health}"
printf 'SPA deep-link fallback: %s\n' "${deep_status}"
printf 'hashed asset: %s immutable\n' "${asset_status}"
printf 'missing asset / manifest: %s / %s\n' "${missing_asset_status}" "${manifest_status}"
printf 'api proxy (closed upstream): %s\n' "${api_status}"
printf 'browser security headers: 8 verified\n'
printf 'package manager/env/writable config: absent\n'
printf 'graceful stop exit code: %s\n' "${exit_code}"
printf 'build metadata SHA-256: %s\n' "$(sha256_file "${BUILD_METADATA_OUTPUT}")"
