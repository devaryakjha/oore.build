# Feature Development Guide

This document describes the systematic process for developing features in oore.build. Every feature should be complete across all layers to ensure consistent user experience.

## Philosophy

Every feature in oore.build should be complete across all layers:

- **Server**: API endpoint, database, business logic
- **TUI**: Terminal interface (screens, commands)
- **Web UI**: Browser interface (pages, components)
- **Tests**: Each layer tested appropriately
- **Documentation**: User-facing docs updated

## Feature Checklist Template

Use this checklist when developing or auditing features:

### Server Layer

- [ ] API endpoint(s) implemented
- [ ] Database schema/migrations (if needed)
- [ ] Input validation
- [ ] Error handling with proper status codes
- [ ] Integration tests in `crates/oore-server/tests/api_tests.rs`

### TUI Layer

- [ ] Screen/view implemented (if applicable)
- [ ] CLI command(s) for non-interactive mode
- [ ] Loading and error states
- [ ] Keyboard shortcuts documented
- [ ] Works offline/gracefully handles server unavailable

### Web UI Layer

- [ ] Page(s) implemented
- [ ] Components follow shadcn/base-ui patterns
- [ ] Responsive design
- [ ] Loading and error states
- [ ] Matches TUI functionality

### Documentation

- [ ] API reference updated (`docs/src/content/docs/reference/api.mdx`)
- [ ] CLI/TUI reference updated (`docs/src/content/docs/reference/cli.mdx`)
- [ ] User guide updated (if user-facing workflow changed)
- [ ] User journey added to `documentation/user-journeys.md`

### Testing

- [ ] Server: API integration tests
- [ ] TUI: Smoke tests in `tests/cli/smoke_test.sh`
- [ ] QA checklist items in `documentation/qa-checklist.md`

---

## Feature Tiers

Not all features need equal treatment. Classify features by importance:

### Tier 1 (Core) - Full Audit

Features users interact with constantly. Need complete coverage across all layers.

- Repository Management
- Build Execution
- Build Logs
- Pipeline Configuration

### Tier 2 (Important) - Standard Audit

Features used regularly but not constantly. Need good coverage but can defer some edge cases.

- Code Signing (iOS/Android)
- Artifact Management
- GitHub Integration
- GitLab Integration
- Webhook Management

### Tier 3 (Supporting) - Light Audit

Infrastructure features, rarely user-facing directly.

- Health Check
- Version Info
- Service Management
- Demo Mode
- Credential Encryption (internal)

---

## Workflow

### 1. Pick a Feature

Select a feature from `documentation/FEATURE_ROADMAP.md` or a new requirement.

### 2. Audit Current State

Determine what exists in each layer:

- **Server**: Check `crates/oore-server/src/routes/` for endpoints
- **TUI**: Check `crates/oore-tui/src/` for screens/commands
- **Web UI**: Check `web/src/app/` for pages
- **Tests**: Check test files for coverage
- **Docs**: Check `docs/src/content/docs/` for documentation

### 3. Identify Gaps

Compare against the feature checklist. Common gaps:

- API exists but TUI command missing
- Feature works but has no tests
- Docs outdated or missing
- Error handling incomplete

### 4. Implement Fixes

Address gaps in priority order:

1. Server (foundation for everything)
2. TUI (primary interface)
3. Web UI (secondary interface)
4. Tests (validation)
5. Docs (discoverability)

### 5. Test

Verify all layers work correctly:

```bash
# API tests
cargo test -p oore-server --test api_tests

# TUI smoke tests (server must be running)
./tests/cli/smoke_test.sh --token "$TOKEN"

# Web UI (manual verification)
cd web && bun dev
```

### 6. Document

Update relevant documentation:

- `documentation/user-journeys.md` - User scenarios
- `documentation/qa-checklist.md` - Manual test items
- `docs/src/content/docs/` - Public docs

### 7. Mark Complete

Update `documentation/FEATURE_ROADMAP.md` with completion status.

---

## Interface Consistency

### Command Naming

TUI commands should match API concepts:

| API Endpoint | TUI Command |
|--------------|-------------|
| `GET /api/repositories` | `oore repo list` |
| `POST /api/repositories` | `oore repo add` |
| `GET /api/repositories/:id` | `oore repo show <id>` |
| `DELETE /api/repositories/:id` | `oore repo remove <id>` |

### Output Formatting

- **List commands**: Table format with ID, key fields
- **Show commands**: Detailed view with all fields
- **Success messages**: Brief confirmation
- **Error messages**: Clear problem + suggestion

### Error Handling Patterns

All interfaces should handle these error classes consistently:

| Error Class | Server Response | TUI Behavior | Web UI Behavior |
|-------------|-----------------|--------------|-----------------|
| Network error | N/A | "Cannot connect to server" | Toast + retry option |
| Auth error | 401 | "Invalid or missing token" | Redirect to login |
| Not found | 404 | "Resource not found" | Error page |
| Validation | 400/422 | "Invalid input: {details}" | Field-level errors |
| Server error | 500 | "Server error: {request_id}" | Error page |

---

## Personal Notes & Research

**Important:** Personal research, plans, and working notes should be kept in:

```
~/project_logs/oore.build/
├── daily notes/    # Session logs (YYYY-MM-DD.md)
├── plans/          # Implementation plans
├── research/       # Feature research, analysis
└── tasks/          # Task tracking
```

These are NOT committed to git. The repository should only contain finalized documentation.

### What Goes Where

| Content | Location | Version Controlled |
|---------|----------|-------------------|
| User journeys | `documentation/user-journeys.md` | Yes |
| QA checklists | `documentation/qa-checklist.md` | Yes |
| Testing guide | `documentation/TESTING.md` | Yes |
| Feature roadmap | `documentation/FEATURE_ROADMAP.md` | Yes |
| Daily session notes | `~/project_logs/oore.build/daily notes/` | No |
| Implementation plans | `~/project_logs/oore.build/plans/` | No |
| Research notes | `~/project_logs/oore.build/research/` | No |

---

## Adding New Features

### Step 1: Design

Before writing code:

1. Document the user journey in `documentation/user-journeys.md`
2. Identify all interfaces needed (API, TUI, Web)
3. Plan database schema changes (if any)

### Step 2: Server Implementation

1. Add/update database migrations in `crates/oore-core/migrations/`
2. Add models in `crates/oore-core/src/models/`
3. Add repository queries in `crates/oore-core/src/db/`
4. Add API routes in `crates/oore-server/src/routes/`
5. Write integration tests in `crates/oore-server/tests/api_tests.rs`

### Step 3: TUI Implementation

1. Add commands in `crates/oore-tui/src/commands/`
2. Add screens in `crates/oore-tui/src/ui/` (if interactive)
3. Add smoke test cases in `tests/cli/smoke_test.sh`

### Step 4: Web UI Implementation

1. Add pages in `web/src/app/`
2. Add components using shadcn/base-ui
3. Add API client functions in `web/src/lib/api/`
4. Verify responsive design

### Step 5: Documentation

1. Update API reference (`docs/src/content/docs/reference/api.mdx`)
2. Update CLI reference (`docs/src/content/docs/reference/cli.mdx`)
3. Update user guides if workflows changed
4. Add QA checklist items

---

## Code Review Checklist

When reviewing feature implementations:

### Server
- [ ] Endpoints follow REST conventions
- [ ] Input validation complete
- [ ] Errors return appropriate status codes
- [ ] Sensitive data not logged
- [ ] Tests cover happy path and error cases

### TUI
- [ ] Commands match API capability
- [ ] Help text accurate
- [ ] Error messages helpful
- [ ] Works without network (shows appropriate error)

### Web UI
- [ ] Matches TUI functionality
- [ ] Loading states present
- [ ] Error states present
- [ ] Responsive design works
- [ ] No console errors

### Documentation
- [ ] API reference accurate
- [ ] CLI reference accurate
- [ ] Examples work
- [ ] No broken links
