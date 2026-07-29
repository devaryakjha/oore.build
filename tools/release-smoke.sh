#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

print_live_acceptance() {
  local dependency
  for dependency in \
    'credentialed macOS runner' \
    'signing' \
    'source provider' \
    'object storage' \
    'email' \
    'external network' \
    'assistive technology' \
    'actual device'; do
    printf '[live acceptance] NOT RUN: %s\n' "$dependency"
  done
}

finish() {
  local status=$?
  if [[ "$status" -eq 0 ]]; then
    echo '[release-smoke] Hermetic release acceptance passed.'
  else
    echo '[release-smoke] Hermetic release acceptance failed.' >&2
  fi
  print_live_acceptance
}
trap finish EXIT

echo '[release-smoke] Running hermetic release acceptance...'
make test-release-automation
make test-install
make test-release-upgrade
make test-release-artifacts
