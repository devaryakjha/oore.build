#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 2 ]]; then
  echo "Usage: $0 <entrypoint> <output-directory>" >&2
  exit 2
fi

entrypoint="$1"
output_dir="$2"

for command_name in awk bun chmod curl file install jq mkdir mktemp openssl rm tar; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "$command_name is required to compile the Oore web launchers." >&2
    exit 1
  }
done

[[ -f "$entrypoint" && ! -L "$entrypoint" ]] || {
  echo "The web launcher entrypoint must be a regular file: $entrypoint" >&2
  exit 1
}

mkdir -p "$output_dir"
[[ -d "$output_dir" && ! -L "$output_dir" ]] || {
  echo "The web launcher output must be a regular directory: $output_dir" >&2
  exit 1
}

bun_version="$(bun --version)"
pinned_bun_version=1.3.14
[[ "$bun_version" == "$pinned_bun_version" ]] || {
  echo "The release requires Bun $pinned_bun_version, but Bun reported $bun_version." >&2
  exit 1
}

temporary="$(mktemp -d "${TMPDIR:-/tmp}/oore-web-compile.XXXXXX")"
trap 'rm -rf -- "$temporary"' EXIT
mkdir -p "$temporary/downloads" "$temporary/runtimes" "$temporary/output"

target_runtime_package() {
  case "$1" in
    bun-darwin-arm64) printf '%s\n' bun-darwin-aarch64 ;;
    bun-darwin-x64) printf '%s\n' bun-darwin-x64 ;;
    bun-linux-arm64) printf '%s\n' bun-linux-aarch64 ;;
    bun-linux-x64) printf '%s\n' bun-linux-x64 ;;
    *)
      echo "Unsupported Oore web launcher target: $1" >&2
      return 1
      ;;
  esac
}

target_runtime_integrity() {
  case "$1" in
    bun-darwin-arm64)
      printf '%s\n' 'sha512-Omj20SuiHBOUjUBIyqtkNjSUIjOtEOJwmbix/ZyFH4BaQ6OZTaaRWIR4TjHVz0yadHgli6lLTiAh1uarnvD49A=='
      ;;
    bun-darwin-x64)
      printf '%s\n' 'sha512-FFj3QdU/OhlDyZOJ8CWfN5eWLpRlT4qjZg7lMQi7jA6GuoY5ajlO1zWLP/MuHYRSbXQUvV52RejNi8DVnAp13w=='
      ;;
    bun-linux-arm64)
      printf '%s\n' 'sha512-X5SsPZHs+iYO8R/efIcRtc7gT2Q2DgPfliCxEkx4cXBumwkw0c/EsHMNwH3EgGpCDaZ7IYVPhpCG/xBOQHEwZw=='
      ;;
    bun-linux-x64)
      printf '%s\n' 'sha512-7OVTAKvwfPmSbIV1HpdOoVVx5VRc427GuPPne93N6vk4eQBPId9nXmZDh9/zGaKPdbVjVtQSZafWQoUjx38Utw=='
      ;;
    *)
      echo "Unsupported Oore web launcher target: $1" >&2
      return 1
      ;;
  esac
}

require_target_binary() {
  local path="$1"
  local target="$2"
  local description

  [[ -f "$path" && ! -L "$path" ]] || {
    echo "Bun target package lacks a regular executable: $path" >&2
    return 1
  }

  description="$(file -b "$path")"
  case "$target" in
    bun-darwin-arm64) [[ "$description" == *"Mach-O 64-bit executable arm64"* ]] ;;
    bun-darwin-x64) [[ "$description" == *"Mach-O 64-bit executable x86_64"* ]] ;;
    bun-linux-arm64) [[ "$description" == *"ELF 64-bit LSB executable, ARM aarch64"* ]] ;;
    bun-linux-x64) [[ "$description" == *"ELF 64-bit LSB executable, x86-64"* ]] ;;
    *) return 1 ;;
  esac || {
    echo "Bun target package has the wrong executable type for $target: $description" >&2
    return 1
  }
}

fetch_target_runtime() {
  local target="$1"
  local package_name
  local metadata
  local metadata_name
  local metadata_version
  local tarball_url
  local integrity
  local pinned_integrity
  local expected_tarball_url
  local archive
  local actual_integrity
  local member_count
  local runtime_dir
  local runtime

  package_name="$(target_runtime_package "$target")"
  pinned_integrity="$(target_runtime_integrity "$target")"
  metadata="$temporary/downloads/$package_name.json"
  archive="$temporary/downloads/$package_name.tgz"
  runtime_dir="$temporary/runtimes/$package_name"
  runtime="$runtime_dir/package/bin/bun"

  curl --fail --location --retry 3 --retry-delay 1 --silent --show-error \
    "https://registry.npmjs.org/%40oven%2F${package_name}/${bun_version}" \
    --output "$metadata"

  IFS=$'\t' read -r metadata_name metadata_version tarball_url integrity < <(
    jq -er '[.name, .version, .dist.tarball, .dist.integrity] | @tsv' "$metadata"
  )
  expected_tarball_url="https://registry.npmjs.org/@oven/${package_name}/-/${package_name}-${bun_version}.tgz"
  [[ "$metadata_name" == "@oven/$package_name" \
    && "$metadata_version" == "$bun_version" \
    && "$tarball_url" == "$expected_tarball_url" \
    && "$integrity" == "$pinned_integrity" ]] || {
    echo "The npm registry returned unexpected metadata for @oven/$package_name@$bun_version." >&2
    return 1
  }

  curl --fail --location --retry 3 --retry-delay 1 --silent --show-error \
    "$tarball_url" \
    --output "$archive"
  actual_integrity="sha512-$(openssl dgst -sha512 -binary "$archive" | openssl base64 -A)"
  [[ "$actual_integrity" == "$pinned_integrity" ]] || {
    echo "The npm integrity check failed for @oven/$package_name@$bun_version." >&2
    return 1
  }

  member_count="$(tar -tzf "$archive" | awk '$0 == "package/bin/bun" { count++ } END { print count + 0 }')"
  [[ "$member_count" -eq 1 ]] || {
    echo "The Bun target package has an unexpected executable layout: @oven/$package_name@$bun_version." >&2
    return 1
  }

  mkdir -p "$runtime_dir"
  tar -xzf "$archive" -C "$runtime_dir" package/bin/bun
  chmod 0755 "$runtime"
  require_target_binary "$runtime" "$target"
  printf '%s\n' "$runtime"
}

targets=(
  bun-darwin-arm64
  bun-darwin-x64
  bun-linux-arm64
  bun-linux-x64
)
outputs=(
  oore-web-arm64
  oore-web-x86_64
  oore-web-linux-arm64
  oore-web-linux-x86_64
)

for index in "${!targets[@]}"; do
  target="${targets[$index]}"
  output_name="${outputs[$index]}"
  runtime="$(fetch_target_runtime "$target")"
  staged_output="$temporary/output/$output_name"

  echo "Compiling $output_name with @oven/$(target_runtime_package "$target")@$bun_version"
  bun build \
    --compile \
    --target="$target" \
    --compile-executable-path="$runtime" \
    --outfile "$staged_output" \
    "$entrypoint"
  chmod 0755 "$staged_output"
  require_target_binary "$staged_output" "$target"
done

for output_name in "${outputs[@]}"; do
  [[ ! -L "$output_dir/$output_name" ]] || {
    echo "Refusing to replace a symbolic link: $output_dir/$output_name" >&2
    exit 1
  }
  install -m 0755 "$temporary/output/$output_name" "$output_dir/$output_name"
done
