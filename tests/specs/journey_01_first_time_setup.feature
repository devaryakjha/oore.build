# Journey 1: First-Time Setup
# BDD-style test specification for initial Oore installation and configuration

Feature: First-Time Setup
  As a new Oore user
  I want to install and configure Oore on my Mac
  So that I can start running CI/CD builds

  Background:
    Given I have a Mac with the oored binary available
    And no existing Oore configuration exists

  # =============================================================================
  # Server Initialization
  # =============================================================================

  @server @init
  Scenario: Initialize server environment
    When I run "sudo oored init"
    Then an environment file should be created at "/etc/oore/oore.env"
    And the file should contain "ENCRYPTION_KEY="
    And the file should contain "OORE_ADMIN_TOKEN="
    And the file should contain "DATABASE_URL="
    And the encryption key should be 64 hex characters

  @server @init
  Scenario: Initialize with custom base URL
    When I run "sudo oored init --base-url https://ci.example.com"
    Then the environment file should contain "OORE_BASE_URL=https://ci.example.com"

  @server @init @error
  Scenario: Initialize fails without sudo
    When I run "oored init" without sudo
    Then the command should fail with exit code 1
    And the error message should mention "permission" or "root"

  @server @init
  Scenario: Re-initialize with force flag
    Given an environment file already exists
    When I run "sudo oored init --force"
    Then the environment file should be recreated
    And a new encryption key should be generated

  @server @init @error
  Scenario: Re-initialize without force flag
    Given an environment file already exists
    When I run "sudo oored init"
    Then the command should fail
    And the error message should suggest using "--force"

  # =============================================================================
  # Service Installation
  # =============================================================================

  @server @service
  Scenario: Install as system service on macOS
    Given oored init has been run
    When I run "sudo oored install"
    Then a LaunchDaemon plist should be created at "/Library/LaunchDaemons/build.oore.oored.plist"
    And the plist should reference the correct binary path
    And the plist should set OORE_ENV_FILE

  @server @service
  Scenario: Install as system service on Linux
    Given oored init has been run
    And I am on a Linux system
    When I run "sudo oored install"
    Then a systemd unit file should be created at "/etc/systemd/system/oored.service"
    And the unit file should be enabled

  @server @service @error
  Scenario: Install fails without init
    Given oored init has NOT been run
    When I run "sudo oored install"
    Then the command should fail
    And the error message should mention running init first

  # =============================================================================
  # Service Management
  # =============================================================================

  @server @service
  Scenario: Start the server service
    Given oored is installed as a service
    When I run "sudo oored start"
    Then the service should be running
    And "oored status" should show "running"
    And the server should be accessible at localhost:8080

  @server @service
  Scenario: Stop the server service
    Given oored is running as a service
    When I run "sudo oored stop"
    Then the service should stop
    And "oored status" should show "stopped"

  @server @service
  Scenario: View server logs
    Given oored is running as a service
    When I run "oored logs"
    Then I should see recent log entries
    And the logs should include startup messages

  @server @service
  Scenario: Follow server logs
    Given oored is running as a service
    When I run "oored logs -f"
    Then logs should stream in real-time
    And I should see new entries as they occur

  # =============================================================================
  # CLI Configuration
  # =============================================================================

  @cli @config
  Scenario: Initialize CLI configuration
    Given the server is running
    And I have the admin token from the environment file
    When I run "oore config init --server http://localhost:8080 --token <admin_token>"
    Then a config file should be created at "~/.oore/config.huml"
    And the file should have secure permissions (0600)
    And "oore health" should succeed

  @cli @config
  Scenario: Create additional profile
    Given I have an existing CLI configuration
    When I run "oore config set --profile production --server https://prod.example.com --token <token>"
    Then the config file should contain a "production" profile
    And "oore --profile production health" should use that profile

  @cli @config
  Scenario: Show configuration
    Given I have a CLI configuration
    When I run "oore config show"
    Then I should see the server URL
    And the token should be masked (showing only first/last chars)

  @cli @config
  Scenario: Show configuration with token
    Given I have a CLI configuration
    When I run "oore config show --show-token"
    Then I should see the full token value

  # =============================================================================
  # Health Verification
  # =============================================================================

  @cli @health
  Scenario: Verify server health
    Given the server is running
    And CLI is configured
    When I run "oore health"
    Then the output should indicate "ok" or "healthy"
    And the command should exit with code 0

  @cli @health
  Scenario: Check setup status
    Given the server is running
    And CLI is configured with admin token
    When I run "oore setup"
    Then I should see GitHub integration status
    And I should see GitLab integration status
    And I should see encryption key status
    And I should see admin token status

  # =============================================================================
  # Error Scenarios
  # =============================================================================

  @cli @error
  Scenario: Health check with unreachable server
    Given the server is NOT running
    When I run "oore health"
    Then the command should fail
    And the error message should mention connection failure

  @cli @error
  Scenario: Config init with invalid server URL
    When I run "oore config init --server not-a-valid-url"
    Then the command should fail
    And the error message should mention invalid URL

  @cli @error
  Scenario: Admin command without token
    Given CLI is configured without admin token
    When I run "oore setup"
    Then the command should fail with 401 status
    And the error message should mention authentication

  @cli @error
  Scenario: Admin command with invalid token
    Given CLI is configured with an invalid admin token
    When I run "oore setup"
    Then the command should fail with 401 status
    And the error message should mention invalid token
