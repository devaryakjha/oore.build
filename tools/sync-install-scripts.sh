#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_DIR="$ROOT_DIR/apps/site/public"

mkdir -p "$PUBLIC_DIR"

sync_one() {
  local src="$1"
  local dst="$2"

  if [[ ! -f "$src" ]]; then
    echo "[sync-install] ERROR: source script not found: $src" >&2
    exit 1
  fi

  cp "$src" "$dst"
  chmod +x "$dst"
  echo "[sync-install] synced $(realpath "$dst" 2>/dev/null || echo "$dst")"
}

sync_installer() {
  local src="$ROOT_DIR/scripts/install.sh"
  local dst="$PUBLIC_DIR/install"
  local key_file="$ROOT_DIR/tools/release-signing-key.pub"
  local public_key=""

  [[ -f "$src" ]] || {
    echo "[sync-install] ERROR: source script not found: $src" >&2
    exit 1
  }
  [[ -f "$key_file" && ! -L "$key_file" ]] || {
    echo "[sync-install] ERROR: release signing key pin not found: $key_file" >&2
    exit 1
  }
  command -v ssh-keygen >/dev/null 2>&1 || {
    echo "[sync-install] ERROR: ssh-keygen is required to validate the release signing key pin." >&2
    exit 1
  }
  if ! awk '
    NF == 0 || $1 ~ /^#/ { next }
    $1 == "ssh-ed25519" && NF >= 2 { count += 1; next }
    { invalid = 1 }
    END { exit(invalid || count != 1) }
  ' "$key_file"; then
    echo "[sync-install] ERROR: configure exactly one Ed25519 release signing public key in $key_file" >&2
    exit 1
  fi
  if ! ssh-keygen -l -f "$key_file" >/dev/null 2>&1; then
    echo "[sync-install] ERROR: release signing public key is invalid: $key_file" >&2
    exit 1
  fi
  public_key="$(awk 'NF >= 2 && $1 == "ssh-ed25519" { print $1 " " $2; exit }' "$key_file")"

  sed "s|@OORE_RELEASE_SIGNING_PUBLIC_KEY@|$public_key|" "$src" > "$dst"
  chmod +x "$dst"
  echo "[sync-install] synced $(realpath "$dst" 2>/dev/null || echo "$dst")"
}

sync_installer
sync_one "$ROOT_DIR/scripts/uninstall.sh" "$PUBLIC_DIR/uninstall"
