---
title: 'Build states'
status: implemented
description: 'Build lifecycle states, valid transitions, and timing fields in Oore.'
---

Every build has one of the following `status` values.

| State       | Meaning                                                  |
| ----------- | -------------------------------------------------------- |
| `queued`    | Created and waiting for scheduling                       |
| `scheduled` | Selected for a runner queue but not yet claimed          |
| `assigned`  | Claimed by a runner                                      |
| `running`   | Build commands are executing                             |
| `succeeded` | Execution completed successfully                         |
| `failed`    | Execution completed with a failure                       |
| `canceled`  | Canceled before completion                               |
| `timed_out` | The runner or service marked execution as timed out      |
| `expired`   | No longer active after queue expiry or retention cleanup |

## Valid transitions

| From                                           | To                                             |
| ---------------------------------------------- | ---------------------------------------------- |
| `queued`                                       | `scheduled`, `canceled`, `expired`             |
| `scheduled`                                    | `assigned`, `queued`, `canceled`, `expired`    |
| `assigned`                                     | `running`, `queued`, `canceled`, `timed_out`   |
| `running`                                      | `succeeded`, `failed`, `canceled`, `timed_out` |
| `succeeded`, `failed`, `canceled`, `timed_out` | `expired`                                      |
| `expired`                                      | None                                           |

Scheduling can return a build to `queued` when a runner cannot take it.
Retention cleanup can move a completed build to `expired`; this is the only
transition after a success, failure, cancellation, or timeout.

An unsupported change returns `409 Conflict` with code
`invalid_transition`.

## Timing fields

Build timestamps are Unix seconds:

| Field         | Set when                                                |
| ------------- | ------------------------------------------------------- |
| `queued_at`   | The build is created                                    |
| `started_at`  | The build enters `running`; otherwise omitted           |
| `finished_at` | The build reaches a completion state; otherwise omitted |
| `created_at`  | The build record is created                             |
| `updated_at`  | The build record last changes                           |

Use `status` as the lifecycle authority. A missing `started_at` or
`finished_at` is expected for a build that has not reached the corresponding
point.
