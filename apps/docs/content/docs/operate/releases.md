---
title: 'Choose a release channel'
status: implemented
description: 'Choose stable, beta, or alpha updates without assuming a fixed release schedule.'
---

Oore publishes three event-driven release streams. Choose the least
experimental stream that contains the behavior you need.

| Channel  | Version form     | Intended use                         |
| -------- | ---------------- | ------------------------------------ |
| `stable` | `vX.Y.Z`         | Default installations                |
| `beta`   | `vX.Y.Z-beta.N`  | Pre-release validation               |
| `alpha`  | `vX.Y.Z-alpha.N` | Earliest public integration feedback |

`stable` is the default channel label. It does not change Oore's current public
alpha product maturity or promise a release cadence or uptime SLA.

## What you need

- A managed Oore installation or a Mac where you are installing Oore.
- A verified backup before changing an existing installation's channel.
- Acceptance of pre-release behavior before choosing `beta` or `alpha`.

## Install a channel

The normal installer selects `stable`:

```bash
curl -fsSL https://oore.build/install | bash
```

To opt into a pre-release channel:

```bash
curl -fsSL https://oore.build/install | OORE_CHANNEL=beta bash
```

Replace `beta` with `alpha` only when you accept the earlier stream.

## Change the update stream

Check without installing:

```bash
oore update --check --channel beta
```

Then make the intentional change:

```bash
oore update --channel beta
```

The selected channel becomes the default for later updates only after this
command installs a release. A check-only run, an already-current version, or a
channel with no newer release leaves the saved channel unchanged.

## How published versions map

Updates to the `stable`, `beta`, and `alpha` release branches create the
matching tag forms above. `master` is validated but does not create a release
tag automatically. Static `latest` manifests select a version for each channel
and the binary assets remain on GitHub Releases.

## Verify the result

Run `oore version` and inspect the runtime channel in **Settings > General**.
Confirm the version form matches the channel you selected.

## Troubleshooting

If no update appears, do not infer a schedule; the selected channel may not
have a newer published version. If a pre-release is unsuitable, create and
verify a backup, then follow [Upgrade Oore](/operate/maintain/upgrade) with an
intentional channel choice.

## Next step

[Upgrade Oore](/operate/maintain/upgrade).
