---
title: 'Monitor Oore'
status: implemented
description: 'Check daemon liveness, runtime readiness, metrics, runners, queues, and managed logs.'
---

Monitor the backend process separately from the dependencies it needs to serve
work. Oore exposes unauthenticated liveness, readiness, and Prometheus metrics
endpoints; restrict their network reachability to the systems that need them.

## What you need

- Network access to the backend's monitoring endpoints.
- A monitoring system that can distinguish HTTP status and response body.
- Access to the backend Mac when service or managed-log inspection is needed.

## 1. Check liveness and readiness

```bash
curl --fail-with-body http://127.0.0.1:8787/healthz
```

A `200` response with `"ok": true` means the process can accept requests.
Liveness does not wait for SQLite.

```bash
curl --fail-with-body http://127.0.0.1:8787/readyz
```

A `200` response with `"ok": true` means the database, migrations, and
encryption runtime are ready. A `503` response means the process is alive but a
runtime dependency is not ready.

## 2. Scrape metrics

```bash
curl --fail-with-body http://127.0.0.1:8787/metrics
```

The response uses Prometheus text format. Put access control around `/metrics`
at your network boundary; the endpoint itself does not require an Oore session.
Choose alert thresholds from your own capacity and service objectives rather
than copying generic values.

## 3. Watch user-visible signals

- Open **Settings > Runners** and check runner state.
- Check queued builds for **Direct runner paused** (`instance_paused`) or
  **Source unavailable** (`repository_unavailable`).
- Monitor free space for the database and local artifact directory.
- Check the public setup status only for an unexpected transition away from
  `ready`.

For a managed one-Mac installation, daemon and web logs are under
`~/.oore/logs`. Use the process manager for service state and restart history.

## Verify the result

Save one successful liveness response, readiness response, and metrics scrape
in your monitoring system. Stop a non-production test dependency or use a
staging instance to confirm your readiness alert distinguishes a `503` from a
dead process.

## Troubleshooting

If `/healthz` is unreachable, inspect the service and daemon log first. If only
`/readyz` fails, use its `database`, `migrations`, and `encryption` fields to
narrow the dependency. If runners are offline while the backend is ready,
follow [Add a Direct macOS runner](/operate/runners/direct).

## Next step

[Create and verify a backup](/operate/maintain/backups/create).
