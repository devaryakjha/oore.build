#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 1 ]]; then
  echo "Usage: $0 <release-tag>" >&2
  exit 2
fi

tag="$1"
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workspace_version="$(awk '
  $0 == "[workspace.package]" { inside = 1; next }
  inside && /^\[/ { exit }
  inside && /^[[:space:]]*version[[:space:]]*=/ {
    value = $0
    sub(/^[^=]*=[[:space:]]*"/, "", value)
    sub(/"[[:space:]]*$/, "", value)
    print value
    exit
  }
' "$root_dir/Cargo.toml")"

[[ "$workspace_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  echo "Cargo.toml has no valid workspace package version." >&2
  exit 1
}
if [[ "$tag" =~ ^v([0-9]+\.[0-9]+\.[0-9]+)(-(alpha|beta)\.[0-9]+)?$ ]]; then
  tag_base="${BASH_REMATCH[1]}"
elif [[ "$tag" =~ ^v([0-9]+\.[0-9]+\.[0-9]+)-dev$ ]]; then
  tag_base="${BASH_REMATCH[1]}"
  [[ "${OORE_ALLOW_DEV_RELEASE_TAG_FOR_LOCAL_ACCEPTANCE:-}" == true \
    && "${OORE_ALLOW_UNSIGNED_LOCAL_RELEASE:-}" == true \
    && "${GITHUB_ACTIONS:-}" != true ]] || {
    echo "The -dev release tag requires both local acceptance flags and is disabled in GitHub Actions." >&2
    exit 1
  }
else
  echo "Release tag must use vX.Y.Z, vX.Y.Z-alpha.N, or vX.Y.Z-beta.N: $tag" >&2
  exit 1
fi

[[ "$tag_base" == "$workspace_version" ]] || {
  echo "Release tag base $tag_base does not match workspace version $workspace_version." >&2
  exit 1
}
