#!/usr/bin/env bash
set -euo pipefail

install_root="${OORE_INSTALL_ROOT:-${HOME:?HOME is required}/.oore}"

die() {
  printf 'Oore uninstall failed: %s\n' "$*" >&2
  exit 1
}

case "$install_root" in
  /*) ;;
  *) die 'OORE_INSTALL_ROOT must be an absolute path.' ;;
esac
[[ "$install_root" != *:* ]] || die 'OORE_INSTALL_ROOT cannot contain a colon.'
[[ "$install_root" != *$'\n'* && "$install_root" != *$'\r'* ]] \
  || die 'OORE_INSTALL_ROOT cannot contain a newline.'

cli="$install_root/bin/oore"
if [[ -d "$install_root" && ! -L "$install_root" && -O "$install_root" \
  && -d "$install_root/bin" && ! -L "$install_root/bin" && -O "$install_root/bin" \
  && -f "$cli" && ! -L "$cli" && -O "$cli" && -x "$cli" ]]; then
  if /usr/bin/env OORE_INSTALL_ROOT="$install_root" "$cli" uninstall --help >/dev/null 2>&1; then
    exec /usr/bin/env OORE_INSTALL_ROOT="$install_root" "$cli" uninstall "$@"
  fi
fi

printf 'Oore uninstall needs the installed v0.1.42 or newer CLI.\n' >&2
printf 'No files were removed. Reinstall the CLI at this root, then retry:\n' >&2
printf '  curl -fsSL https://oore.build/install | /usr/bin/env OORE_INSTALL_ROOT=%q /bin/bash\n' \
  "$install_root" >&2
exit 1
