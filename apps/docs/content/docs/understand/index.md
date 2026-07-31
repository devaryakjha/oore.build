---
title: 'Understand Oore'
status: implemented
description: 'Learn the boundaries that shape builds, runners, signing, artifacts, access, and browser instances.'
---

Oore separates the backend that decides what may happen from the Direct macOS
runner that executes trusted repository code. The pages in this section explain
the consequences of that separation.

## Control and execution

- [How Oore is structured](/understand/architecture) shows which responsibilities
  belong to the browser client, `oore`, `oored`, and the Direct macOS runner.
- [How a build moves from queue to artifact](/understand/build-lifecycle)
  follows one build through selection, execution, signing, and delivery.
- [How Oore trusts Direct macOS runners](/understand/runner-trust) explains why
  source linking is a trust decision rather than a sandbox policy.

## Build inputs and outputs

- [How Oore chooses pipeline configuration](/understand/pipeline-configuration)
  explains repository-file precedence and the UI alternative.
- [How signing works in Oore](/understand/signing) defines the boundary between
  repository commands and runner-owned signing.
- [How artifact delivery works](/understand/artifact-delivery) connects storage,
  authorization, short-lived downloads, and mobile installation.

## Access and separation

- [Oore's security model](/understand/security) explains authentication,
  authorization, repository trust, and secret handling as separate layers.
- [How multiple instances stay separate](/understand/multiple-instances)
  explains what changes when one browser connects to more than one backend.

## Next step

Start with [how Oore is structured](/understand/architecture), then follow the
model closest to the behavior you need to understand.
