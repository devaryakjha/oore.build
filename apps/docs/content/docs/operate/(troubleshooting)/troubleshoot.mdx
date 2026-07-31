---
title: 'Troubleshoot Oore'
status: implemented
description: 'Route daemon, runner, access, build, and artifact symptoms to the narrowest verified check.'
---

Start with the user-visible symptom, then check the nearest boundary. Preserve
the first error code and relevant log lines before restarting or resetting
anything.

## The backend is unavailable

```bash
curl --fail-with-body http://127.0.0.1:8787/healthz
curl --fail-with-body http://127.0.0.1:8787/readyz
tail -n 200 "$HOME/.oore/logs/oored.log"
```

- No liveness response: check the managed service and whether another process
  owns port `8787`.
- Liveness succeeds but readiness returns `503`: inspect the response's
  database, migration, and encryption fields.
- A database-open or locked error: make sure only one `oored` uses that state
  file.

## A build remains queued

Open the build and **Settings > Runners**.

- **Direct runner paused** (`instance_paused`): turn on **Allow approved
  repositories** when you are ready to accept new work.
- **Source unavailable** (`repository_unavailable`): reconnect or relink the
  repository. Pausing does not revoke source trust.
- Runner offline: inspect `~/.oore/logs/oore-runner.log` and follow
  [Add a Direct macOS runner](/operate/runners/direct).

Run the platform-specific doctor check on the runner Mac when a claimed build
fails before tool execution:

```bash
oore doctor --all
```

## Sign-in or browser access fails

- Hosted UI network failure: confirm the backend uses HTTPS, is reachable from
  that browser, and allows `https://ci.oore.build`.
- OIDC redirect failure: confirm the configured callback ends in
  `/auth/callback` and exactly matches the provider entry.
- `user_not_found` after External Access sign-in: invite the same email first.
- Trusted Proxy failure: verify the immediate peer CIDR, exact identity header,
  and shared proof; a forwarded email header alone is not authentication.

## An artifact cannot be downloaded

Request a new link after checking project access and artifact expiry. Ordinary
download links expire. For S3/R2, check the provider endpoint and bucket
policy; for local storage, check backend disk and delivery reachability.

## Verify the result

Repeat the smallest failing action once. Confirm the original status, error
code, or log event is gone and that a neighboring operation still works.

## Next step

If the symptom remains, [report an issue](/operate/support/report-an-issue)
with the preserved evidence. Reset only when a narrower recovery path cannot
restore the instance.
