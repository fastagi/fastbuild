#!/bin/sh
# Create the writable render target for the envsubst entrypoint; /tmp is the only writable path.
set -eu
mkdir -p "${NGINX_ENVSUBST_OUTPUT_DIR:-/tmp/nginx}"
