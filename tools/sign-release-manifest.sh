#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 3 ]]; then
  echo "Usage: $0 <private-key-file> <namespace> <manifest> [manifest ...]" >&2
  exit 2
fi

private_key="$1"
namespace="$2"
shift 2

case "$namespace" in
  oore-release-manifest@oore.build|oore-release-index@oore.build) ;;
  *)
    echo "Unsupported Oore release signature namespace: $namespace" >&2
    exit 2
    ;;
esac

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pinned_key_file="$root_dir/tools/release-signing-key.pub"
signer_identity='release@oore.build'
temporary="$(mktemp -d "${TMPDIR:-/tmp}/oore-release-sign.XXXXXX")"
trap 'rm -rf "$temporary"' EXIT

for command_name in ssh-keygen awk chmod rm mktemp; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "$command_name is required to sign an Oore release manifest." >&2
    exit 1
  }
done

[[ -f "$private_key" && ! -L "$private_key" ]] || {
  echo "The release signing key must be a regular file." >&2
  exit 1
}
[[ -f "$pinned_key_file" && ! -L "$pinned_key_file" ]] || {
  echo "The pinned release signing public key is missing." >&2
  exit 1
}

normalize_public_key() {
  awk 'NF >= 2 && $1 == "ssh-ed25519" { print $1 " " $2; found = 1; exit } END { if (!found) exit 1 }' "$1"
}

derived_key_file="$temporary/derived.pub"
ssh-keygen -y -f "$private_key" > "$derived_key_file" 2>/dev/null || {
  echo "The release signing secret is not a readable OpenSSH private key." >&2
  exit 1
}
derived_key="$(normalize_public_key "$derived_key_file")" || {
  echo "The release signing secret does not contain an Ed25519 key." >&2
  exit 1
}
pinned_key="$(normalize_public_key "$pinned_key_file")" || {
  echo "The repository has no configured Ed25519 release signing public key." >&2
  exit 1
}
[[ "$derived_key" == "$pinned_key" ]] || {
  echo "The release signing secret does not match the pinned public key." >&2
  exit 1
}

allowed_signers="$temporary/allowed-signers"
printf '%s namespaces="%s" %s\n' \
  "$signer_identity" "$namespace" "$pinned_key" > "$allowed_signers"
chmod 0600 "$allowed_signers"

for manifest in "$@"; do
  [[ -f "$manifest" && ! -L "$manifest" ]] || {
    echo "Release manifest is not a regular file: $manifest" >&2
    exit 1
  }
  rm -f "$manifest.sig"
  ssh-keygen -Y sign -f "$private_key" -n "$namespace" "$manifest" >/dev/null
  [[ -f "$manifest.sig" && ! -L "$manifest.sig" ]] || {
    echo "Release signature was not created: $manifest.sig" >&2
    exit 1
  }
  ssh-keygen -Y verify \
    -f "$allowed_signers" \
    -I "$signer_identity" \
    -n "$namespace" \
    -s "$manifest.sig" \
    < "$manifest" >/dev/null 2>&1 || {
      echo "Release signature self-check failed: $manifest" >&2
      exit 1
    }
done
