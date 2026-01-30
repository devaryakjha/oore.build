# Feature Audit Roadmap (TUI Migration)

This document tracks the feature audit status during the TUI migration. Every feature should be verified across all layers: Server API, TUI, Web UI, Tests, and Documentation.

## Status Legend

- ⬜ Not started
- 🔍 Needs review (exists but not audited)
- 🔄 In progress
- ✅ Complete (audited and verified)

---

## Tier 1: Core Features

### Repository Management

| Layer | Status | Notes |
|-------|--------|-------|
| Server API | 🔍 | CRUD exists, needs review |
| TUI | ⬜ | Repos screen needed |
| Web UI | 🔍 | Pages exist, needs UX review |
| Tests | ⬜ | Need API + TUI tests |
| Docs | ⬜ | Update for TUI |

**Endpoints**: `GET/POST /api/repositories`, `GET/DELETE /api/repositories/:id`

### Build Execution

| Layer | Status | Notes |
|-------|--------|-------|
| Server API | 🔍 | Exists, needs review |
| TUI | ⬜ | Builds screen, trigger flow |
| Web UI | 🔍 | Pages exist, needs UX review |
| Tests | ⬜ | Need API + TUI tests |
| Docs | ⬜ | Update for TUI |

**Endpoints**: `GET /api/builds`, `GET /api/builds/:id`, `POST /api/repositories/:id/trigger`, `POST /api/builds/:id/cancel`

### Build Logs

| Layer | Status | Notes |
|-------|--------|-------|
| Server API | 🔍 | Polling exists, needs review |
| TUI | ⬜ | Live logs screen |
| Web UI | 🔍 | Viewer exists, needs UX review |
| Tests | ⬜ | Need streaming tests |
| Docs | ⬜ | Update for TUI |

**Endpoints**: `GET /api/builds/:id/logs`, `GET /api/builds/:id/steps`

### Pipeline Configuration

| Layer | Status | Notes |
|-------|--------|-------|
| Server API | 🔍 | Exists, needs review |
| TUI | ⬜ | Pipeline view/edit |
| Web UI | 🔍 | Basic view, needs UX review |
| Tests | ⬜ | Need validation tests |
| Docs | 🔍 | Guide exists, needs review |

**Endpoints**: `GET/PUT/DELETE /api/repositories/:id/pipeline`

---

## Tier 2: Important Features

### Code Signing (iOS)

| Layer | Status | Notes |
|-------|--------|-------|
| Server API | 🔍 | Exists, needs review |
| TUI | ⬜ | Signing screen/commands |
| Web UI | 🔍 | Pages exist, needs UX review |
| Tests | ⬜ | Need upload tests |
| Docs | ⬜ | Signing guide needed |

**Endpoints**: `GET/POST /api/repositories/:id/signing/certificates`, `GET/POST /api/repositories/:id/signing/profiles`

### Code Signing (Android)

| Layer | Status | Notes |
|-------|--------|-------|
| Server API | 🔍 | Exists, needs review |
| TUI | ⬜ | Signing screen/commands |
| Web UI | 🔍 | Pages exist, needs UX review |
| Tests | ⬜ | Need upload tests |
| Docs | ⬜ | Signing guide needed |

**Endpoints**: `GET/POST /api/repositories/:id/signing/keystores`

### Artifact Management

| Layer | Status | Notes |
|-------|--------|-------|
| Server API | 🔍 | Exists, needs review |
| TUI | ⬜ | Artifacts in build view |
| Web UI | 🔍 | Exists, needs UX review |
| Tests | ⬜ | Need download tests |
| Docs | ⬜ | Artifact guide needed |

**Endpoints**: `GET /api/builds/:id/artifacts`, `GET /api/builds/:id/artifacts/:artifact_id/download`

### GitHub Integration

| Layer | Status | Notes |
|-------|--------|-------|
| Server API | 🔍 | Exists, needs review |
| TUI | ⬜ | Settings screen setup flow |
| Web UI | 🔍 | Exists, needs UX review |
| Tests | ⬜ | OAuth flow tests |
| Docs | 🔍 | Guide exists, needs review |

**Endpoints**: `GET /api/github/status`, `POST /api/github/setup/*`, `GET /api/github/installations`

### GitLab Integration

| Layer | Status | Notes |
|-------|--------|-------|
| Server API | 🔍 | Exists, needs review |
| TUI | ⬜ | Settings screen setup flow |
| Web UI | 🔍 | Exists, needs UX review |
| Tests | ⬜ | OAuth flow tests |
| Docs | 🔍 | Guide exists, needs review |

**Endpoints**: `GET /api/gitlab/status`, `POST /api/gitlab/setup/*`, `GET /api/gitlab/projects`

### Webhook Management

| Layer | Status | Notes |
|-------|--------|-------|
| Server API | 🔍 | Exists, needs review |
| TUI | ⬜ | Webhooks screen |
| Web UI | 🔍 | Exists, needs UX review |
| Tests | ⬜ | Event listing tests |
| Docs | ⬜ | Webhook guide needed |

**Endpoints**: `GET /api/webhooks`, `GET /api/webhooks/:id`

---

## Tier 3: Supporting Features

### Health Check

| Layer | Status | Notes |
|-------|--------|-------|
| Server API | 🔍 | Exists, needs review |
| TUI | ⬜ | Status bar indicator |
| Web UI | 🔍 | Exists, needs UX review |
| Tests | 🔍 | Basic test exists |
| Docs | 🔍 | Exists, needs review |

**Endpoint**: `GET /api/health`

### Version Info

| Layer | Status | Notes |
|-------|--------|-------|
| Server API | 🔍 | Exists, needs review |
| TUI | ⬜ | About/help screen |
| Web UI | 🔍 | Exists, needs UX review |
| Tests | 🔍 | Basic test exists |
| Docs | 🔍 | Exists, needs review |

**Endpoint**: `GET /api/version`

### Service Management

| Layer | Status | Notes |
|-------|--------|-------|
| Server | 🔍 | Exists (oored commands) |
| TUI | N/A | Managed by oored, not oore |
| Web UI | N/A | Not applicable |
| Tests | ⬜ | Platform tests needed |
| Docs | 🔍 | Guide exists, needs review |

**Commands**: `oored install`, `oored start`, `oored stop`, `oored status`, `oored logs`

### Demo Mode

| Layer | Status | Notes |
|-------|--------|-------|
| Server | 🔍 | Exists, needs review |
| TUI | ⬜ | Works with demo data |
| Web UI | 🔍 | Exists, needs UX review |
| Tests | ⬜ | Demo mode tests |
| Docs | ⬜ | Demo guide needed |

**Env**: `OORE_DEMO_MODE=true`

---

## Implementation Order

For each feature (in tier order):

1. **Audit** - Review Server API, Web UI, existing tests, docs
2. **Fix gaps** - Address issues found in audit
3. **Build TUI** - Implement TUI screen/commands for the feature
4. **Test** - Add missing tests for all layers
5. **Document** - Update docs for the feature
6. **Mark complete** - All layers verified ✅

---

## Phase Sequence

### Phase 0: Foundation 🔄

- [x] Create documentation framework (FEATURE_DEVELOPMENT.md, FEATURE_ROADMAP.md)
- [x] Update CLAUDE.md with new guidelines
- [ ] Merge docs + landing into `site/`
- [ ] Consolidate env vars in `.env.example`
- [ ] Create oore-tui crate shell

### Phase 1: Tier 1 Features (Core) ⬜

- [ ] Repository Management
- [ ] Build Execution
- [ ] Build Logs
- [ ] Pipeline Configuration

### Phase 2: Tier 2 Features (Important) ⬜

- [ ] Code Signing (iOS + Android)
- [ ] Artifact Management
- [ ] GitHub Integration
- [ ] GitLab Integration
- [ ] Webhook Management

### Phase 3: Tier 3 Features (Supporting) ⬜

- [ ] Health Check
- [ ] Version Info
- [ ] Service Management
- [ ] Demo Mode

### Phase 4: Polish ⬜

- [ ] Command palette
- [ ] Help system / keybinding overlay
- [ ] Error states and offline handling
- [ ] Loading states

### Phase 5: Migration Complete ⬜

- [ ] Delete oore-cli crate
- [ ] Update all references (docs, README, etc.)
- [ ] Final documentation pass
- [ ] Release announcement

---

## Repo Structure Changes

### Priority 1: Merge `docs/` + `landing/` into `site/`

**Current:**
```
docs/      → https://docs.oore.build (Starlight/Astro)
landing/   → https://oore.build (Astro)
```

**Proposed:**
```
site/      → https://oore.build
           → /        (landing homepage)
           → /docs    (documentation)
```

**Benefits:**
- One Astro project instead of two
- Single Cloudflare Pages deployment
- Unified styling and navigation
- Easier to maintain

### Priority 2: Consolidate Environment Variables

Create single `.env.example` documenting all env vars:

```bash
# Server (oored)
DATABASE_URL=sqlite:///var/lib/oore/oore.db
OORE_BASE_URL=http://localhost:8080
OORE_ADMIN_TOKEN=your-admin-token
ENCRYPTION_KEY=your-64-char-hex-key

# Web Dashboard (Next.js)
NEXT_PUBLIC_API_URL=http://localhost:8080

# Site (Astro) - build time only
PUBLIC_SITE_URL=https://oore.build
```

### Priority 3: Shared TypeScript Types (Optional)

Create `types/` directory for shared API types between web dashboard and any future JS tooling.

---

## Updated Architecture (Post-Migration)

```
oore.build/
├── crates/
│   ├── oore-core/         # Shared: database, models, crypto
│   ├── oore-server/       # HTTP server (binary: oored)
│   └── oore-tui/          # TUI + CLI client (binary: oore)
│
├── web/                   # Next.js dashboard
│
├── site/                  # Unified docs + landing (Astro/Starlight)
│   ├── src/
│   │   ├── pages/         # Landing pages
│   │   └── content/docs/  # Documentation (MDX)
│   └── astro.config.mjs
│
├── documentation/         # Internal dev docs
│   ├── TESTING.md
│   ├── FEATURE_DEVELOPMENT.md
│   ├── FEATURE_ROADMAP.md
│   ├── user-journeys.md
│   └── qa-checklist.md
│
├── tests/                 # Cross-crate tests
│   ├── cli/
│   │   └── smoke_test.sh
│   └── specs/
│       └── *.feature
│
├── .env.example           # Consolidated env var documentation
├── Cargo.toml
├── Makefile
└── README.md
```

---

## Progress Log

Track high-level progress here. Detailed session notes go in `~/project_logs/oore.build/`.

| Date | Phase | Work Done |
|------|-------|-----------|
| 2026-01-31 | 0 | Created FEATURE_DEVELOPMENT.md and FEATURE_ROADMAP.md |
| 2026-01-31 | 0 | Updated CLAUDE.md with rules 8-9, TUI migration notes |
| | | |
