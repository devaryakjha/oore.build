# Journey 2: GitHub Integration
# BDD-style test specification for GitHub App setup and management

Feature: GitHub Integration
  As an Oore user
  I want to connect my GitHub account
  So that webhooks can trigger builds automatically

  Background:
    Given oored is running and healthy
    And CLI is configured with admin token
    And encryption key is configured

  # =============================================================================
  # GitHub App Setup (CLI)
  # =============================================================================

  @github @setup @cli
  Scenario: Start GitHub App setup
    Given no GitHub App is configured
    When I run "oore github setup"
    Then the CLI should generate a manifest URL
    And the browser should open to GitHub
    And the CLI should start polling for completion

  @github @setup @cli
  Scenario: Complete GitHub App setup
    Given I have started "oore github setup"
    And I am on the GitHub App creation page
    When I click "Create GitHub App"
    And GitHub redirects to the callback URL
    Then the CLI polling should succeed
    And I should see "GitHub App created successfully"
    And "oore github status" should show the app as configured

  @github @setup @cli
  Scenario: GitHub setup in headless environment
    Given I am in a headless/SSH environment
    When I run "oore github setup"
    And the browser cannot open
    Then the CLI should display the URL to copy
    And I should be able to complete setup manually

  @github @setup @cli @error
  Scenario: GitHub setup timeout
    Given I have started "oore github setup"
    When I do not complete the GitHub flow within 10 minutes
    Then the CLI should timeout
    And the error message should suggest retrying

  @github @setup @cli @error
  Scenario: GitHub App already configured
    Given a GitHub App is already configured
    When I run "oore github setup"
    Then the command should warn about existing configuration
    And prompt for confirmation to reconfigure

  # =============================================================================
  # GitHub App Setup (Web UI)
  # =============================================================================

  @github @setup @webui
  Scenario: Start GitHub setup from web UI
    Given I am on the Settings > GitHub page
    And no GitHub App is configured
    When I click "Connect GitHub"
    Then a new tab should open to GitHub
    And the page should show "Waiting for completion..."

  @github @setup @webui
  Scenario: Complete GitHub setup from web UI
    Given I have started GitHub setup from web UI
    When I complete the GitHub App creation
    And GitHub redirects to the callback
    Then I should be redirected to the success page
    And the Settings > GitHub page should show the app details

  # =============================================================================
  # GitHub App Status
  # =============================================================================

  @github @status @cli
  Scenario: View GitHub App status (configured)
    Given a GitHub App is configured
    When I run "oore github status"
    Then I should see the app name
    And I should see the app ID
    And I should see the number of installations

  @github @status @cli
  Scenario: View GitHub App status (not configured)
    Given no GitHub App is configured
    When I run "oore github status"
    Then I should see "GitHub App not configured"
    And the output should suggest running setup

  @github @status @webui
  Scenario: View GitHub status in web UI (configured)
    Given a GitHub App is configured
    When I navigate to Settings > GitHub
    Then I should see the app name and URL
    And I should see a list of installations
    And I should see a "Disconnect" button

  # =============================================================================
  # GitHub Installations
  # =============================================================================

  @github @installations @cli
  Scenario: List GitHub installations
    Given a GitHub App is configured
    And the app is installed on 2 organizations
    When I run "oore github installations"
    Then I should see both organizations listed
    And each should show account name and type

  @github @installations @cli
  Scenario: Sync installations from GitHub
    Given a GitHub App is configured
    And new repositories have been added on GitHub
    When I run "oore github sync"
    Then the installations should be refreshed
    And new repositories should appear in "oore repo list"

  # =============================================================================
  # GitHub Installation Events
  # =============================================================================

  @github @webhooks
  Scenario: App installed on single repository
    Given a GitHub App is configured
    When a user installs the app on a single repository
    Then an installation webhook should be received
    And the repository should be added to Oore
    And "oore repo list" should show the new repository

  @github @webhooks
  Scenario: App installed on all repositories
    Given a GitHub App is configured
    When a user installs the app with "All repositories" access
    Then an installation webhook should be received
    And all accessible repositories should be synced
    And "oore repo list" should show all repositories

  @github @webhooks
  Scenario: Repository added to existing installation
    Given a GitHub App is installed with selected repositories
    When a user adds a new repository to the installation
    Then an installation_repositories webhook should be received
    And the new repository should be added to Oore

  @github @webhooks
  Scenario: Repository removed from installation
    Given a GitHub App is installed with repositories
    When a user removes a repository from the installation
    Then an installation_repositories webhook should be received
    And the repository should be marked as inactive

  @github @webhooks
  Scenario: App uninstalled
    Given a GitHub App is installed on an organization
    When the user uninstalls the app
    Then an installation webhook (deleted) should be received
    And the installation should be marked as inactive
    And associated repositories should be marked as inactive

  # =============================================================================
  # GitHub App Removal
  # =============================================================================

  @github @removal @cli
  Scenario: Remove GitHub App credentials
    Given a GitHub App is configured
    When I run "oore github remove --force"
    Then the GitHub App credentials should be deleted
    And "oore github status" should show "not configured"

  @github @removal @cli @error
  Scenario: Remove GitHub App without force flag
    Given a GitHub App is configured
    When I run "oore github remove"
    Then the command should fail
    And the error should require the --force flag

  # =============================================================================
  # Error Scenarios
  # =============================================================================

  @github @error
  Scenario: GitHub API unavailable during setup
    Given I start "oore github setup"
    When GitHub API returns 503
    Then the CLI should show a connection error
    And suggest retrying later

  @github @error
  Scenario: Invalid encryption key
    Given ENCRYPTION_KEY has changed since setup
    When the server tries to decrypt GitHub credentials
    Then the server should fail with a decryption error
    And admin should be alerted to reconfigure
