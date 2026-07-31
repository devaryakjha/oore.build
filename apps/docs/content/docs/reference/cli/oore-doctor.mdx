---
title: '`oore doctor`'
status: implemented
description: 'Check required host tools, the managed runner, and selected platform toolchains.'
---

`oore doctor` checks the host used for Direct macOS builds.

```text
oore doctor [--platform <PLATFORM>]... [--all] [--json]
```

| Option               | Meaning                                |
| -------------------- | -------------------------------------- |
| `--platform android` | Include Android toolchain checks       |
| `--platform ios`     | Include iOS and Apple signing checks   |
| `--platform macos`   | Include macOS and Apple signing checks |
| `--all`              | Check Android, iOS, and macOS          |
| `--json`             | Emit a structured report               |

The base report checks Git, Oore-managed Flutter/FVM readiness, and the managed
runner service. Platform options add Android SDK or Xcode/signing checks.

Each check has one status:

| Status    | Meaning                                              |
| --------- | ---------------------------------------------------- |
| `ok`      | The required capability is available                 |
| `warning` | An optional capability is missing or needs attention |
| `missing` | A selected required capability is missing            |
| `skipped` | The corresponding platform was not selected          |

The command succeeds when no check is `missing`. Warnings do not make the
command fail. JSON output includes `checks`, `missing_count`, and
`warning_count`; each check contains `name`, `status`, and optional `detail`
and `install_hint` fields.

```bash
oore doctor --platform android --platform ios
oore doctor --all --json
```

Run the command on the runner host, not on a separate UI-only Linux host.
