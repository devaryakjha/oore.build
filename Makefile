.PHONY: \
	build build-demo build-docs build-release-index build-site build-web \
	check check-docs-types check-openapi check-rust \
	clean-dev-state compile-web-release-launchers dev-demo dev-docs dev-fresh-setup dev-site dev-web doctor \
	deploy-demo deploy-demo-dist deploy-docs deploy-docs-dist \
	deploy-release-index-dist deploy-site deploy-site-dist deploy-web deploy-web-dist \
	fix format format-check format-rust format-rust-check \
	gen-openapi install-actionlint install-local \
	lint lint-docs lint-rust lint-site lint-web \
	package-release-assets preview-docs preview-site preview-web \
	register-runner release-smoke run-daemon run-runner setup-token \
	test test-release-artifacts test-release-upgrade test-rust test-rust-all test-web \
	validate validate-ci validate-docs validate-frontend validate-rust \
	validate-shell validate-web-launcher validate-workflows

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
WEB_RELEASE_ENTRY ?= apps/web/tools/oore-web.js
WEB_RELEASE_OUTPUT ?= dist
RELEASE_TAG ?=
RELEASE_OUTPUT ?= dist/releases/$(RELEASE_TAG)
RELEASE_FULL_ARM64_STAGE ?= dist/stage-arm64
RELEASE_FULL_X86_64_STAGE ?= dist/stage-x86_64
RELEASE_CLI_ARM64_STAGE ?= dist/stage-cli-darwin-arm64
RELEASE_CLI_X86_64_STAGE ?= dist/stage-cli-darwin-x86_64
RELEASE_WEB_DARWIN_ARM64_STAGE ?= dist/stage-web-darwin-arm64
RELEASE_WEB_DARWIN_X86_64_STAGE ?= dist/stage-web-darwin-x86_64
RELEASE_WEB_LINUX_ARM64_STAGE ?= dist/stage-web-linux-arm64
RELEASE_WEB_LINUX_X86_64_STAGE ?= dist/stage-web-linux-x86_64
ACTIONLINT_VERSION ?= v1.7.12
RUST_INTEGRATION_TESTS := \
	--test artifact_storage_settings_integration \
	--test audit_logs_integration \
	--test auth_lifecycle_integration \
	--test build_concurrency \
	--test build_reproducibility_integration \
	--test external_access_oidc_integration \
	--test external_access_security_integration \
	--test integration_deletion \
	--test local_login_integration \
	--test local_recovery_integration \
	--test logs_artifacts_integration \
	--test no_worry_runner_migration \
	--test notification_security_integration \
	--test project_pipeline_integration \
	--test retention_security_integration \
	--test runner_integration \
	--test setup_integration \
	--test webhook_integration

# If PAGES_BRANCH is set (e.g. alpha/beta), deploy to a Pages preview branch.
# Important: avoid leaving behind extra whitespace in the shell command when unset.
# `$(if ...)` preserves the leading space in the "then" clause, while plain `:=` assignments do not.
PAGES_BRANCH_FLAG :=$(if $(strip $(PAGES_BRANCH)), --branch=$(PAGES_BRANCH),)
PAGES_COMMIT_HASH_FLAG :=$(if $(strip $(PAGES_COMMIT_HASH)), --commit-hash=$(PAGES_COMMIT_HASH),)
PAGES_COMMIT_MESSAGE_FLAG :=$(if $(strip $(PAGES_COMMIT_MESSAGE)), --commit-message=$(PAGES_COMMIT_MESSAGE),)

# Web app
dev-web:
	cd apps/web && bun run dev

dev-demo:
	cd apps/web && bun run dev:demo

preview-web:
	cd apps/web && bun run preview

build-web:
	cd apps/web && bun run build

deploy-web: build-web
	$(WRANGLER) pages deploy apps/web/dist --project-name=$(PAGES_PROJECT_WEB)$(PAGES_BRANCH_FLAG)$(PAGES_COMMIT_HASH_FLAG)$(PAGES_COMMIT_MESSAGE_FLAG) --commit-dirty=true

deploy-web-dist:
	$(WRANGLER) pages deploy apps/web/dist --project-name=$(PAGES_PROJECT_WEB)$(PAGES_BRANCH_FLAG)$(PAGES_COMMIT_HASH_FLAG)$(PAGES_COMMIT_MESSAGE_FLAG) --commit-dirty=true

build-demo:
	cd apps/web && bun run build:demo

deploy-demo: build-demo
	$(WRANGLER) pages deploy apps/web/dist --project-name=$(PAGES_PROJECT_DEMO)$(PAGES_BRANCH_FLAG)$(PAGES_COMMIT_HASH_FLAG)$(PAGES_COMMIT_MESSAGE_FLAG) --commit-dirty=true

deploy-demo-dist:
	$(WRANGLER) pages deploy apps/web/dist --project-name=$(PAGES_PROJECT_DEMO)$(PAGES_BRANCH_FLAG)$(PAGES_COMMIT_HASH_FLAG)$(PAGES_COMMIT_MESSAGE_FLAG) --commit-dirty=true

test-web:
	cd apps/web && bun run test

lint-web:
	cd apps/web && bun run lint

# Documentation and public site
dev-docs:
	cd apps/docs && bun run dev

preview-docs:
	cd apps/docs && bun run preview

dev-site:
	cd apps/site && bun run dev

preview-site:
	cd apps/site && bun run preview

build-docs:
	cd apps/docs && bun run build

build-site:
	cd apps/site && bun run build

deploy-site: build-site
	$(WRANGLER) pages deploy apps/site/dist --project-name=$(PAGES_PROJECT_SITE)$(PAGES_BRANCH_FLAG)$(PAGES_COMMIT_HASH_FLAG)$(PAGES_COMMIT_MESSAGE_FLAG) --commit-dirty=true

deploy-site-dist:
	$(WRANGLER) pages deploy apps/site/dist --project-name=$(PAGES_PROJECT_SITE)$(PAGES_BRANCH_FLAG)$(PAGES_COMMIT_HASH_FLAG)$(PAGES_COMMIT_MESSAGE_FLAG) --commit-dirty=true

deploy-docs: build-docs
	$(WRANGLER) pages deploy apps/docs/dist --project-name=$(PAGES_PROJECT_DOCS)$(PAGES_BRANCH_FLAG)$(PAGES_COMMIT_HASH_FLAG)$(PAGES_COMMIT_MESSAGE_FLAG) --commit-dirty=true

deploy-docs-dist:
	$(WRANGLER) pages deploy apps/docs/dist --project-name=$(PAGES_PROJECT_DOCS)$(PAGES_BRANCH_FLAG)$(PAGES_COMMIT_HASH_FLAG)$(PAGES_COMMIT_MESSAGE_FLAG) --commit-dirty=true

# ── Release discovery index ───────────────────────────────────────
build-release-index:
	bun tools/generate-release-index.ts $(RELEASE_INDEX_SOURCE) $(RELEASE_INDEX_OUTPUT) $(RELEASE_INDEX_REPOSITORY)

compile-web-release-launchers:
	bash tools/compile-web-release-launchers.sh "$(WEB_RELEASE_ENTRY)" "$(WEB_RELEASE_OUTPUT)"

package-release-assets:
	@test -n "$(strip $(RELEASE_TAG))" || (echo "RELEASE_TAG is required" >&2; exit 2)
	bash tools/package-release-assets.sh \
		"$(RELEASE_TAG)" \
		"$(RELEASE_OUTPUT)" \
		"$(RELEASE_FULL_ARM64_STAGE)" \
		"$(RELEASE_FULL_X86_64_STAGE)" \
		"$(RELEASE_CLI_ARM64_STAGE)" \
		"$(RELEASE_CLI_X86_64_STAGE)" \
		"$(RELEASE_WEB_DARWIN_ARM64_STAGE)" \
		"$(RELEASE_WEB_DARWIN_X86_64_STAGE)" \
		"$(RELEASE_WEB_LINUX_ARM64_STAGE)" \
		"$(RELEASE_WEB_LINUX_X86_64_STAGE)"

deploy-release-index-dist:
	$(WRANGLER) pages deploy $(RELEASE_INDEX_OUTPUT) --project-name=$(PAGES_PROJECT_RELEASES) --branch=$(PAGES_RELEASES_BRANCH)$(PAGES_COMMIT_HASH_FLAG)$(PAGES_COMMIT_MESSAGE_FLAG) --commit-dirty=true

test-release-upgrade:
	cargo test -p oore --bin oore --locked

test-release-artifacts:
	cargo test -p oored --features test-support --test artifact_storage_settings_integration --locked
	cargo test -p oored --features test-support --test logs_artifacts_integration test_ios_install_manifest_and_qa_permissions --locked -- --exact
	cargo test -p oored --features test-support --test logs_artifacts_integration test_android_install_link_uses_protected_scoped_download --locked -- --exact
	cargo test -p oored --features test-support --test logs_artifacts_integration test_full_log_and_artifact_flow --locked -- --exact

check-docs-types:
	cd apps/docs && bun run types:check

lint-docs:
	cd apps/docs && bun run lint

lint-site:
	cd apps/site && bun run lint

# Rust
check-rust:
	cargo check --workspace --locked

run-daemon:
	OORED_DATA_DIR=$(OORED_DEV_DATA_DIR) OORE_SETUP_STATE_FILE=$(OORE_DEV_SETUP_STATE_FILE) RUST_LOG=$(OORED_LOG_LEVEL) cargo run -p oored --bin oored -- run --listen $(OORED_DEV_LISTEN_ADDR)

run-runner:
	cargo run -p oore -- runner start --daemon-url $(RUNNER_DAEMON_URL) --config $(RUNNER_CONFIG)

register-runner:
	@test -n "$(RUNNER_SESSION_TOKEN)" || (echo "RUNNER_SESSION_TOKEN is required"; exit 1)
	cargo run -p oore -- runner register --daemon-url $(RUNNER_DAEMON_URL) --token $(RUNNER_SESSION_TOKEN) --name "$(RUNNER_NAME)"

setup-token:
	OORED_DATA_DIR=$(OORED_DEV_DATA_DIR) OORE_SETUP_STATE_FILE=$(OORE_DEV_SETUP_STATE_FILE) OORE_DAEMON_URL=$(OORED_DEV_DAEMON_URL) cargo run -p oore -- setup --daemon-url $(OORED_DEV_DAEMON_URL) token --ttl 15m

doctor:
	cargo run -p oore -- doctor

clean-dev-state:
	OORED_DEV_DATA_DIR=$(OORED_DEV_DATA_DIR) OORED_DEV_LISTEN_ADDR=$(OORED_DEV_LISTEN_ADDR) OORE_DEV_DAEMON_URL=$(OORED_DEV_DAEMON_URL) bash tools/clean-dev-state.sh

dev-fresh-setup:
	OORED_DEV_DATA_DIR=$(OORED_DEV_DATA_DIR) OORE_DEV_SETUP_STATE_FILE=$(OORE_DEV_SETUP_STATE_FILE) OORED_DEV_LISTEN_ADDR=$(OORED_DEV_LISTEN_ADDR) OORE_DEV_DAEMON_URL=$(OORED_DEV_DAEMON_URL) OORE_DEV_ENABLE_TUNNEL=$(OORE_DEV_ENABLE_TUNNEL) OORE_DEV_SETUP_MODE=$(OORE_DEV_SETUP_MODE) bash tools/dev-fresh-setup.sh

install-local:
	bash scripts/install.sh

# Run the merge-critical Rust tests.
test-rust:
	cargo test --workspace --lib --bins --all-features --locked
	cargo test -p oore --test cli_integration --locked
	cargo test -p oored --features test-support --locked --no-fail-fast $(RUST_INTEGRATION_TESTS)

# Run every daemon integration test.
test-rust-all:
	cargo test -p oored --features test-support --locked --no-fail-fast

format-rust:
	cargo fmt

format-rust-check:
	cargo fmt --check

lint-rust:
	cargo clippy --workspace --all-targets --all-features --locked -- -D warnings -D clippy::redundant_clone

# OpenAPI
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

# Repository commands
format:
	bun run format

format-check:
	bun run format:check

fix:
	bun run format
	bun run lint:fix

build: build-web build-docs build-site

check: format-check lint check-rust

lint: lint-web lint-docs lint-site lint-rust

test: test-web test-rust

install-actionlint:
	go install github.com/rhysd/actionlint/cmd/actionlint@$(ACTIONLINT_VERSION)

validate-workflows:
	actionlint .github/workflows/*.yml

validate-shell:
	shellcheck --severity=error scripts/*.sh tools/*.sh
	bash -n scripts/*.sh tools/*.sh

validate-ci: validate-workflows validate-shell

validate-web-launcher: build-web
	bash tools/validate-standalone-web.sh

validate-frontend: format-check lint-web test-web validate-web-launcher

validate-docs: format-check lint-docs lint-site check-docs-types build-docs build-site

validate-rust: format-rust-check lint-rust check-openapi test-rust

validate: validate-ci validate-frontend validate-docs validate-rust

release-smoke:
	bash tools/release-smoke.sh
