#!/usr/bin/env bash
#
# install.local.sh - Oore Local Development Setup Script
#
# This script sets up the Oore project for local development by:
# - Checking and optionally installing required dependencies
# - Configuring environment variables
# - Installing frontend dependencies
# - Building the Rust backend
#
# Usage:
#   ./install.local.sh          # Interactive mode
#   ./install.local.sh --yes    # Non-interactive mode (use defaults)
#   ./install.local.sh --help   # Show help
#

set -euo pipefail

# ============================================================================
# Constants & Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.local"

# Default values
DEFAULT_DATABASE_URL="sqlite:oore.db"
DEFAULT_OORE_BASE_URL="http://localhost:8080"
DEFAULT_OORE_DASHBOARD_ORIGIN="http://localhost:3000"
DEFAULT_RUST_LOG="debug"

# Local data directories (relative to project root)
LOCAL_DATA_DIR=".oore"

# Color codes (disabled if not a terminal)
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    BOLD='\033[1m'
    NC='\033[0m' # No Color
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    BOLD=''
    NC=''
fi

# Flags
YES_MODE=false

# Script-scoped variables (set during setup)
DEMO_MODE=false

# ============================================================================
# Utility Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_step() {
    echo -e "\n${BOLD}==> $1${NC}"
}

# Prompt for yes/no confirmation
# Returns 0 for yes, 1 for no
prompt_yes_no() {
    local prompt="$1"
    local default="${2:-y}"

    if [[ "$YES_MODE" == true ]]; then
        return 0
    fi

    local yn_prompt
    if [[ "$default" == "y" ]]; then
        yn_prompt="[Y/n]"
    else
        yn_prompt="[y/N]"
    fi

    while true; do
        read -r -p "$prompt $yn_prompt " response
        response="${response:-$default}"
        case "$response" in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

# Prompt for a value with default
prompt_value() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"

    if [[ "$YES_MODE" == true ]]; then
        eval "$var_name=\"$default\""
        return
    fi

    read -r -p "$prompt [$default]: " response
    response="${response:-$default}"
    eval "$var_name=\"$response\""
}

# Check if a command exists
check_command() {
    command -v "$1" &> /dev/null
}

show_help() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Oore Local Development Setup Script

This script sets up the Oore project for local development by checking
dependencies, configuring environment variables, and building the project.

OPTIONS:
    -y, --yes       Non-interactive mode, use all defaults
    -h, --help      Show this help message

EXAMPLES:
    ./install.local.sh          # Interactive setup
    ./install.local.sh --yes    # Use all defaults, no prompts

For more information, see: https://oore.build/docs
EOF
}

# ============================================================================
# OS Detection
# ============================================================================

detect_os() {
    case "$(uname -s)" in
        Darwin)
            OS="macos"
            ;;
        Linux)
            OS="linux"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            log_error "Windows is not supported. Please use WSL2 or a Unix-like environment."
            exit 1
            ;;
        *)
            log_error "Unsupported operating system: $(uname -s)"
            exit 1
            ;;
    esac
    log_success "Detected OS: $OS"
}

# ============================================================================
# Dependency Checks
# ============================================================================

check_git() {
    if check_command git; then
        local version
        version=$(git --version | awk '{print $3}')
        log_success "Git installed: $version"
        return 0
    else
        log_error "Git is not installed. Please install Git first."
        log_info "  macOS: xcode-select --install"
        log_info "  Linux: sudo apt install git (or equivalent)"
        return 1
    fi
}

check_rust() {
    if check_command rustc && check_command cargo; then
        local version
        version=$(rustc --version | awk '{print $2}')
        log_success "Rust installed: $version"
        return 0
    else
        return 1
    fi
}

install_rust() {
    log_info "Rust is not installed."
    if prompt_yes_no "Would you like to install Rust via rustup?"; then
        log_info "Installing Rust..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        # Source the cargo env for current session
        # shellcheck source=/dev/null
        source "$HOME/.cargo/env" 2>/dev/null || true
        if check_command rustc; then
            log_success "Rust installed successfully!"
            return 0
        else
            log_error "Rust installation failed. Please install manually: https://rustup.rs"
            return 1
        fi
    else
        log_warn "Skipping Rust installation. You'll need Rust to build the backend."
        return 1
    fi
}

check_bun() {
    if check_command bun; then
        local version
        version=$(bun --version)
        log_success "Bun installed: $version"
        return 0
    else
        return 1
    fi
}

install_bun() {
    log_info "Bun is not installed."
    if prompt_yes_no "Would you like to install Bun?"; then
        log_info "Installing Bun..."
        curl -fsSL https://bun.sh/install | bash
        # Source bun for current session
        export BUN_INSTALL="$HOME/.bun"
        export PATH="$BUN_INSTALL/bin:$PATH"
        if check_command bun; then
            log_success "Bun installed successfully!"
            return 0
        else
            log_error "Bun installation failed. Please install manually: https://bun.sh"
            return 1
        fi
    else
        log_warn "Skipping Bun installation. You'll need Bun for the frontend."
        return 1
    fi
}

check_openssl() {
    if check_command openssl; then
        local version
        version=$(openssl version | awk '{print $2}')
        log_success "OpenSSL installed: $version"
        return 0
    else
        log_error "OpenSSL is not installed."
        log_info "  macOS: Usually pre-installed. Try: brew install openssl"
        log_info "  Linux: sudo apt install openssl (or equivalent)"
        return 1
    fi
}

check_all_dependencies() {
    log_step "Checking dependencies..."

    local has_errors=false

    # Git (required, usually pre-installed)
    if ! check_git; then
        has_errors=true
    fi

    # Rust
    if ! check_rust; then
        if ! install_rust; then
            has_errors=true
        fi
    fi

    # Bun
    if ! check_bun; then
        if ! install_bun; then
            has_errors=true
        fi
    fi

    # OpenSSL (required for key generation)
    if ! check_openssl; then
        has_errors=true
    fi

    # SQLite info (linked statically by Rust)
    log_info "SQLite: Linked statically by Rust (no system install needed)"

    if [[ "$has_errors" == true ]]; then
        log_warn "Some dependencies are missing. The setup will continue, but some features may not work."
    fi
}

# ============================================================================
# Environment Configuration
# ============================================================================

generate_key() {
    openssl rand -hex 32
}

create_env_file() {
    log_step "Configuring environment..."

    # Check if .env.local already exists
    if [[ -f "$ENV_FILE" ]]; then
        log_warn "Found existing .env.local file."
        if ! prompt_yes_no "Do you want to overwrite it?" "n"; then
            log_info "Keeping existing .env.local"
            return 0
        fi
        log_info "Backing up existing file to .env.local.bak"
        cp "$ENV_FILE" "$ENV_FILE.bak"
    fi

    # Collect configuration values
    local database_url oore_base_url oore_dashboard_origin rust_log

    prompt_value "Database URL" "$DEFAULT_DATABASE_URL" database_url
    prompt_value "Oore Base URL" "$DEFAULT_OORE_BASE_URL" oore_base_url
    prompt_value "Dashboard Origin" "$DEFAULT_OORE_DASHBOARD_ORIGIN" oore_dashboard_origin
    prompt_value "Rust log level" "$DEFAULT_RUST_LOG" rust_log

    # Demo mode prompt
    if prompt_yes_no "Enable demo mode? (Explore UI with fake data, no OAuth needed)" "n"; then
        DEMO_MODE=true
    fi

    # Generate secrets
    log_info "Generating encryption key..."
    local encryption_key
    encryption_key=$(generate_key)

    log_info "Generating admin token..."
    local admin_token
    admin_token=$(generate_key)

    log_info "Generating GitLab server pepper..."
    local gitlab_pepper
    gitlab_pepper=$(generate_key)

    # Create local data directories
    log_info "Creating local data directories..."
    local data_dir="$SCRIPT_DIR/$LOCAL_DATA_DIR"
    mkdir -p "$data_dir/workspaces"
    mkdir -p "$data_dir/logs"
    mkdir -p "$data_dir/artifacts"
    log_success "Created $LOCAL_DATA_DIR/{workspaces,logs,artifacts}"

    # Write the file
    log_info "Writing .env.local..."
    cat > "$ENV_FILE" << EOF
# Oore Local Development Configuration
# Generated by install.local.sh on $(date '+%Y-%m-%d %H:%M:%S')
#
# IMPORTANT: This file contains secrets. Do not commit to version control.

# Database
DATABASE_URL=$database_url

# Server URLs
OORE_BASE_URL=$oore_base_url
OORE_DASHBOARD_ORIGIN=$oore_dashboard_origin

# Development mode (enables additional logging and relaxed security)
OORE_DEV_MODE=true

# Local data directories (relative paths work from project root)
OORE_WORKSPACES_DIR=$data_dir/workspaces
OORE_LOGS_DIR=$data_dir/logs
OORE_ARTIFACTS_DIR=$data_dir/artifacts

# Encryption key for sensitive data (AES-256-GCM)
# Generated with: openssl rand -hex 32
ENCRYPTION_KEY=$encryption_key

# Admin API token for CLI authentication
# Generated with: openssl rand -hex 32
OORE_ADMIN_TOKEN=$admin_token

# Rust logging level
RUST_LOG=$rust_log

# GitLab Integration (optional)
# Server pepper for HMAC computation of webhook tokens
# Generated with: openssl rand -hex 32
GITLAB_SERVER_PEPPER=$gitlab_pepper

# Demo mode - pre-populated fake data for exploring the UI
# No GitHub/GitLab OAuth setup required in demo mode
OORE_DEMO_MODE=$DEMO_MODE
EOF

    # Set restrictive permissions
    chmod 600 "$ENV_FILE"
    log_success "Created .env.local with secure permissions (600)"

    # Create web/.env.local if it doesn't exist
    local web_env="$SCRIPT_DIR/web/.env.local"
    if [[ ! -f "$web_env" ]]; then
        log_info "Creating web/.env.local..."
        cat > "$web_env" << EOF
# Auto-generated by install.local.sh
NEXT_PUBLIC_API_BASE_URL=$oore_base_url
EOF
        log_success "Created web/.env.local"
    fi
}

# ============================================================================
# Project Setup
# ============================================================================

install_bun_deps() {
    log_step "Installing frontend dependencies..."

    local dirs=("web" "site")

    for dir in "${dirs[@]}"; do
        local full_path="$SCRIPT_DIR/$dir"
        if [[ -d "$full_path" ]] && [[ -f "$full_path/package.json" ]]; then
            log_info "Installing dependencies for $dir/..."
            (cd "$full_path" && bun install)
            log_success "Installed $dir/ dependencies"
        else
            log_warn "Skipping $dir/ (no package.json found)"
        fi
    done
}

build_rust() {
    log_step "Building Rust backend..."

    if ! check_command cargo; then
        log_warn "Cargo not found. Skipping Rust build."
        return 0
    fi

    log_info "Running cargo build (this may take a while on first run)..."

    # Build with graceful failure handling
    if (cd "$SCRIPT_DIR" && cargo build 2>&1); then
        log_success "Rust build completed successfully!"
    else
        log_warn "Rust build failed. This is not critical for initial setup."
        log_info "You can try building again later with: cargo build"
        log_info "Common issues:"
        log_info "  - Missing system libraries (check error messages above)"
        log_info "  - Outdated Rust toolchain: rustup update"
    fi
}

# ============================================================================
# Verification & Completion Summary
# ============================================================================

verify_setup() {
    log_step "Verifying setup..."

    local warnings=0

    if [[ -f "$ENV_FILE" ]]; then
        log_success ".env.local created"
    else
        log_error ".env.local missing"
        ((warnings++))
    fi

    if [[ -f "$SCRIPT_DIR/target/debug/oore-server" ]]; then
        log_success "Rust backend built"
    else
        log_warn "Rust build incomplete (run: cargo build)"
        ((warnings++))
    fi

    if [[ -d "$SCRIPT_DIR/web/node_modules" ]]; then
        log_success "Web dependencies installed"
    else
        log_warn "Web dependencies missing (run: cd web && bun install)"
        ((warnings++))
    fi

    echo ""
    if [[ $warnings -eq 0 ]]; then
        echo -e "${GREEN}* Setup completed successfully!${NC}"
    else
        echo -e "${YELLOW}! Setup completed with $warnings warning(s)${NC}"
    fi
}

print_summary() {
    log_step "Setup Complete!"

    echo ""
    echo "Configuration:"
    echo "  Environment file: $ENV_FILE"
    echo ""
}

print_next_steps() {
    echo -e "${BOLD}What's Next?${NC}"
    echo ""
    echo -e "  ${GREEN}>${NC} Start the server and dashboard:"
    echo -e "     ${BLUE}make dev${NC}"
    echo ""
    echo -e "  ${GREEN}>${NC} Open the dashboard:"
    echo -e "     ${BLUE}http://localhost:3000${NC}"
    echo ""
    if [[ "$DEMO_MODE" == true ]]; then
        echo -e "  ${GREEN}*${NC} Demo mode is enabled - you'll see sample data to explore"
    else
        echo -e "  ${YELLOW}o${NC} Configure integrations (optional):"
        echo -e "     GitHub: ${BLUE}https://oore.build/docs/integrations/github${NC}"
        echo -e "     GitLab: ${BLUE}https://oore.build/docs/integrations/gitlab${NC}"
        echo ""
        echo -e "  Tip: Re-run with demo mode to explore without OAuth setup"
    fi
    echo ""
    echo -e "Documentation: ${BLUE}https://oore.build/docs${NC}"
    echo ""
}

# ============================================================================
# Main
# ============================================================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -y|--yes)
                YES_MODE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    echo ""
    echo -e "${BOLD}Oore Local Development Setup${NC}"
    echo "=============================="
    echo ""

    # Change to script directory
    cd "$SCRIPT_DIR"

    # Run setup steps
    detect_os
    check_all_dependencies
    create_env_file

    # Only install bun deps if bun is available
    if check_command bun; then
        install_bun_deps
    else
        log_warn "Skipping frontend dependency installation (bun not available)"
    fi

    # Only build if cargo is available
    if check_command cargo; then
        build_rust
    else
        log_warn "Skipping Rust build (cargo not available)"
    fi

    verify_setup
    print_summary
    print_next_steps
}

main "$@"
