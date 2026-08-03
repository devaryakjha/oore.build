.PHONY: dev-web dev-docs preview-docs preview-docs-production dev-site generate-og build-web bundle-check build-demo deploy-demo deploy-web build-site deploy-site build-docs deploy-docs build-release-index deploy-release-index-only test-release-index test-release-smoke test-release-upgrade test-release-artifacts web-performance-baseline test-web-runtime-performance-report test-web-runtime-performance test-web-runtime-performance-scheduled build check \
		       test-web test-web-ui install-web-browsers-scheduled test-web-ui-scheduled test-demo lint-web fix-web lint-site fix-site \
		       test-direct-runner-upgrade-smoke \
		       check-docs-types check-docs-examples generate-docs-redirects check-docs-redirects docs-artifact-manifest test-docs test-docs-source test-docs-editorial test-docs-build install-docs-browser test-docs-browser lint-docs fix-docs knip-web test-rust test-rust-pr test-rust-scheduled test-rust-integration test-install \
		       test-required-result install-actionlint validate-workflows validate-shell validate-ci validate-required-result validate-web-launcher \
		       format-oxc format-oxc-check fmt-rust fmt-rust-check clippy-rust compile-rust test-rust-workspace lint test \
		       cargo-check run-daemon run-daemon-debug run-daemon-release \
		       run-runner register-runner run-cli doctor clean-dev-state dev-fresh-setup \
		       install-local validate validate-frontend validate-docs validate-rust-pr validate-pr validate-scheduled validate-release gen-openapi check-openapi release-smoke \
		       direct-runner-upgrade-smoke \
		       portless-proxy portless-alias-api portless-list

RUNNER_DAEMON_URL ?= http://127.0.0.1:8787
RUNNER_CONFIG ?= $(HOME)/.oore/runner.json
RUNNER_SESSION_TOKEN ?=
RUNNER_NAME ?= $(shell hostname)
OORED_LOG_LEVEL ?= info
OORED_DEV_DATA_DIR ?= $(HOME)/.oore/dev.noindex
OORE_DEV_SETUP_STATE_FILE ?= $(OORED_DEV_DATA_DIR)/oore.db
OORED_DEV_LISTEN_ADDR ?= 127.0.0.1:8787
OORED_DEV_DAEMON_URL ?= http://$(OORED_DEV_LISTEN_ADDR)
OORE_DEV_ENABLE_TUNNEL ?= 1
OORE_DEV_SETUP_MODE ?= token
# Wrangler is Node-backed. Running it via `bunx --bun` has proven flaky on macOS
# (observed silent failures in CI and locally). Use the real `wrangler` binary
# by default and install/pin it in CI.
WRANGLER ?= wrangler
PAGES_PROJECT_WEB ?= oore-ci
PAGES_PROJECT_DEMO ?= oore-demo
PAGES_PROJECT_SITE ?= oore
PAGES_PROJECT_DOCS ?= oore-docs
PAGES_PROJECT_RELEASES ?= oore-releases
PAGES_RELEASES_BRANCH ?= production
PAGES_BRANCH ?=
PAGES_COMMIT_HASH ?=
PAGES_COMMIT_MESSAGE ?=
RELEASE_INDEX_SOURCE ?= dist/github-releases.json
RELEASE_INDEX_OUTPUT ?= dist/release-index
RELEASE_INDEX_REPOSITORY ?= oore-ci/oore.build
SCHEDULED_PERFORMANCE_OUTPUT_DIR ?= apps/web/dist/scheduled-performance
SCHEDULED_PERFORMANCE_BASELINE ?=
SCHEDULED_PERFORMANCE_BASELINE_URL ?=
ACTIONLINT_VERSION ?= v1.7.12
RUST_PR_INTEGRATION_TESTS := \
	--test artifact_storage_settings_integration \
	--test auth_lifecycle_integration \
	--test build_concurrency \
	--test build_reproducibility_integration \
	--test embedded_runner_integration \
	--test external_access_oidc_integration \
	--test external_access_security_integration \
	--test integration_deletion \
	--test local_login_integration \
	--test local_recovery_integration \
	--test no_worry_runner_migration \
	--test notification_security_integration \
	--test retention_security_integration \
	--test runner_integration \
	--test setup_integration \
	--test user_preview_integration \
	--test webhook_integration
RUST_SCHEDULED_INTEGRATION_TESTS := \
	--test audit_logs_integration \
	--test oidc_start_integration \
	--test web_performance_integration

# If PAGES_BRANCH is set (e.g. alpha/beta), deploy to a Pages preview branch.
# Important: avoid leaving behind extra whitespace in the shell command when unset.
# `$(if ...)` preserves the leading space in the "then" clause, while plain `:=` assignments do not.
PAGES_BRANCH_FLAG :=$(if $(strip $(PAGES_BRANCH)), --branch=$(PAGES_BRANCH),)
PAGES_COMMIT_HASH_FLAG :=$(if $(strip $(PAGES_COMMIT_HASH)), --commit-hash=$(PAGES_COMMIT_HASH),)
PAGES_COMMIT_MESSAGE_FLAG :=$(if $(strip $(PAGES_COMMIT_MESSAGE)), --commit-message=$(PAGES_COMMIT_MESSAGE),)

# ── Frontend: Web App ─────────────────────────────────────────────
generate-og:
	bun run generate:og

dev-web:
	bun run dev:web

build-web: generate-og
	cd apps/web && bun run build

bundle-check: build-web
	bun run bundle:check

deploy-web: build-web
	$(WRANGLER) pages deploy apps/web/dist --project-name=$(PAGES_PROJECT_WEB)$(PAGES_BRANCH_FLAG)$(PAGES_COMMIT_HASH_FLAG)$(PAGES_COMMIT_MESSAGE_FLAG) --commit-dirty=true

deploy-web-only:
	$(WRANGLER) pages deploy apps/web/dist --project-name=$(PAGES_PROJECT_WEB)$(PAGES_BRANCH_FLAG)$(PAGES_COMMIT_HASH_FLAG)$(PAGES_COMMIT_MESSAGE_FLAG) --commit-dirty=true

run-demo:
	cd apps/web && VITE_DEMO_MODE=true bun run dev

build-demo: generate-og
	cd apps/web && VITE_DEMO_MODE=true bun run build

deploy-demo: build-demo
	$(WRANGLER) pages deploy apps/web/dist --project-name=$(PAGES_PROJECT_DEMO)$(PAGES_BRANCH_FLAG)$(PAGES_COMMIT_HASH_FLAG)$(PAGES_COMMIT_MESSAGE_FLAG) --commit-dirty=true

deploy-demo-only:
	$(WRANGLER) pages deploy apps/web/dist --project-name=$(PAGES_PROJECT_DEMO)$(PAGES_BRANCH_FLAG)$(PAGES_COMMIT_HASH_FLAG)$(PAGES_COMMIT_MESSAGE_FLAG) --commit-dirty=true

test-web:
	cd apps/web && bun run test

test-web-ui: build-demo
	cd apps/web && bun run test:ui

install-web-browsers-scheduled:
	cd apps/web && bunx playwright install --with-deps chromium firefox webkit

test-web-ui-scheduled: build-demo
	cd apps/web && bun run test:ui:scheduled

web-performance-browser-prototype: build-demo
	cd apps/web && bun run performance:browser:prototype

web-performance-browser-prototype-pr: build-demo
	cd apps/web && bun run performance:browser:prototype:pr

web-performance-browser-prototype-scheduled: build-demo
	cd apps/web && bun run performance:browser:prototype:scheduled

test-demo:
	cd apps/web && bun run test src/demo/demo.test.ts src/hooks/use-permissions.test.ts

lint-web:
	cd apps/web && bun run lint

knip-web:
	cd apps/web && bun run knip

fix-web:
	cd apps/web && bun run fix

# ── Frontend: Docs Site (Astro + Fumadocs static output) ──────────
dev-docs:
	bun run dev:docs

preview-docs:
	cd apps/docs && bun run preview

preview-docs-production:
	cd apps/docs && bun run preview:production

dev-site:
	bun run dev:site

build-docs: generate-og
	cd apps/docs && bun run docs:build

build-site: generate-og
	cd apps/site && bun run build

deploy-site: build-site
	$(WRANGLER) pages deploy apps/site/dist --project-name=$(PAGES_PROJECT_SITE)$(PAGES_BRANCH_FLAG)$(PAGES_COMMIT_HASH_FLAG)$(PAGES_COMMIT_MESSAGE_FLAG) --commit-dirty=true

deploy-site-only:
	$(WRANGLER) pages deploy apps/site/dist --project-name=$(PAGES_PROJECT_SITE)$(PAGES_BRANCH_FLAG)$(PAGES_COMMIT_HASH_FLAG)$(PAGES_COMMIT_MESSAGE_FLAG) --commit-dirty=true

deploy-docs: build-docs
	$(WRANGLER) pages deploy apps/docs/dist --project-name=$(PAGES_PROJECT_DOCS)$(PAGES_BRANCH_FLAG)$(PAGES_COMMIT_HASH_FLAG)$(PAGES_COMMIT_MESSAGE_FLAG) --commit-dirty=true

deploy-docs-only:
	$(WRANGLER) pages deploy apps/docs/dist --project-name=$(PAGES_PROJECT_DOCS)$(PAGES_BRANCH_FLAG)$(PAGES_COMMIT_HASH_FLAG)$(PAGES_COMMIT_MESSAGE_FLAG) --commit-dirty=true

# ── Release discovery index ───────────────────────────────────────
build-release-index:
	bun tools/generate-release-index.ts $(RELEASE_INDEX_SOURCE) $(RELEASE_INDEX_OUTPUT) $(RELEASE_INDEX_REPOSITORY)

deploy-release-index-only:
	$(WRANGLER) pages deploy $(RELEASE_INDEX_OUTPUT) --project-name=$(PAGES_PROJECT_RELEASES) --branch=$(PAGES_RELEASES_BRANCH)$(PAGES_COMMIT_HASH_FLAG)$(PAGES_COMMIT_MESSAGE_FLAG) --commit-dirty=true

test-release-index:
	bun test tools/generate-release-index.test.ts

test-release-smoke:
	bun test tools/release-smoke.test.ts

test-release-upgrade:
	cargo test -p oore --bin oore --locked

test-release-artifacts:
	cargo test -p oored --features test-support --test artifact_storage_settings_integration --locked

test-direct-runner-upgrade-smoke:
	bun test tools/direct-runner-upgrade-smoke.test.ts

test-required-result:
	bun test tools/validate-required-result.test.ts

web-performance-baseline:
	bun tools/web-performance-baseline.ts

test-web-runtime-performance-report:
	bun test tools/web-runtime-performance.test.ts

test-web-runtime-performance: test-web-runtime-performance-report
	bun tools/web-runtime-performance.ts

test-web-runtime-performance-scheduled: test-web-runtime-performance-report
	mkdir -p $(SCHEDULED_PERFORMANCE_OUTPUT_DIR)
	OORE_WEB_PERFORMANCE_REPORT=$(SCHEDULED_PERFORMANCE_OUTPUT_DIR)/web-runtime.json \
		OORE_WEB_PERFORMANCE_SUMMARY=$(SCHEDULED_PERFORMANCE_OUTPUT_DIR)/web-runtime.md \
		OORE_WEB_PERFORMANCE_BASELINE=$(SCHEDULED_PERFORMANCE_BASELINE) \
		OORE_WEB_PERFORMANCE_BASELINE_URL=$(SCHEDULED_PERFORMANCE_BASELINE_URL) \
		bun tools/web-runtime-performance.ts

test-docs:
	$(MAKE) test-docs-source

check-docs-types:
	cd apps/docs && bun run types:check

generate-docs-redirects:
	cd apps/docs && bun run generate:redirects

check-docs-redirects:
	cd apps/docs && bun run check:redirects

check-docs-examples:
	cd apps/docs && bun run check:examples

docs-artifact-manifest:
	cd apps/docs && bun run artifact:manifest

test-docs-source: check-openapi check-docs-redirects check-docs-examples
	cd apps/docs && bun run test:source

test-docs-editorial:
	cd apps/docs && bun run test:editorial

test-docs-build:
	cd apps/docs && bun run test:build

install-docs-browser:
	cd apps/docs && bunx playwright install --with-deps chromium

test-docs-browser:
	cd apps/docs && bun run test:browser

lint-docs: lint-site
	cd apps/docs && bun run lint

fix-docs:
	cd apps/docs && bun run fix

lint-site:
	cd apps/site && bun run lint

fix-site:
	cd apps/site && bun run fix

# ── Backend (Rust) ────────────────────────────────────────────────
cargo-check:
	cargo check --workspace --locked

run-daemon:
	OORED_DATA_DIR=$(OORED_DEV_DATA_DIR) OORE_SETUP_STATE_FILE=$(OORE_DEV_SETUP_STATE_FILE) RUST_LOG=$(OORED_LOG_LEVEL) cargo run -p oored --bin oored -- run --listen $(OORED_DEV_LISTEN_ADDR)

run-daemon-debug:
	OORED_DATA_DIR=$(OORED_DEV_DATA_DIR) OORE_SETUP_STATE_FILE=$(OORE_DEV_SETUP_STATE_FILE) RUST_LOG=debug cargo run -p oored --bin oored -- run --listen $(OORED_DEV_LISTEN_ADDR)

run-daemon-release:
	OORED_DATA_DIR=$(OORED_DEV_DATA_DIR) OORE_SETUP_STATE_FILE=$(OORE_DEV_SETUP_STATE_FILE) RUST_LOG=info cargo run -p oored --release --bin oored --locked -- run --listen $(OORED_DEV_LISTEN_ADDR)

run-runner:
	cargo run -p oore -- runner start --daemon-url $(RUNNER_DAEMON_URL) --config $(RUNNER_CONFIG)

register-runner:
	@test -n "$(RUNNER_SESSION_TOKEN)" || (echo "RUNNER_SESSION_TOKEN is required"; exit 1)
	cargo run -p oore -- runner register --daemon-url $(RUNNER_DAEMON_URL) --token $(RUNNER_SESSION_TOKEN) --name "$(RUNNER_NAME)"

run-cli:
	OORED_DATA_DIR=$(OORED_DEV_DATA_DIR) OORE_SETUP_STATE_FILE=$(OORE_DEV_SETUP_STATE_FILE) OORE_DAEMON_URL=$(OORED_DEV_DAEMON_URL) cargo run -p oore -- setup --daemon-url $(OORED_DEV_DAEMON_URL) token --ttl 15m

doctor:
	cargo run -p oore -- doctor

clean-dev-state:
	OORED_DEV_DATA_DIR=$(OORED_DEV_DATA_DIR) OORED_DEV_LISTEN_ADDR=$(OORED_DEV_LISTEN_ADDR) OORE_DEV_DAEMON_URL=$(OORED_DEV_DAEMON_URL) bash tools/clean-dev-state.sh

dev-fresh-setup:
	OORED_DEV_DATA_DIR=$(OORED_DEV_DATA_DIR) OORE_DEV_SETUP_STATE_FILE=$(OORE_DEV_SETUP_STATE_FILE) OORED_DEV_LISTEN_ADDR=$(OORED_DEV_LISTEN_ADDR) OORE_DEV_DAEMON_URL=$(OORED_DEV_DAEMON_URL) OORE_DEV_ENABLE_TUNNEL=$(OORE_DEV_ENABLE_TUNNEL) OORE_DEV_SETUP_MODE=$(OORE_DEV_SETUP_MODE) bash tools/dev-fresh-setup.sh

install-local:
	bash scripts/install.sh

test-rust: test-rust-integration

# Pull requests retain focused invariant tests plus public security, persistence,
# recovery, lifecycle, protocol, artifact, signing, and migration seams.
test-rust-pr:
	cargo test --workspace --lib --bins --all-features --locked
	cargo test -p oored --features test-support --locked --no-fail-fast $(RUST_PR_INTEGRATION_TESTS)

# Scheduled validation adds deterministic operational diagnostics that do not
# change the normal Rust merge decision.
test-rust-scheduled: test-rust-pr
	cargo test -p oored --features test-support --locked --no-fail-fast $(RUST_SCHEDULED_INTEGRATION_TESTS)

# Full daemon integration entry point retained for diagnostics and release work.
test-rust-integration:
	cargo test -p oored --features test-support --locked --no-fail-fast

test-install:
	bash scripts/install-acceptance.sh

# ── Rust: Lint/Fmt/Clippy/Test ───────────────────────────────────
fmt-rust:
	cargo fmt

fmt-rust-check:
	cargo fmt --check

clippy-rust:
	cargo clippy --workspace --all-targets --all-features --locked -- -D warnings -D clippy::redundant_clone

compile-rust:
	cargo test --workspace --all-targets --all-features --locked --no-run

test-rust-workspace:
	cargo test --workspace --locked

# Release automation lives in GitHub Actions (tag -> GitHub release).
# ── OpenAPI Spec Generation ───────────────────────────────────────
gen-openapi:
	cargo run -p oored --bin openapi-export --locked > apps/docs/public/openapi.json
	@echo "OpenAPI spec generated → apps/docs/public/openapi.json"

check-openapi:
	@set -eu; \
		openapi_tmp="$$(mktemp)"; \
		trap 'rm -f "$$openapi_tmp"' EXIT; \
		cargo run -p oored --bin openapi-export --locked > "$$openapi_tmp"; \
		if ! cmp -s apps/docs/public/openapi.json "$$openapi_tmp"; then \
			echo "apps/docs/public/openapi.json is stale; run make gen-openapi"; \
			exit 1; \
		fi

# ── Portless (named .localhost URLs for dev) ─────────────────────
# Start the portless reverse proxy (run once, stays in background)
portless-proxy:
	portless proxy start

# Alias the oored daemon so it's reachable at api.localhost:1355
portless-alias-api:
	portless alias api.oore $(lastword $(subst :, ,$(OORED_DEV_LISTEN_ADDR)))

# Show all active portless routes
portless-list:
	portless list

# ── Aggregate Targets ─────────────────────────────────────────────
format-oxc:
	bun run format

format-oxc-check:
	bun run format:check

build: build-web build-docs build-site cargo-check

check: format-oxc-check lint-web lint-docs lint-site cargo-check

lint: format-oxc-check lint-web lint-docs lint-site fmt-rust-check

test: test-web test-docs test-release-index test-rust-pr

install-actionlint:
	go install github.com/rhysd/actionlint/cmd/actionlint@$(ACTIONLINT_VERSION)

validate-workflows:
	actionlint .github/workflows/*.yml

validate-shell:
	shellcheck --severity=error scripts/*.sh tools/*.sh
	bash -n scripts/*.sh tools/*.sh

validate-ci: validate-workflows validate-shell test-release-index test-release-smoke test-direct-runner-upgrade-smoke test-required-result

validate-web-launcher: build-web
	bash tools/validate-standalone-web.sh

validate-required-result:
	bash tools/validate-required-result.sh

validate-frontend: format-oxc-check lint-web knip-web test-web bundle-check validate-web-launcher test-web-ui

validate-docs:
	$(MAKE) format-oxc-check lint-docs test-docs-source test-docs-editorial check-docs-types
	$(MAKE) build-docs build-site
	$(MAKE) test-docs-build
	$(MAKE) install-docs-browser
	$(MAKE) test-docs-browser

validate-rust-pr: fmt-rust-check clippy-rust test-rust-pr

validate: validate-ci validate-frontend validate-docs validate-rust-pr

validate-pr: validate

validate-scheduled: validate test-rust-scheduled test-web-ui-scheduled test-web-runtime-performance-scheduled

validate-release: validate-scheduled release-smoke

direct-runner-upgrade-smoke:
	@test -n "$$OORE_UPGRADE_SMOKE_SESSION_TOKEN" || (echo "OORE_UPGRADE_SMOKE_SESSION_TOKEN is required"; exit 1)
	@test -n "$$OORE_UPGRADE_SMOKE_EXPECTED_VERSION" || (echo "OORE_UPGRADE_SMOKE_EXPECTED_VERSION is required"; exit 1)
	@bun tools/direct-runner-upgrade-smoke.ts

release-smoke:
	bash tools/release-smoke.sh
