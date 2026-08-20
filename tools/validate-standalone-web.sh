#!/usr/bin/env bash
set -euo pipefail

launcher_dir="$(mktemp -d "${TMPDIR:-/tmp}/oore-web-launcher.XXXXXX")"
trap 'rm -rf -- "$launcher_dir"' EXIT
launcher="$launcher_dir/oore-web-native"
bun build --compile --outfile "$launcher" apps/web/tools/oore-web.js
chmod +x "$launcher"
if [[ "$(uname -s)" == Darwin ]]; then
  command -v codesign >/dev/null 2>&1 || {
    echo 'codesign is required to validate the standalone launcher on macOS.' >&2
    exit 1
  }
  codesign --force --sign - "$launcher"
fi

"$launcher" validate-config \
  --listen 100.64.10.30:4174 \
  --backend-url http://100.64.10.20:8787 \
  --browser-transport-protected \
  --backend-transport-protected \
  --dist-dir apps/web/dist

if "$launcher" validate-config \
  --listen 100.64.10.30:4174 \
  --backend-url http://100.64.10.20:8787 \
  --browser-transport-protected \
  --dist-dir apps/web/dist; then
  echo 'Standalone launcher accepted an unprotected remote HTTP backend.' >&2
  exit 1
fi

if "$launcher" validate-config \
  --listen 100.64.10.30:4174 \
  --backend-url http://100.64.10.20:8787 \
  --backend-transport-protected \
  --dist-dir apps/web/dist; then
  echo 'Standalone launcher accepted an unprotected non-loopback listener.' >&2
  exit 1
fi
