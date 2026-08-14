---
title: Oore CI | Self-hosted mobile CI on macOS
description: Open-source mobile CI for Flutter teams on infrastructure they operate.
canonical: https://oore.build/
---

# Ship Flutter apps from the Mac you already trust

Oore is self-hosted mobile CI for teams that keep source, signing assets, and the Apple toolchain on their infrastructure.

- Open source and MIT licensed
- Public alpha
- Android, iOS, and macOS targets
- GitHub, GitLab, and local Git sources
- Local, OIDC, and Trusted Proxy access

[Install Oore](#install) · [View the live demo](https://demo.oore.build) · [Read the documentation](https://docs.oore.build)

## How it works

Oore keeps the control plane visible while builds stay on macOS hardware that you operate.

1. **Connect your source.** Link GitHub, GitLab, or a local repository. The selected source is the execution trust boundary.
2. **Describe the build.** Keep the workflow in your repository. Oore resolves it at the exact revision under build.
3. **Run on your Mac.** A managed Direct runner checks out the revision and uses the Flutter toolchain on macOS.
4. **Ship the artifact.** Sign, verify, and distribute Android, iOS, and macOS outputs from one operator workspace.

## Operator workspace

Operate the build, not the build server.

- Watch the queue, live logs, and build state without SSH.
- Keep projects, runners, sources, users, and operational policy together.
- Give QA a release-first workspace for installable artifacts.

[Explore the product](https://demo.oore.build)

## Trust model

Direct mode prioritizes macOS toolchain compatibility. Build commands use the runner account permissions. Oore does not describe Direct mode as a hostile-code sandbox.

### Repository authority

Creating a project or changing its source authorizes that repository's commands on the Direct runner. External-fork events do not queue builds.

### Signing hygiene

Signing material arrives late through a job-scoped grant. Runner-owned commands sign, verify, and clean temporary state after repository stages finish.

[Read the security boundaries](https://docs.oore.build/operate/known-limitations)

## Install

Start with one Mac. The guided installer prepares the daemon and local web UI.

```sh
curl -fsSL https://oore.build/install | bash
```

[Read installation details](https://docs.oore.build/start/install)
