---
title: 'HTTP API'
status: implemented
description: 'Entry point to Oore generated API categories, operation pages, and the downloadable OpenAPI contract.'
---

Oore generates its public HTTP API reference from the checked-in OpenAPI
contract. Category and operation pages render inside the same documentation
navigation and are the authority for methods, paths, authentication, request
bodies, response codes, and schemas.

## Browse by category

- [Authentication](/reference/api/categories/authentication)
- [Builds](/reference/api/categories/builds)
- [Users](/reference/api/categories/users)
- [Projects](/reference/api/categories/projects)
- [Artifacts](/reference/api/categories/artifacts)
- [Sources](/reference/api/categories/sources)
- [Pipelines](/reference/api/categories/pipelines)
- [Setup](/reference/api/categories/setup)
- [Logs](/reference/api/categories/logs)
- [Settings](/reference/api/categories/settings)
- [Runners](/reference/api/categories/runners)

Each category links to stable generated operation pages at:

```text
/openapi/operations/<operationId>
```

Existing operation IDs remain stable. The build checks compare the generated
surface with the runtime routes and reject unresolved security references or
undeclared tags, so this page does not maintain a second endpoint inventory.

## Download the contract

Use [`openapi.json`](/openapi.json) for client generation and tooling.

```bash
curl -fsS https://docs.oore.build/openapi.json \
  -o openapi.json
```

Pin the downloaded file alongside generated clients when you need reproducible
regeneration.

## Authentication

Protected operations use:

```http
Authorization: Bearer <session-token>
```

Authentication is operation-specific. Health and readiness, public setup
status, provider callbacks, metrics, scoped artifact delivery, and runner
signing routes use their documented public, cookie/state, path-token, or
signing-token seams. Check the generated operation page instead of applying a
global bearer rule.

API errors use the shared envelope described under
[Error codes](/reference/errors).
