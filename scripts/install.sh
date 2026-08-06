#!/usr/bin/env bash
set -euo pipefail

OORE_VERSION="${OORE_VERSION:-latest}"
OORE_CHANNEL="${OORE_CHANNEL:-stable}"
OORE_INSTALL_ROOT="${OORE_INSTALL_ROOT:-$HOME/.oore}"
OORE_GITHUB_REPO="${OORE_GITHUB_REPO:-oore-ci/oore.build}"
OORE_RELEASE_INDEX_BASE_URL="${OORE_RELEASE_INDEX_BASE_URL:-https://releases.oore.build}"
OORE_MACHINE_ROLE="${OORE_MACHINE_ROLE:-}"
OORE_COMPONENTS="${OORE_COMPONENTS:-}"

TEMPORARY_DIRECTORY=""
RELEASE_TAG=""
RELEASE_VERSION=""
RELEASE_ARCH=""
RELEASE_CHANNEL=""

log() {
  printf '[oore-install] %s\n' "$*"
}

die() {
  printf '[oore-install] Error: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  if [[ -n "$TEMPORARY_DIRECTORY" && -d "$TEMPORARY_DIRECTORY" ]]; then
    rm -rf "$TEMPORARY_DIRECTORY"
  fi
}

print_help() {
  cat <<'EOF'
Oore fallback installer

Use a native Oore package when one is available for your system.

Usage:
  ./scripts/install.sh [--role <ROLE>] [--component <ID>]

Roles:
  local-oore  Install Oore and a local runner.
  runner      Install only a runner.
  shell-only  Install only the Oore control shell.
  advanced    Select components with repeated --component options.

Environment:
  OORE_VERSION       Release tag or latest.
  OORE_CHANNEL       stable, beta, or alpha.
  OORE_INSTALL_ROOT  Install root. The default is ~/.oore.
  OORE_MACHINE_ROLE  Role for noninteractive use.
  OORE_COMPONENTS    Comma-separated advanced component IDs.
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required."
}

validate_channel() {
  case "$OORE_CHANNEL" in
    stable|beta|alpha) ;;
    *) die 'OORE_CHANNEL must be stable, beta, or alpha.' ;;
  esac
}

detect_platform() {
  [[ "$(uname -s)" == "Darwin" ]] \
    || die 'Use a native Linux package. This fallback archive currently supports macOS only.'
  case "$(uname -m)" in
    arm64|aarch64) RELEASE_ARCH="arm64" ;;
    x86_64|amd64) RELEASE_ARCH="x86_64" ;;
    *) die "Unsupported macOS architecture: $(uname -m)" ;;
  esac
}

resolve_release() {
  if [[ "$OORE_VERSION" != "latest" ]]; then
    RELEASE_TAG="$OORE_VERSION"
    [[ "$RELEASE_TAG" == v* ]] || RELEASE_TAG="v$RELEASE_TAG"
    [[ "$RELEASE_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta)\.[0-9]+)?$ ]] \
      || die 'OORE_VERSION must be an exact Oore release version.'
    RELEASE_VERSION="${RELEASE_TAG#v}"
    set_release_channel
    return 0
  fi

  local manifest="$TEMPORARY_DIRECTORY/release.json"
  local manifest_url="$OORE_RELEASE_INDEX_BASE_URL/latest/$OORE_CHANNEL.json"
  curl -fsSL --retry 3 --connect-timeout 10 --max-time 60 \
    --output "$manifest" "$manifest_url" \
    || die "Could not download the $OORE_CHANNEL release record."
  RELEASE_TAG="$(sed -n 's/^[[:space:]]*"tag"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$manifest" | head -n1)"
  RELEASE_VERSION="$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$manifest" | head -n1)"
  [[ "$RELEASE_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta)\.[0-9]+)?$ ]] \
    || die 'The release record contains an invalid tag.'
  [[ "${RELEASE_TAG#v}" == "$RELEASE_VERSION" ]] \
    || die 'The release record contains mismatched version fields.'
  set_release_channel
  [[ "$RELEASE_CHANNEL" == "$OORE_CHANNEL" ]] \
    || die 'The release record belongs to a different channel.'
}

set_release_channel() {
  case "$RELEASE_TAG" in
    *-alpha.*) RELEASE_CHANNEL="alpha" ;;
    *-beta.*) RELEASE_CHANNEL="beta" ;;
    *) RELEASE_CHANNEL="stable" ;;
  esac
}

download_release() {
  local asset="oore_${RELEASE_VERSION}_darwin_${RELEASE_ARCH}.tar.gz"
  local checksums="oore_${RELEASE_VERSION}_checksums.txt"
  local base="https://github.com/$OORE_GITHUB_REPO/releases/download/$RELEASE_TAG"
  curl -fsSL --retry 3 --connect-timeout 10 --max-time 600 \
    --output "$TEMPORARY_DIRECTORY/$asset" "$base/$asset" \
    || die "Could not download $asset."
  curl -fsSL --retry 3 --connect-timeout 10 --max-time 60 \
    --output "$TEMPORARY_DIRECTORY/$checksums" "$base/$checksums" \
    || die "Could not download $checksums."
}

sha256_file() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    sha256sum "$1" | awk '{print $1}'
  fi
}

verify_release() {
  local asset="oore_${RELEASE_VERSION}_darwin_${RELEASE_ARCH}.tar.gz"
  local checksums="$TEMPORARY_DIRECTORY/oore_${RELEASE_VERSION}_checksums.txt"
  local expected=""
  local actual=""
  expected="$(awk -v file="$asset" '$2 == file || $2 == "*" file {print $1}' "$checksums")"
  [[ "$expected" =~ ^[0-9a-fA-F]{64}$ ]] || die "The checksum for $asset is missing or invalid."
  actual="$(sha256_file "$TEMPORARY_DIRECTORY/$asset")"
  [[ "$actual" == "$expected" ]] || die "The checksum for $asset does not match."
}

extract_release() {
  local asset="oore_${RELEASE_VERSION}_darwin_${RELEASE_ARCH}.tar.gz"
  local destination="$TEMPORARY_DIRECTORY/release"
  local entries="$TEMPORARY_DIRECTORY/archive-entries.txt"
  mkdir -p "$destination"
  tar -tzf "$TEMPORARY_DIRECTORY/$asset" > "$entries"
  [[ -z "$(sort "$entries" | uniq -d)" ]] || die 'The release contains duplicate paths.'
  while IFS= read -r entry; do
    case "$entry" in
      /*|../*|*/../*|*/..) die "The release contains an unsafe path: $entry" ;;
    esac
  done < "$entries"
  if tar -tvzf "$TEMPORARY_DIRECTORY/$asset" \
    | awk 'substr($1, 1, 1) != "-" && substr($1, 1, 1) != "d" {found=1} END {exit found ? 0 : 1}'; then
    die 'The release contains a link or a special file.'
  fi
  tar -xzf "$TEMPORARY_DIRECTORY/$asset" -C "$destination"

  local required=""
  for required in bin/oore bin/oore-core bin/oored bin/oore-web VERSION INSTALL_SOURCE INSTALL_SCOPE; do
    [[ -f "$destination/$required" && ! -L "$destination/$required" ]] \
      || die "The release is missing $required."
  done
  [[ -d "$destination/web-dist" && ! -L "$destination/web-dist" ]] \
    || die 'The release is missing web-dist.'
  [[ "$(< "$destination/VERSION")" == "$RELEASE_VERSION" ]] \
    || die 'The release VERSION does not match the selected release.'
  [[ "$(< "$destination/INSTALL_SOURCE")" == "archive" ]] \
    || die 'The release install source is invalid.'
  [[ "$(< "$destination/INSTALL_SCOPE")" == "user" ]] \
    || die 'The release install scope is invalid.'
}

install_file() {
  local source="$1"
  local destination="$2"
  local mode="$3"
  local staged="${destination}.install.$$"
  install -m "$mode" "$source" "$staged"
  mv -f "$staged" "$destination"
}

install_release() {
  local release="$TEMPORARY_DIRECTORY/release"
  local bin="$OORE_INSTALL_ROOT/bin"
  mkdir -p "$bin" "$OORE_INSTALL_ROOT/libexec"

  install_file "$release/bin/oore" "$bin/oore" 0755
  install_file "$release/bin/oore-core" "$bin/oore-core" 0755
  install_file "$release/bin/oored" "$bin/oored" 0755
  install_file "$release/bin/oore-web" "$bin/oore-web" 0755
  if [[ -f "$release/bin/fvm" && -d "$release/libexec/fvm" ]]; then
    install_file "$release/bin/fvm" "$bin/fvm" 0755
    rm -rf "$OORE_INSTALL_ROOT/libexec/fvm"
    cp -R "$release/libexec/fvm" "$OORE_INSTALL_ROOT/libexec/fvm"
  fi
  rm -rf "$OORE_INSTALL_ROOT/web-dist"
  cp -R "$release/web-dist" "$OORE_INSTALL_ROOT/web-dist"

  install_file "$release/VERSION" "$OORE_INSTALL_ROOT/VERSION" 0644
  install_file "$release/INSTALL_SOURCE" "$OORE_INSTALL_ROOT/INSTALL_SOURCE" 0644
  install_file "$release/INSTALL_SCOPE" "$OORE_INSTALL_ROOT/INSTALL_SCOPE" 0644
  printf '%s\n' "$RELEASE_CHANNEL" > "$OORE_INSTALL_ROOT/CHANNEL"
  printf '%s\n' "$OORE_GITHUB_REPO" > "$OORE_INSTALL_ROOT/GITHUB_REPO"
  if [[ -f "$release/LICENSE" ]]; then
    install_file "$release/LICENSE" "$OORE_INSTALL_ROOT/LICENSE" 0644
  fi
}

install_or_update_release() {
  local release="$TEMPORARY_DIRECTORY/release"
  if [[ -x "$OORE_INSTALL_ROOT/bin/oore" && -f "$OORE_INSTALL_ROOT/VERSION" ]]; then
    log 'Updating the existing installation with its rollback-safe updater.'
    OORE_INSTALL_ROOT="$OORE_INSTALL_ROOT" \
      "$release/bin/oore" update \
        --staged-release "$release" \
        --channel "$RELEASE_CHANNEL" \
        --repo "$OORE_GITHUB_REPO" \
        --force
    return 0
  fi
  install_release
}

run_machine_plan() {
  local role="$1"
  shift
  local -a arguments=()
  [[ -z "$role" ]] || arguments+=(--role "$role")
  while [[ $# -gt 0 ]]; do
    arguments+=(--component "$1")
    shift
  done
  OORE_INSTALL_ROOT="$OORE_INSTALL_ROOT" "$OORE_INSTALL_ROOT/bin/oore" install "${arguments[@]}"
}

main() {
  local role="$OORE_MACHINE_ROLE"
  local -a components=()
  if [[ -n "$OORE_COMPONENTS" ]]; then
    IFS=',' read -r -a components <<< "$OORE_COMPONENTS"
  fi

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h|--help) print_help; return 0 ;;
      --role)
        shift
        [[ $# -gt 0 ]] || die '--role needs a value.'
        role="$1"
        ;;
      --component)
        shift
        [[ $# -gt 0 ]] || die '--component needs a value.'
        components+=("$1")
        ;;
      *) die "Unknown argument: $1 (use --help)" ;;
    esac
    shift
  done

  validate_channel
  detect_platform
  for command in curl tar awk uname mktemp install sed sort uniq; do
    require_command "$command"
  done
  if ! command -v shasum >/dev/null 2>&1 && ! command -v sha256sum >/dev/null 2>&1; then
    die 'shasum or sha256sum is required.'
  fi
  [[ "$OORE_INSTALL_ROOT" == /* ]] || die 'OORE_INSTALL_ROOT must be an absolute path.'
  [[ "$OORE_INSTALL_ROOT" != "/" && "$OORE_INSTALL_ROOT" != "$HOME" ]] \
    || die 'OORE_INSTALL_ROOT is too broad.'
  [[ "$OORE_INSTALL_ROOT" != *"//"* \
    && "$OORE_INSTALL_ROOT" != *"/../"* \
    && "$OORE_INSTALL_ROOT" != *"/./"* \
    && "$OORE_INSTALL_ROOT" != */.. \
    && "$OORE_INSTALL_ROOT" != */. \
    && "$OORE_INSTALL_ROOT" != */ ]] \
    || die 'OORE_INSTALL_ROOT must be a normalized path.'
  [[ ! -L "$OORE_INSTALL_ROOT" ]] || die 'OORE_INSTALL_ROOT cannot be a symbolic link.'
  [[ "$OORE_GITHUB_REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] \
    || die 'OORE_GITHUB_REPO must use owner/name format.'

  TEMPORARY_DIRECTORY="$(mktemp -d)"
  trap cleanup EXIT

  resolve_release
  log "Downloading $RELEASE_TAG for macOS $RELEASE_ARCH."
  download_release
  verify_release
  log 'The release checksum is correct.'
  extract_release
  install_or_update_release
  run_machine_plan "$role" "${components[@]}"

  printf '\nOore is installed at %s.\n' "$OORE_INSTALL_ROOT"
  if [[ ":$PATH:" != *":$OORE_INSTALL_ROOT/bin:"* ]]; then
    printf 'Add %s/bin to PATH.\n' "$OORE_INSTALL_ROOT"
  fi
  printf 'The browser will handle product setup after the selected services start.\n'
}

main "$@"
