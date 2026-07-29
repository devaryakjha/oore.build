#!/usr/bin/env bash
set -euo pipefail

failures=()

require_result() {
  local name="$1"
  local result="$2"
  shift 2

  local allowed
  for allowed in "$@"; do
    if [[ "$result" == "$allowed" ]]; then
      return
    fi
  done

  failures+=("${name}=${result:-missing}")
}

require_result changes "${CHANGES_RESULT:-}" success
require_result frontend "${FRONTEND_RESULT:-}" success skipped
require_result docs "${DOCS_RESULT:-}" success skipped
require_result rust "${RUST_RESULT:-}" success skipped

if ((${#failures[@]} > 0)); then
  printf 'Required validation failed: %s\n' "${failures[*]}" >&2
  exit 1
fi

printf 'Required validation passed (frontend=%s, docs=%s, rust=%s).\n' \
  "$FRONTEND_RESULT" "$DOCS_RESULT" "$RUST_RESULT"
