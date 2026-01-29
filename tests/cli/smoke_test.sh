#!/bin/bash
# CLI Smoke Tests for Oore
#
# This script tests basic CLI functionality.
# Requires: oore CLI built, oored server running on localhost:8080
#
# Usage:
#   ./tests/cli/smoke_test.sh [--server URL] [--token TOKEN]
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
OORE_BIN="${OORE_BIN:-./target/debug/oore}"
SERVER_URL="${SERVER_URL:-http://localhost:8080}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
TESTS_PASSED=0
TESTS_FAILED=0

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --server)
            SERVER_URL="$2"
            shift 2
            ;;
        --token)
            ADMIN_TOKEN="$2"
            shift 2
            ;;
        --bin)
            OORE_BIN="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Helper functions
log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

run_oore() {
    if [ -n "$ADMIN_TOKEN" ]; then
        "$OORE_BIN" --server "$SERVER_URL" --admin-token "$ADMIN_TOKEN" "$@"
    else
        "$OORE_BIN" --server "$SERVER_URL" "$@"
    fi
}

# Test: CLI binary exists and runs
test_cli_exists() {
    if [ ! -f "$OORE_BIN" ]; then
        log_fail "CLI binary not found at $OORE_BIN"
        return 1
    fi

    if "$OORE_BIN" --version > /dev/null 2>&1; then
        log_pass "CLI binary executes"
    else
        log_fail "CLI binary failed to execute"
        return 1
    fi
}

# Test: --version flag
test_version() {
    local output
    output=$("$OORE_BIN" --version 2>&1)

    if echo "$output" | grep -q "oore"; then
        log_pass "--version shows version info"
    else
        log_fail "--version did not show expected output"
        echo "  Output: $output"
    fi
}

# Test: --help flag
test_help() {
    local output
    output=$("$OORE_BIN" --help 2>&1)

    if echo "$output" | grep -q -E "(Commands|USAGE|Usage)"; then
        log_pass "--help shows usage information"
    else
        log_fail "--help did not show expected output"
    fi
}

# Test: health command
test_health() {
    local output
    if output=$(run_oore health 2>&1); then
        if echo "$output" | grep -qi "ok\|healthy"; then
            log_pass "health command succeeds"
        else
            log_fail "health command unexpected output: $output"
        fi
    else
        log_fail "health command failed (is server running?)"
        echo "  Output: $output"
    fi
}

# Test: version command (server)
test_server_version() {
    local output
    if output=$(run_oore version 2>&1); then
        if echo "$output" | grep -qi "oored"; then
            log_pass "version command shows server info"
        else
            log_fail "version command unexpected output: $output"
        fi
    else
        log_fail "version command failed"
        echo "  Output: $output"
    fi
}

# Test: repo list (empty)
test_repo_list() {
    local output
    if output=$(run_oore repo list 2>&1); then
        log_pass "repo list command succeeds"
    else
        log_fail "repo list command failed"
        echo "  Output: $output"
    fi
}

# Test: build list (empty)
test_build_list() {
    local output
    if output=$(run_oore build list 2>&1); then
        log_pass "build list command succeeds"
    else
        log_fail "build list command failed"
        echo "  Output: $output"
    fi
}

# Test: webhook list (empty)
test_webhook_list() {
    local output
    if output=$(run_oore webhook list 2>&1); then
        log_pass "webhook list command succeeds"
    else
        log_fail "webhook list command failed"
        echo "  Output: $output"
    fi
}

# Test: config path
test_config_path() {
    local output
    if output=$("$OORE_BIN" config path 2>&1); then
        if echo "$output" | grep -q "config"; then
            log_pass "config path command shows path"
        else
            log_fail "config path unexpected output: $output"
        fi
    else
        log_fail "config path command failed"
        echo "  Output: $output"
    fi
}

# Test: setup command (requires admin token)
test_setup() {
    if [ -z "$ADMIN_TOKEN" ]; then
        log_info "Skipping setup test (no admin token)"
        return 0
    fi

    local output
    if output=$(run_oore setup 2>&1); then
        log_pass "setup command succeeds"
    else
        log_fail "setup command failed"
        echo "  Output: $output"
    fi
}

# Test: github status (requires admin token)
test_github_status() {
    if [ -z "$ADMIN_TOKEN" ]; then
        log_info "Skipping github status test (no admin token)"
        return 0
    fi

    local output
    if output=$(run_oore github status 2>&1); then
        log_pass "github status command succeeds"
    else
        # May fail if not configured, which is OK
        if echo "$output" | grep -qi "not configured\|not set"; then
            log_pass "github status shows not configured (expected)"
        else
            log_fail "github status command failed"
            echo "  Output: $output"
        fi
    fi
}

# Test: gitlab status (requires admin token)
test_gitlab_status() {
    if [ -z "$ADMIN_TOKEN" ]; then
        log_info "Skipping gitlab status test (no admin token)"
        return 0
    fi

    local output
    if output=$(run_oore gitlab status 2>&1); then
        log_pass "gitlab status command succeeds"
    else
        # May fail if not configured, which is OK
        if echo "$output" | grep -qi "not configured\|no credentials"; then
            log_pass "gitlab status shows not configured (expected)"
        else
            log_fail "gitlab status command failed"
            echo "  Output: $output"
        fi
    fi
}

# Test: pipeline validate (valid YAML)
test_pipeline_validate_valid() {
    local tmpfile
    tmpfile=$(mktemp)
    cat > "$tmpfile" << 'EOF'
workflows:
  build:
    name: Build
    scripts:
      - name: Test
        script: echo "Hello"
EOF

    local output
    if output=$(run_oore pipeline validate "$tmpfile" 2>&1); then
        if echo "$output" | grep -qi "valid"; then
            log_pass "pipeline validate (valid YAML) succeeds"
        else
            log_fail "pipeline validate unexpected output"
            echo "  Output: $output"
        fi
    else
        log_fail "pipeline validate command failed"
        echo "  Output: $output"
    fi

    rm -f "$tmpfile"
}

# Test: pipeline validate (invalid YAML)
test_pipeline_validate_invalid() {
    local tmpfile
    tmpfile=$(mktemp)
    echo "not: [valid yaml" > "$tmpfile"

    local output
    # This should fail/show error
    if output=$(run_oore pipeline validate "$tmpfile" 2>&1); then
        if echo "$output" | grep -qi "error\|invalid"; then
            log_pass "pipeline validate (invalid YAML) shows error"
        else
            log_fail "pipeline validate should show error for invalid YAML"
            echo "  Output: $output"
        fi
    else
        # Command failing is expected
        log_pass "pipeline validate (invalid YAML) fails as expected"
    fi

    rm -f "$tmpfile"
}

# Test: connection error handling
test_connection_error() {
    local output
    if output=$("$OORE_BIN" --server "http://localhost:99999" health 2>&1); then
        log_fail "Should fail with invalid server"
    else
        if echo "$output" | grep -qi "connect\|error\|failed"; then
            log_pass "Connection error handled gracefully"
        else
            log_fail "Connection error message unclear"
            echo "  Output: $output"
        fi
    fi
}

# Test: invalid subcommand
test_invalid_subcommand() {
    local output
    if output=$("$OORE_BIN" nonexistent 2>&1); then
        log_fail "Should fail with invalid subcommand"
    else
        log_pass "Invalid subcommand handled"
    fi
}

# Main test runner
main() {
    echo "========================================"
    echo "  Oore CLI Smoke Tests"
    echo "========================================"
    echo "Server: $SERVER_URL"
    echo "Binary: $OORE_BIN"
    echo "Token:  ${ADMIN_TOKEN:+[set]}"
    echo "========================================"
    echo ""

    # Basic CLI tests (no server required)
    log_info "Running basic CLI tests..."
    test_cli_exists || true
    test_version || true
    test_help || true
    test_config_path || true
    test_invalid_subcommand || true

    echo ""
    log_info "Running server connectivity tests..."
    test_health || true
    test_server_version || true
    test_connection_error || true

    echo ""
    log_info "Running API tests..."
    test_repo_list || true
    test_build_list || true
    test_webhook_list || true

    echo ""
    log_info "Running admin tests..."
    test_setup || true
    test_github_status || true
    test_gitlab_status || true

    echo ""
    log_info "Running pipeline tests..."
    test_pipeline_validate_valid || true
    test_pipeline_validate_invalid || true

    echo ""
    echo "========================================"
    echo "  Test Results"
    echo "========================================"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    echo "========================================"

    if [ $TESTS_FAILED -gt 0 ]; then
        exit 1
    fi
    exit 0
}

main
