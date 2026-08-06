# Rebuilt documentation acceptance contract

Status: decision resolution for
[#202](https://github.com/oore-ci/oore.build/issues/202), at baseline
`66e56785394960f280b7c37244ed72b1dccca4bc`.

This contract defines the evidence required to accept the completed public
documentation rebuild. It does not implement the rebuild, rewrite the corpus,
change product behavior, deploy an artifact, or authorize a production
promotion.

The accepted inputs are:

- [Official Fumadocs-on-Astro 7 architecture](https://github.com/oore-ci/oore.build/blob/962859b5df489f405701f5e9d3fda3ef9f7cbe0d/research/fumadocs-astro-7-architecture.md)
- [Public documentation disposition ledger](https://github.com/oore-ci/oore.build/blob/f9a9699d767012b8ed409c6622f1d2254cc8e37a/wayfinder/public-docs-page-ledger.md)
- [Public documentation truth table](https://github.com/oore-ci/oore.build/blob/ca90c65a6fefbd5cf1df460a083da46d52167fcf/wayfinder/public-docs-truth-table.md)
- [Public deployment contract](https://github.com/oore-ci/oore.build/blob/27fd4e86dcff9d1e073032d035d60669a8d2ab9c/wayfinder/public-deployment-contract.md)
- [Public documentation voice prototype](https://github.com/oore-ci/oore.build/blob/694e6311b9de4c04a7aa10b8639e58b9dfedb499/wayfinder/public-docs-voice-prototype.md)
- [Canonical public documentation tree](https://github.com/oore-ci/oore.build/blob/2d6e449864aca20de51ab7adc414076c15e83e55/wayfinder/canonical-docs-tree.md)
- [Public documentation URL and redirect contract](https://github.com/oore-ci/oore.build/blob/ecd39f0765459534ec0d844a37121ec03bb38678/wayfinder/public-docs-url-contract.md)
- The checked-in [frontend design system](../DESIGN.md)

When an older input contains provisional URLs, pre-parity OpenAPI counts, or
the former static-SPA architecture, the accepted URL contract and Astro
architecture above control those seams. The truth table remains the factual
authority for source-backed product behavior; the deployment contract controls
the supported public topology; the voice prototype controls editorial review.

## Decision

Acceptance has four explicit gates:

1. **Source/spec integrity**
2. **Built static artifact**
3. **Local production-preview behavior with hydration**
4. **Cloudflare Pages preview**

Gates 1–3 are hermetic and block CI. A successful Pages preview in Gate 4
establishes that the already-accepted artifact is eligible for promotion; it
does not authorize promotion. Production promotion requires separate explicit
authority. The small live smoke is a distinct post-promotion responsibility
that confirms deployment; it cannot establish implementation correctness or
repair missing evidence from an earlier gate.

The acceptance object is one repository commit and one immutable
`apps/docs/dist` artifact produced from it. Evidence that does not identify
the commit and, after the build, the canonical complete-tree manifest and
artifact digest is not transferable to a different build. A deploy must upload
that accepted artifact, not rebuild it.

## Accepted-snapshot audit anchors

The following values are consequences of the accepted registries and corrected
spec at this snapshot:

| Measure | Accepted value |
| --- | ---: |
| Current authored sources | 92 |
| Source dispositions | 72 retain/rewrite, 6 merge, 12 redirect, 2 remove |
| Current source responses | 14 canonical `200`, 76 direct `301`, 2 real `404` |
| Unique authored destinations | 82 |
| Generated API category pages | 11 |
| Runtime/exporter OpenAPI parity | 117 paths, 145 operations |
| Preserved and added operation URLs | exact 130 preserved + exact 15 additions |
| Indexable canonical pages | 238 |
| Explicit one-hop redirect sources | 399 |
| Canonical slash policy | slashless except `/` |

These are audit anchors, not permission to hard-code a test count and stop.
The verifier must mechanically derive the underlying sets from the accepted
ledger, tree, URL contract, corrected OpenAPI document, and production router,
then compare complete sets. Equal totals with a missing, extra, renamed, or
duplicated member fail.

## Evidence and result rules

Each named responsibility reports exactly one of:

- `PASS` — the required behavior ran successfully and the report contains its
  commit, inputs, command or probe, derived inventory, and relevant artifact
  digest.
- `FAIL` — the check ran and found a mismatch, skipped required case, empty
  inventory, unexpected error, or missing evidence.
- `NOT RUN` — no attempt was made. This never implies success.
- `Blocked` — the attempt could not proceed because a named dependency or
  environment was unavailable. This never implies success.
- `Not applicable` — the contract explicitly makes the check conditional and
  the report explains why the condition does not apply. A required gate cannot
  be waived with this result.

A gate passes only when every required responsibility in it is `PASS`. A
command exiting zero is insufficient when its required cases did not execute.
In particular:

- missing or empty source, route, spec, search, sitemap, redirect, or browser
  inventories fail
- skipped required cases and an all-skipped suite fail
- a count-only comparison fails
- a development-server result cannot stand in for the production artifact
- a build result cannot stand in for post-build inspection
- a local host model cannot stand in for Cloudflare Pages
- a successful upload cannot stand in for HTTP or browser behavior
- a live result cannot stand in for source, artifact, local preview, or Pages
  preview evidence
- a link, placeholder, spelling, or DOM-presence scan cannot stand in for
  human editorial review

Retries remain visible in the evidence. A later pass does not erase an earlier
failure; the report records the original failure, why a retry was valid, and
all attempts.

## Authoritative normalized sets

The test responsibilities share one normalization step and exchange its
machine-readable results rather than reinterpreting the contracts
independently.

The normalization derives:

- the 92 ledger sources and exactly one disposition for each
- the 82 authored canonical destinations from the accepted tree and URL
  registry
- the exact accepted editorial type for each authored destination
- the redirect-only aliases and removed paths from the accepted source matrix
- the 11 category destinations and their tag-to-category mapping
- the operation method/path set and stable `operationId` set from the corrected
  OpenAPI document
- the exact preserved 130-operation URL subset and exact 15-operation
  addition from the accepted URL contract
- the finite slash expansion and historic aliases
- the expected canonical-page union:
  authored pages + generated categories + generated operations
- the non-page static endpoints and the real not-found document

Parsers count and validate raw rows before deduplication. A duplicate cannot
disappear into a set, and a malformed or unparsed row cannot disappear from
the denominator. Missing section markers, unreadable inputs, zero discovered
members, and an unclassified production-router registration fail.

Path comparison uses decoded URL paths, a leading slash, no query or fragment,
and the accepted slashless spelling except for `/`. It does not collapse an
unknown path into a known prefix or treat a platform redirect as
canonicalization. Method/path comparison normalizes only syntax differences
explicitly approved by the truth table; it does not omit a route because the
exporter lacks it.

The canonical, redirect-source, and removed sets are disjoint. Static
endpoints and assets are not documentation canonicals. Every set difference is
printed even when empty so a green result shows what was compared.

## Gate 1 — Source/spec integrity

**CI result:** blocking.

**Named responsibility:** `source/spec integrity`.

This responsibility runs before the build on a fresh Linux checkout. It owns
the normalized expected sets, source-backed reference parity, source content
integrity, and the source inventory against which the separate commit-bound
editorial review is verified.

### Public-corpus accounting

The responsibility must:

- parse all 92 accepted ledger rows and account for every baseline Markdown or
  MDX source exactly once
- reproduce the `72 + 6 + 12 + 2 = 92` disposition partition and the
  `14 + 76 + 2 = 92` response partition from row data
- reconcile the ledger, canonical tree, and final URL contract without
  preserving an older provisional destination
- derive 82 unique authored destination IDs and paths, with no orphan,
  duplicate canonical, duplicate title, or competing destination for one
  source
- prove every authored destination has accepted source provenance and that
  only the accepted split edges create an additional destination
- resolve all 12 legacy API pointer sources: one merges into the sole authored
  `/reference/api` landing and the other 11 become redirect-only aliases to
  generated category pages
- prove the two removed internal Operations sources have no authored output,
  public source file or source content, canonical route, redirect, navigation
  node, search record, sitemap entry, or public/private handoff link
- prove every retained mixed source has lost maintainer-only infrastructure,
  framework internals, lifecycle jargon, and one-time migration material
- verify every internal link resolves to a canonical destination, an accepted
  static endpoint or asset, or a valid fragment on a canonical page; other
  links must be intentional external URLs
- prove the four fragment-bearing API pointer links in the accepted URL
  contract resolve directly to their named generated operations
- reject credentials, private hosts, private links, private destinations, and
  internal operational detail

### Architecture source conformance

The responsibility must prove the implementation conforms semantically to the
controlling accepted architecture:

- Astro owns public-document ingestion, route generation, and static output to
  `apps/docs/dist`
- the official Fumadocs Astro integration owns the Fumadocs provider and
  client-hydration boundary; no locally invented compatibility provider,
  adapter, or Astro bridge substitutes for it
- one live loader combines the accepted authored hierarchy with tag-derived
  category pages and OpenAPI-derived operation pages, so generated API pages
  are virtual members of the same content and navigation model
- TanStack Start or Router, Nitro, a custom Fumadocs bridge, a documentation
  runtime server, a runtime adapter, and SPA-shell or wildcard-fallback
  remnants do not participate in ingestion, routing, rendering, preview, or
  deployment

This is a package-resolution, build-configuration, route-ownership, and
behavior check. It does not pass from a grep for preferred filenames or import
spelling, and it does not prescribe generated framework internals.

### OpenAPI source parity

The responsibility must normalize the production router and exporter and
prove exact equality at 117 paths and 145 operations. It must show no
runtime-only or exporter-only method/path pair and must not hide a
source-backed route behind an exclusion.

It must also prove:

- 145 nonempty, unique, stable, URL-safe single-segment `operationId` values
- the final operation URL set equals the exact accepted 130-URL subset union
  the exact 15-row parity appendix, with no preserved rename and no additional
  operation
- every preserved baseline `(method, path, operationId)` mapping remains
  unchanged, not merely its URL spelling
- each of the 15 additions has the accepted method, runtime path,
  `operationId`, canonical URL, tag, and category
- the complete schemas of `project_avatar_url`, `repository_full_name`,
  `repository_provider`, and `repository_host_url` in corrected
  `BuildContext` equal the fresh source-backed exporter definitions, including
  type, format, nullability, requiredness, and descriptions where the source
  defines them; name containment alone and stale or extra divergence fail
- every referenced schema and security scheme resolves
- all used tags are declared and every operation has the accepted tag
  membership
- public, webhook, callback, stream-token, install-token, and other
  non-bearer routes do not accidentally inherit bearer authentication
- every one of the 145 runtime operations is classified exactly once from the
  authoritative runtime authentication seam, with no unclassified, excluded,
  or multiply classified operation
- that complete runtime authentication map equals the effective OpenAPI
  security map after operation-level overrides and root-level inheritance are
  applied; named route classes are examples, not permission to test a subset
- runner registration and artifact creation describe the source- and
  test-backed `200` response rather than the stale `201`
- response statuses, authentication, and media types for the 15 additions
  come from handlers and focused behavior tests
- missing summary and description inventories are recomputed from the
  corrected document rather than copied from the 130-operation baseline

### Generated URL and category contract

The operation routes remain
`/openapi/operations/<operationId>`. `/reference/api` is the sole authored API
landing.

Category membership is derived from OpenAPI tags through the accepted
tag-to-category mapping. The responsibility must prove:

- 11 unique, nonempty generated category destinations
- every used tag maps to exactly one category
- every one of the 145 operations maps to exactly one category
- every accepted category contains its exact derived membership
- no category is produced from a hand-maintained operation-ID list
- the generated category and operation destinations appear under Reference in
  the one accepted hierarchy while retaining their accepted public URLs

### Authored source quality

Every final authored source must have valid parseable metadata, a nonempty
title and description, one declared editorial page classification, and content
appropriate to that type. The classification may live in the normalized
review record rather than a particular frontmatter field. Exact commands,
flags, YAML, state values, roles, errors, UI labels, HTTP examples, and support
claims must be checked against the current authoritative source named by the
truth and deployment contracts.

The allowed classifications are exactly `landing`, `tutorial`, `task`,
`concept`, and `reference`. Every authored destination's classification must
equal its accepted `P###` tree row; an arbitrary reassignment or additional
type fails.

Mechanical checks must reject:

- unresolved links, unknown assets, duplicate slugs, missing required
  metadata, malformed code fences, and unresolved placeholders
- `.oore.yaml` examples that fail the product validator
- CLI examples not present in current public help
- HTTP examples that disagree with the runtime and corrected OpenAPI document
- public terminology that substitutes old product names for **Local Only**,
  **External Access**, **Sources**, or **Direct macOS runner**
- a product blocker, unsupported topology, or absent feature presented as
  settled behavior
- trailing whitespace or a failing `git diff --check`

### Commit-bound editorial review

**Named responsibility:** `commit-bound editorial review`.

One recorded human review must cover every retained and new authored
destination against the truth table, deployment contract, voice prototype,
and accepted tree. The review is page-by-page; a sample is insufficient. Human
judgment is not a hermetic test: CI verifies the immutable review record and
does not claim to have performed the review.

The record is bound to the exact accepted repository commit and contains the
complete normalized authored inventory, the reviewed content digest and
editorial classification for every destination, the accepted-input commit
identities, each page result, unresolved findings, and an overall
attestation. It is part of the commit-bound acceptance evidence, not mutable
state at an unversioned location. CI derives the authored inventory and source
digests independently and fails a missing, stale, duplicate, partial,
sampled, or non-passing record.

The reviewer confirms:

- the page has one user job and uses calm, direct, sentence-case operator
  language
- the default path precedes alternatives and public claims remain within the
  accepted support level
- exact labels and commands are current
- no unresolved product blocker is presented as settled
- no internal deployment or release material remains public
- landing pages route rather than reproduce the whole hierarchy
- each tutorial ends in one observable first success
- each task states the outcome, prerequisites, verification,
  task-specific troubleshooting, and one useful next step
- each concept explains one user-visible mental model without becoming a task
  or source-code tour
- each reference page is exact, source-backed, and does not call an
  unverified hand-maintained list exhaustive

Link, metadata, placeholder, terminology, and prose-lint results support this
review but do not replace it. Missing review evidence blocks the gate.
Published evidence may identify the record with a sanitized public
attestation or opaque identifier only; it must not disclose or link to a
private note, path, host, or reviewer-only material.

## Gate 2 — Built static artifact

**CI result:** blocking.

**Named responsibility:** `post-build artifact verifier`.

The build and verifier run on Linux from a fresh checkout. `make build-docs`
must perform a production build and create the complete deployable artifact at
`apps/docs/dist`. The verifier consumes that exact directory after the build;
it does not run another build or inspect a development server.

The build starts without a previous `apps/docs/dist` and fails closed if the
production build fails. It records the canonical complete-tree manifest and
digest of the newly created artifact. A stale directory, source `public` tree,
or earlier successful build cannot satisfy the verifier.

The manifest enumerates every entry below `apps/docs/dist`, including
directories and regular files; symlinks, devices, sockets, and other special
entries fail. Relative paths are valid UTF-8, slash-separated, and sorted by
their unsigned UTF-8 bytes. Each row records the relative path, entry type,
and, for a regular file, byte length and SHA-256 of the complete file bytes.
The artifact digest is SHA-256 over the following deterministic binary stream:
the UTF-8 bytes `oore-docs-dist-v1` followed by a zero byte, then each sorted
row encoded as one type byte (`D` or `F`), an unsigned 64-bit big-endian path
byte length, the UTF-8 path bytes, an unsigned 64-bit big-endian file length
(`0` for a directory), and the 32 raw SHA-256 bytes (32 zero bytes for a
directory). This definition covers added, empty, and renamed entries as well
as changed file bytes. Every post-build, preview, and promotion lane uses this
same manifest and digest.

### Artifact boundary

The artifact must contain:

- route-specific authored and generated HTML
- top-level `404.html`
- the `/api/search` static response
- `_redirects`
- `robots.txt`
- the canonical sitemap
- the parity-corrected `openapi.json`
- referenced fonts, images, icons, CSS, and JavaScript

The deployed contract must not need:

- a runtime documentation server
- an Astro server adapter
- a Worker or Pages Function
- `.output/public`
- a SPA wildcard or home-shell rewrite
- a post-build symlink materializer
- a file outside `apps/docs/dist`

Shared source assets may originate elsewhere in the repository, but the built
copies must be regular deployable files. The verifier fails dangling or
external symlinks and any result that succeeds only because the developer
worktree contains material absent from a fresh checkout.

### Raw authored HTML

The verifier parses the route-specific main article in every authored
canonical output without executing JavaScript. It does not treat shared
navigation, shell, or footer text as page content. Each page must contain:

- its own nonempty title, description, and single H1
- route-specific, non-boilerplate body content derived from its authored
  source
- its expected canonical URL

No authored route may be the docs home shell, an empty hydration placeholder,
another page's body, or a client-only loading state. A representative sample
does not replace the complete 82-page check. Normalized substantive main
content must be pairwise nonidentical across those outputs.

### Raw generated HTML

The verifier derives the 145 operation routes from the corrected spec and the
11 category routes from the approved tag mapping, then parses every generated
output without JavaScript.

Each operation page must show its exact HTTP method, API path, raw
`operationId`, and a nonempty title and description using the accepted
source-backed fallback:

1. title from summary, otherwise the deterministic operation-ID display name
2. description from description, otherwise summary, otherwise exact
   `METHOD /path`

It must not invent behavior from an identifier or borrow prose from another
operation.

Each category page must show its accepted title and tag-derived operation
membership. Optional category prose comes only from declared tag descriptions
or exact operation facts. Category output must not duplicate a second
hand-maintained operation catalog.

### Route and class equality

The normalized built canonical route set must equal the expected authored +
category + operation union. The verifier separately checks redirect-only
aliases, removed paths, `404.html`, static endpoints, and assets by class. The
complete built HTML route/file inventory must partition exactly into the
canonical set and the single `404.html`; redirect sources and every other path
must have no HTML output. It fails any extra HTML file whether indexable or
`noindex`, an omitted canonical, an authored API pointer stub, a generated
route outside the accepted set, or a removed internal route.

### Redirect graph

The verifier parses the built `_redirects` and compares it with the complete
finite expansion of the accepted URL contract:

- both spellings of every moved current source
- both spellings of every historic alias
- the slashful spelling of every non-root canonical page

At the accepted snapshot the derivation yields 399 unique sources. Every rule
must be an explicit `301` directly to a canonical `200` target.

The verifier rejects:

- a missing, extra, duplicate, or conflicting source
- a self edge, chain, cycle, or target that is also a redirect source
- an intermediate slash normalization
- a wildcard, dynamic canonicalizer, or `200` rewrite
- a redirect for an unknown route or either removed internal route
- a canonical slashless URL that redirects

`/openapi` and `/openapi/` must both go directly to `/reference/api`.

### Real not-found document

The built `404.html` must contain a visible route-appropriate not-found
message, `noindex` metadata, and neither a home canonical nor the home body. It
must be absent from the canonical route inventory, sitemap, and static search.

### Static search

The static search response must be a valid static file with its intended media
type. The verifier enumerates it through the supported static-search
client/decoder and compares the actual complete result-destination URL set
with the canonical page set. Inspecting only generator inputs or receiving
HTTP `200` is insufficient.

It must exclude:

- every redirect source
- all removed and internal paths
- all 12 former API pointer documents as standalone records
- unknown paths and the 404 document
- static endpoints and ordinary assets

Category records contain their own title and source-backed tag metadata;
operation records contain their own operation data. The post-build verifier
also prepares one unique authored phrase and one operation path that occurs in
exactly one indexed operation record for the Gate 3 behavior query. Each
prepared query must have exactly one intended canonical result.

### Canonical and social metadata

Every canonical raw HTML document must have exactly one absolute
self-canonical on `https://docs.oore.build`, a nonempty title and description,
and aligned Open Graph and Twitter title and description metadata. Open Graph
URL and any equivalent social URL metadata use the same canonical. The root
canonical is exactly `https://docs.oore.build/`; every other canonical uses
the accepted slashless path.

Metadata fallback for generated pages is the same source-backed fallback used
in their visible HTML. Redirects do not supply indexable duplicate HTML. The
404 document is `noindex` and has no guessed or home canonical.

### Sitemap and robots

The sitemap URL set must equal the canonical page set exactly and use
`https://docs.oore.build`. It excludes redirects, slash aliases, removed and
unknown routes, the 404 document, static endpoints, and assets.

`robots.txt` must be a valid plain-text static file, allow the intended public
canonical content, and advertise exactly the production sitemap URL. It must
not advertise a preview hostname or an obsolete sitemap.

### Assets and portability

The verifier resolves every same-origin file reference from built HTML and CSS
within `apps/docs/dist`, including `src`, `srcset`, scripts, stylesheets,
preloads, fonts, icons, and transitive CSS `url()` references. Every target
must exist as a regular file.

It validates file content rather than trusting extensions:

- bitmap image signatures and dimensions
- parseable SVG with a usable intrinsic size or view box
- valid font signatures
- nonempty parseable CSS and JavaScript assets

Linux filename case, path separators, permissions, and fresh-checkout behavior
are part of the proof. No result may depend on a macOS-only symlink or an
untracked local asset.

The verifier also scans the complete manifest payload, not only routed HTML,
for private links, private hosts, removed Operations source content,
credentials, and internal operational material. Dead source copies, source
maps, search payloads, JavaScript bundles, metadata, or other unlinked files
cannot carry material forbidden from the public corpus.

### One hierarchy

The verifier reads the live loader-owned hierarchy, normalizes it to ordered
`{url, label, parent, order}` records, and compares the complete set with the
accepted canonical tree. Comparing two hand-authored fixtures is not evidence.
It proves:

- the root and six groups have the accepted order
- every authored destination appears exactly once
- folder indexes remain visible and clickable where approved
- generated categories and operations appear beneath Reference
- sidebar, breadcrumbs, previous/next relationships, mobile navigation, and
  search use the same hierarchy
- no fallback folder extraction, duplicate navbar, parallel route manifest,
  or separate OpenAPI tree changes the visible order

### Design-system source checks

The semantic contents of `apps/web/components.json` and
`apps/docs/components.json` must be identical and retain the accepted Base
Nova, Hugeicons, neutral, subtle-accent, default-translucent configuration.
Docs styling must use the shared amber primary, Inter interface text,
JetBrains Mono machine data, and checked-in token system for light and dark
appearance. Oore-authored docs components use the accepted Base UI primitives,
and Oore-authored icons come from Hugeicons. Dependency-internal implementation
choices inside the mandated Fumadocs UI are not treated as authored code and
are not rejected by import or bundle scans.

## Gate 3 — Local production preview

**CI result:** blocking.

**Named responsibility:** `production-preview browser suite`.

The suite serves the already-verified `apps/docs/dist` through a
production-mode static preview. It does not use the development server and
does not rebuild. If the local harness models Cloudflare redirect handling,
the report labels that evidence as a local model; Gate 4 still proves the real
edge.

### Direct-load and not-found behavior

Before hydration, the suite requests representative:

- root and journey landing pages
- a nested task
- an authored reference page
- a generated category
- one preserved operation and one parity-added operation

It probes the complete canonical inventory with fresh `GET` and `HEAD`
requests; every canonical must return `200`. Each representative `GET` must
also return route-specific raw HTML, canonical metadata, and body content
before client JavaScript runs.

The suite also requests:

- both slashless and slashful spellings of an arbitrary unknown authored path
- both slashless and slashful spellings of an unknown operation ID
- both slashless and slashful spellings of an unknown category ID
- a missing asset
- both spellings of both removed internal paths

Each must return HTTP `404` with the built not-found body, visible not-found
state, `noindex`, no home canonical, and no home body, without an intermediate
normalization redirect. No wildcard route may turn an unknown generated ID
into `200` or a redirect.

### Search behavior

The keyboard search interaction must:

- load the static response without a runtime server
- find the prepared unique authored phrase
- find the prepared exact, uniquely identifying operation path
- return exactly the one intended canonical record for each prepared query
- navigate to the correct canonical result from a fresh direct page
- repeat successfully after client navigation

The browser-visible results must not expose a redirect alias, removed page,
former authored API pointer, 404 page, static endpoint, or asset.

### Navigation and hydration

The browser suite covers representative landing, nested task, authored
reference, category, and operation pages at desktop and mobile widths in light
and dark appearance.

It verifies:

- sidebar, breadcrumbs, previous/next links, and mobile navigation agree on
  page ancestry and order
- keyboard access, visible focus, and logical focus order
- touch targets of at least 44 CSS pixels on compact/coarse inputs
- sidebar and mobile navigation open, close, and restore focus correctly
- theme choice persists across navigation and reload
- light, dark, and system choices all produce the intended resolved appearance
- copy controls copy the visible value
- tabs expose the selected panel with keyboard behavior intact
- interactive OpenAPI controls remain usable
- two successive client navigations render the correct page
- back, forward, and direct reload restore the correct URL, content,
  hierarchy, metadata, and theme
- title, canonical, and social URL metadata update to the active page after
  client navigation
- reduced-motion preference is respected

There must be no uncaught console error, hydration mismatch, failed static
asset, duplicate main content, horizontal overflow, clipped primary control,
overlapping navigation, unusable scroll region, or route-to-route layout
regression in the exercised viewports.

Source-only configuration checks and shallow DOM presence do not satisfy this
gate; the interactions must run after hydration.

## Gate 4 — Cloudflare Pages preview

**CI result:** external dependency, not part of hermetic CI.

**Release result:** a passing Pages preview makes the exact accepted artifact
eligible for promotion; it does not authorize promotion.

**Named responsibility:** `Pages HTTP probe`.

Creating a preview deployment requires explicit authorization. In a session
without that authorization the Pages probe reports `NOT RUN`; a local build or
current production site must not be used to infer it.

### Pages preview artifact identity

The release workflow direct-uploads the exact accepted `apps/docs/dist` to the
existing docs Pages project. It records:

- repository commit
- canonical complete-tree manifest and artifact digest
- Pages deployment identity and preview URL
- configured release channel/branch and commit metadata
- absence of an adapter, Worker, Function, or runtime server

The canonical upload manifest, Pages deployment manifest, and deployment
metadata must show that the complete accepted tree was uploaded and no Worker,
Function bundle, or Function route was attached. Static HTTP behavior supplies
the blocking runtime evidence. Request or invocation logs corroborate zero
Function invocations when the platform exposes them, but their absence on a
static-only project is not itself a failure and an asserted empty log is not
the blocking proof.

The docs deploy command must upload `apps/docs/dist`. The release workflow
retains the accepted project, alpha/beta/stable channel mapping, commit
metadata, serialized Pages deployment order, and transient-failure retry
policy. A rebuilt or digest-mismatched artifact fails before probing.

### Pages HTTP probe

The probe uses fresh HTTP requests, disables redirect following where status
and `Location` are under test, and records response status, location, media
type, and selected body evidence.

It must prove:

- representative authored, category, and operation deep links return `200` to
  fresh `GET` and `HEAD` requests; `GET` supplies route-specific raw HTML when
  JavaScript is disabled
- every one of the derived redirect sources returns one `301` with the exact
  final `Location`
- slashful legacy and canonical spellings do not become a platform `308`
  followed by the required `301`
- both slashless and slashful unknown authored paths, operation IDs, and
  category IDs, a missing asset, and both spellings of both removed internal
  routes return the built body directly with `404`
- `/api/search`, `/openapi.json`, `/robots.txt`, `/sitemap.xml`, and
  representative fonts, images, CSS, and JavaScript return `200` with the
  appropriate media type
- the deployed `openapi.json` is the parity-corrected document associated with
  the accepted artifact
- deployment manifests and metadata associate no probed request with a Pages
  Function or Worker; invocation logs corroborate this when available
- raw page canonicals remain on `https://docs.oore.build`, never the preview
  hostname

The preview then repeats the Gate 3 hydration smoke at the edge, including
search, navigation, theme persistence, copy, tabs, generated OpenAPI
interaction, successive client navigations, back/forward, and direct reload.
No console, hydration, or asset error is permitted.

A successful upload, a preview home page, or a sample of redirects is not a
passing Pages probe.

## Production promotion authority and live confirmation

Gate 4 `PASS` establishes eligibility only. Production promotion is a distinct
state-changing action and requires separate explicit authority after Gates
1–4 pass. Neither this contract nor a passing preview grants that authority.
Without it, production promotion and the live smoke both report `NOT RUN`.

### Release promotion

When separately authorized, promotion may proceed only after Gates 1–4 are
`PASS`, the commit-bound editorial review is recorded, and the preview
complete-tree manifest and artifact digest equal the artifact selected for
production. The live smoke is not a prerequisite for promotion because it can
run only after promotion.

Production promotion reuses that artifact. If the release system rebuilds or
changes any byte, the new digest is a different acceptance object and must
return to the applicable gates.

### Small live smoke

**Named responsibility:** `small live smoke`.

After production promotion, the small live smoke confirms:

- one representative authored deep link
- one generated operation deep link
- one direct redirect with following disabled
- one real 404
- the production sitemap and `robots.txt`
- the static search response and one result navigation
- one representative static asset
- production canonicals remain on `https://docs.oore.build`

The smoke records the production deployment identity and artifact digest. It
detects deployment, domain, cache, or promotion divergence. Its intentionally
small scope does not re-accept implementation behavior and cannot substitute
for the complete Pages preview.

## Build, CI, and release wiring

The required Linux CI order is:

1. source/spec integrity
2. commit-bound editorial review evidence verification
3. `make build-docs`
4. post-build artifact verifier on the resulting `apps/docs/dist`
5. production-preview browser suite on that same artifact

Each step consumes explicit evidence from the preceding step. A build cache may
restore inputs, but it must not make a required responsibility disappear or
reuse an artifact without verifying its digest.

Each named responsibility emits a machine-readable attestation containing its
result vocabulary, commit, inputs, derived counts and set differences,
artifact digest where applicable, skipped-case inventory, retries, and
evidence locations. The aggregate fails closed when an attestation is missing
or cannot be parsed.

`make validate` remains the full repository pre-handoff command and must
orchestrate the ordered docs sequence above as one acceptance run, in addition
to the remaining repository validation lanes. Unrelated lanes may run before
or alongside that chain only when they cannot mutate `apps/docs/dist`. Any
docs build after the post-build verifier creates a new acceptance object and
invalidates the artifact and browser attestations; Gates 2–3 must then rerun
against the replacement.

Every required docs lane reports `derived_required`, `executed`, `passed`,
`failed`, and `skipped` case inventories. Its required cases come from the
authoritative sets and declared interaction matrix, not an arbitrary quota.
The aggregate fails unless every lane has a nonzero required inventory,
`executed` equals `derived_required`, `passed` equals `derived_required`, and
both `failed` and `skipped` are zero. A path-topology assertion is not a docs
acceptance lane.

Release commands must build or select the accepted docs artifact and deploy
`apps/docs/dist`. They must not upload `.output/public`, depend on a runtime
server, or silently substitute a second docs build after acceptance.

## Required handoff record

The implementation handoff reports:

- accepted repository commit and artifact digest
- derived source, authored, category, operation, canonical, redirect, removed,
  sitemap, and search inventories
- exact set differences for each equality check
- source/spec integrity result
- commit-bound editorial review result and sanitized public attestation or
  opaque record identifier
- production build command and result
- post-build artifact verifier result
- local production-preview browser result, viewports, and appearance modes
- `make validate` result proving every required docs lane executed with nonzero
  required cases derived from its authoritative inventory, with executed,
  passed, failed, and skipped case inventories
- Pages preview result and deployment identity, or `NOT RUN`/`Blocked`
- separately authorized production-promotion result, or `NOT RUN`/`Blocked`
- post-promotion live-smoke result and production deployment identity, or
  `NOT RUN`/`Blocked`
- every retry and residual ambiguity

Hermetic evidence and live dependencies remain separate. No result is upgraded
from `NOT RUN`, `Blocked`, or `Not applicable` by inference.

## Resolution

Accept the rebuilt documentation only through the four gates above. Derive and
compare complete source, route, redirect, spec, hierarchy, search, and sitemap
sets; inspect real static HTML and assets; exercise hydrated production
behavior; require commit-bound human editorial review; then prove the exact
artifact on a Cloudflare Pages preview. A passing preview makes the artifact
eligible but does not authorize promotion. After separately authorized
promotion, use the small production smoke only to confirm that the accepted
artifact reached the live domain.
