.PHONY: help setup dev server cli web docs landing build test lint clean \
        server-bg server-stop logs install uninstall start stop status \
        landing-dev landing-build landing-deploy docs-dev docs-build docs-deploy

# Default target
help:
	@echo "Oore Development Commands"
	@echo "========================="
	@echo ""
	@echo "Setup & Development:"
	@echo "  make setup        - Run install.local.sh (first-time setup)"
	@echo "  make dev          - Start server + web dashboard (foreground)"
	@echo "  make server       - Start server only (foreground)"
	@echo "  make server-bg    - Start server in background (nohup)"
	@echo "  make server-stop  - Stop background server"
	@echo "  make logs         - Tail the background server logs"
	@echo "  make cli          - Run CLI (use: make cli ARGS='health')"
	@echo "  make web          - Start web dashboard dev server"
	@echo ""
	@echo "Build & Test:"
	@echo "  make build        - Build all Rust crates (debug)"
	@echo "  make build-release- Build all Rust crates (release)"
	@echo "  make test         - Run all tests"
	@echo "  make lint         - Run clippy linter"
	@echo "  make clean        - Clean build artifacts"
	@echo ""
	@echo "Service Management (requires sudo):"
	@echo "  make install      - Install as system service"
	@echo "  make uninstall    - Uninstall system service"
	@echo "  make start        - Start system service"
	@echo "  make stop         - Stop system service"
	@echo "  make status       - Show service status"
	@echo ""
	@echo "Landing & Docs:"
	@echo "  make landing-dev  - Start landing page dev server"
	@echo "  make landing-build- Build landing page"
	@echo "  make docs-dev     - Start docs dev server"
	@echo "  make docs-build   - Build docs"
	@echo ""

# =============================================================================
# Setup & Development
# =============================================================================

setup:
	./install.local.sh

dev:
	@echo "Starting server and web dashboard..."
	@echo "Press Ctrl+C to stop both"
	@trap 'kill 0' EXIT; \
		cargo run -p oore-server & \
		(cd web && bun dev) & \
		wait

server:
	cargo run -p oore-server

server-bg:
	@echo "Starting server in background..."
	@nohup cargo run -p oore-server > oored.log 2>&1 & echo $$! > .oored.pid
	@echo "Server started (PID: $$(cat .oored.pid))"
	@echo "View logs: make logs"
	@echo "Stop server: make server-stop"

server-stop:
	@if [ -f .oored.pid ]; then \
		kill $$(cat .oored.pid) 2>/dev/null || true; \
		rm -f .oored.pid; \
		echo "Server stopped"; \
	else \
		pkill -f "target/debug/oore-server" 2>/dev/null || true; \
		pkill -f "target/release/oore-server" 2>/dev/null || true; \
		echo "Server stopped"; \
	fi

logs:
	@if [ -f oored.log ]; then \
		tail -f oored.log; \
	else \
		echo "No log file found. Start server with: make server-bg"; \
	fi

cli:
	cargo run -p oore-cli -- $(ARGS)

web:
	cd web && bun dev

# =============================================================================
# Build & Test
# =============================================================================

build:
	cargo build

build-release:
	cargo build --release

test:
	cargo test

lint:
	cargo clippy -- -D warnings

clean:
	cargo clean
	rm -f oored.log .oored.pid
	rm -rf web/.next web/node_modules/.cache
	rm -rf docs/dist docs/node_modules/.cache
	rm -rf landing/dist landing/node_modules/.cache

# =============================================================================
# Service Management (Production)
# =============================================================================

install:
	sudo ./target/release/oored install

uninstall:
	sudo ./target/release/oored uninstall

start:
	sudo oored start

stop:
	sudo oored stop

status:
	oored status

# =============================================================================
# Landing Page
# =============================================================================

landing-dev:
	cd landing && bun dev

landing-build:
	cd landing && bun run build

landing-deploy: landing-build
	cd landing && bunx wrangler pages deploy dist --project-name=oore

# =============================================================================
# Documentation
# =============================================================================

docs-dev:
	cd docs && bun dev

docs-build:
	cd docs && bun run build

docs-deploy: docs-build
	cd docs && bunx wrangler pages deploy dist --project-name=oore-docs

# =============================================================================
# Frontend Dependencies
# =============================================================================

deps-web:
	cd web && bun install

deps-docs:
	cd docs && bun install

deps-landing:
	cd landing && bun install

deps-all: deps-web deps-docs deps-landing
