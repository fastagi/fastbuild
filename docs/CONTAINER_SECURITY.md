# Container Supply-Chain Security

FastBuild treats each production image as a deployable artifact with four distinct controls: immutable
build inputs, runtime verification, image inventory and vulnerability policy, and downstream
publication identity. These controls complement the source dependency policy in
[`DEPENDENCY_SECURITY.md`](DEPENDENCY_SECURITY.md); one must not be presented as another.

This policy applies to the API, Next.js Web, and Admin Console images. `admin/` emits static
assets that may be hosted on OSS/CDN without any container, or served by its optional static nginx
image; both options, and the cache and header contract, live in
[`../admin/docs/DEPLOYMENT.md`](../admin/docs/DEPLOYMENT.md).

## Semantic Model

| Term | Repository evidence | Guarantee |
|---|---|---|
| Base image identity | Exact tag plus multi-platform `sha256` index digest in each `Dockerfile` | A build cannot silently consume a different base under the same tag. |
| Build evidence | Buildx metadata JSON emitted with maximal BuildKit provenance | Records the output digest, Dockerfile entry point, invocation, and reviewed material digests. |
| Image SBOM | Trivy CycloneDX 1.7 JSON | Inventories the packages visible in the built runtime image, not merely source lockfiles. |
| Vulnerability gate | Trivy 0.72.0 image scan | Fails on HIGH/CRITICAL vulnerabilities, detected secrets, or a known end-of-life base OS. |
| Publication signature | Downstream registry plus Cosign/OIDC policy | Binds a pushed registry digest to a trusted publishing identity. FastBuild does not invent that identity. |

Build metadata and an SBOM are evidence about an artifact. They are not signatures. The CI artifacts
in this repository are deliberately **unsigned** validation outputs retained for 14 days. A
downstream application that publishes an image must attach provenance/SBOM evidence to its registry
digest and apply its own Cosign identity and verification policy.

## Immutable Build Inputs

Every Dockerfile pins the Dockerfile frontend and every external `FROM` to an exact readable tag
plus the reviewed multi-platform digest:

- API builder: Go 1.26.10 on Alpine 3.24;
- API runtime: distroless static Debian 12 `nonroot`;
- Web build/runtime source: Node 22.23.3 on Alpine 3.24;
- Admin builder: the same Node 22.23.3 Alpine 3.24 image;
- Admin runtime source: `nginxinc/nginx-unprivileged` 1.30.6 slim on Alpine 3.24.

The Web final image materializes a cleaned runtime root into a new `scratch` stage. apk, npm, npx,
Corepack, pnpm, Yarn, Node build headers, debugger helpers, and manual pages are absent from the
resulting filesystem, while the Node and native Sharp artifacts keep the same musl ABI used during
the build. This removes development attack surface without creating an Alpine/glibc runtime mismatch.

The Admin final image applies the same `scratch` copy to the nginx runtime: the apk binary and its
repository configuration, the stock site, and the stock server config are removed, while the
installed-package database stays so Trivy can inventory OS packages. nginx configuration,
templates, and the built assets are root-owned and read-only, and nginx runs as UID 101 with only
`/tmp` writable. No Node.js runtime ships in it.

Dependabot discovers Docker updates monthly and opens security updates as soon as they are published. A base-image update is not complete until the tag,
Dockerfile digest, verifier material digest, governance constant, smoke test, and image scan change
together. A digest-only update still requires release-note and image-diff review.

## Local Verification

Build and exercise each runtime contract:

```bash
cd api && make container-check
cd web && bash scripts/verify-container.sh fastbuild-web:container-check
cd admin && bash scripts/verify-container.sh fastbuild-admin:container-check
```

The verifiers use `docker buildx build --load`, write OCI source/revision/version labels, request
maximal BuildKit metadata, and check that provenance contains every reviewed material digest. They
then verify non-root execution, health behavior, absence of embedded environment files, and bounded
SIGTERM termination. The Web verifier additionally checks the exact Node version and confirms that
development tooling and every `.env*` file are absent. It also requests the real `/login` page and
requires all nine production browser-security headers exactly once; policy ownership and downstream
extension rules live in [`../web/docs/SECURITY.md`](../web/docs/SECURITY.md). A second run enables
the production mock mode explicitly and proves the assembled Next.js Proxy redirects an
unauthenticated protected route before render work. The Admin verifier runs the image with a
read-only root filesystem and all capabilities dropped, then checks the SPA deep-link fallback,
immutable hashed-asset and revalidated HTML cache headers, `404` for missing assets and the build
manifest, that `/api/*` reaches the proxy rather than the fallback, the exact browser-security header
set, and the absence of apk and `.env*` files.

Scan an already-built image and export its image-level SBOM:

```bash
IMAGE=fastbuild-api:container-check make container-scan
IMAGE=fastbuild-api:container-check make container-sbom

IMAGE=fastbuild-web:container-check make container-scan
SBOM_OUTPUT="$PWD/fastbuild-web.cdx.json" IMAGE=fastbuild-web:container-check make container-sbom

IMAGE=fastbuild-admin:container-check make container-scan
```

`scripts/container-security.sh` downloads the official Trivy 0.72.0 archive over HTTPS, verifies a
reviewed platform-specific SHA-256, and re-extracts the executable from that verified archive on
every run. The vulnerability database remains live by design; do not describe a successful scan as
permanent evidence against advisories published later.

Image SBOM identity is portable across Docker stores: the validator requires a named container
subject, the requested image in Trivy `Reference`/`RepoTag`, and a SHA-256 Trivy `ImageID`. An OCI
`purl` is validated when a registry or containerd store provides one, but it is not fabricated for
standard daemon-local images.

`make check` runs the deterministic container governance rules, but intentionally does not build or
network-scan images. The dedicated image workflows own those Docker- and network-backed gates.

## CI Evidence

`.github/workflows/container.yml` builds, smoke-tests, inventories, and scans the API image before
running Compose scenarios. `.github/workflows/web-container.yml` and
`.github/workflows/admin-container.yml` apply the same image contract to the Web and Admin
deployables. Each read-only workflow uploads two files keyed by the exact Git commit:

- `<unit>.build-metadata.json`, containing the output digest and maximal BuildKit material evidence;
- `<unit>.cdx.json`, containing the CycloneDX 1.7 runtime inventory and recorded advisories.

Artifacts remain available for 14 days and upload even when the scan step fails, unless the job is
cancelled. This preserves evidence needed to diagnose a failed gate. A green source dependency scan
does not replace these image scans because OS packages and runtime-only content do not live in
`go.mod` or `pnpm-lock.yaml`.

## Scan Policy And Exceptions

The blocking policy covers HIGH/CRITICAL vulnerabilities, secrets, and known EOL operating systems.
It does not pass `--ignore-unfixed`: remediation availability changes urgency, not the existence of a
finding. Lower-severity findings remain visible in the SBOM for review without turning every advisory
database update into an unplanned release stop.

The default [`.trivyignore.yaml`](../.trivyignore.yaml) is empty. A temporary exception must name one
exact finding `id` and include both a non-empty `statement` and a future `expired_at` date. Wildcards,
severity-wide suppression, non-expiring entries, and scanner failures are forbidden. Root governance
rejects incomplete, duplicate, wildcard, or expired entries. Prefer upgrading or removing the
affected runtime content.

## Downstream Publication Boundary

FastBuild does not choose a registry, cloud identity, release environment, or trust root, and does not
publish images. Each FastBuild release attaches the dependency and image SBOMs with build provenance
attestations ([`VERSIONING.md`](VERSIONING.md)). A downstream publisher should:

1. Build once and push by digest with registry-supported maximal provenance and SBOM attestations.
2. Sign the immutable registry digest through Cosign keyless OIDC or an organization-owned key.
3. Verify issuer, subject/workflow identity, repository, and digest at deployment admission.
4. Deploy the digest, not a mutable tag; keep the tag only as a human release pointer.
5. Retain evidence according to the downstream incident-response and compliance policy.

Maximal provenance records build arguments and invocation details. Never pass credentials through
`ARG` or ordinary build environment values. Use BuildKit secret/SSH mounts for build-only secrets and
runtime secret injection for application credentials.

## Update Procedure

1. Review official release notes and the exact multi-platform image index or scanner assets.
2. Update readable versions and digests together; never replace a digest with a movable tag.
3. Update verifier material expectations and `check-container-supply-chain.py` in the same change.
4. Build and run every affected image, export their SBOMs, and enforce the live scan.
5. Run `make check`; it includes deterministic container governance.
6. Push the exact commit, inspect both workflow logs and artifacts, and confirm no warning was hidden
   behind a successful status.
