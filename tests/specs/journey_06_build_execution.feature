# Journey 6: Build Execution
# BDD-style test specification for build triggering and execution

Feature: Build Execution
  As a developer
  I want my builds to run automatically on code changes
  So that I get fast feedback on my Flutter apps

  Background:
    Given oored is running and healthy
    And a repository is configured with a valid pipeline
    And the repository has webhook integration enabled

  # =============================================================================
  # Webhook-Triggered Builds (GitHub Push)
  # =============================================================================

  @build @webhook @github
  Scenario: Build triggered by GitHub push to main
    Given the repository is connected to GitHub
    When I push a commit to the "main" branch
    Then GitHub should send a push webhook
    And the webhook should be received and stored
    And a new build should be created with status "pending"
    And the build should have trigger_type "push"
    And the build should start executing

  @build @webhook @github
  Scenario: Build triggered by GitHub pull request
    Given the repository is connected to GitHub
    When I open a pull request
    Then GitHub should send a pull_request webhook
    And a new build should be created
    And the build should have trigger_type "pull_request"
    And GitHub should show a pending status check

  @build @webhook @github
  Scenario: Build updates GitHub status on completion
    Given a build was triggered by a pull request
    When the build completes successfully
    Then GitHub should receive a status update
    And the PR should show a green check mark

  @build @webhook @github
  Scenario: Build updates GitHub status on failure
    Given a build was triggered by a pull request
    When the build fails
    Then GitHub should receive a status update
    And the PR should show a red X mark

  # =============================================================================
  # Webhook-Triggered Builds (GitLab)
  # =============================================================================

  @build @webhook @gitlab
  Scenario: Build triggered by GitLab push
    Given the repository is connected to GitLab
    When I push a commit to the default branch
    Then GitLab should send a push webhook
    And a new build should be created
    And the build should have trigger_type "push"

  @build @webhook @gitlab
  Scenario: Build triggered by GitLab merge request
    Given the repository is connected to GitLab
    When I open a merge request
    Then GitLab should send a merge_request webhook
    And a new build should be created
    And the build should have trigger_type "merge_request"

  # =============================================================================
  # Manual Build Triggers
  # =============================================================================

  @build @manual @cli
  Scenario: Trigger build manually via CLI
    Given I have a configured repository
    When I run "oore build trigger <repo_id>"
    Then a new build should be created
    And the build should have trigger_type "manual"
    And the build should use the default branch

  @build @manual @cli
  Scenario: Trigger build with specific branch
    When I run "oore build trigger <repo_id> --branch feature/new-thing"
    Then a new build should be created for the "feature/new-thing" branch
    And the build should have the latest commit from that branch

  @build @manual @cli
  Scenario: Trigger build with specific commit
    When I run "oore build trigger <repo_id> --commit abc123def"
    Then a new build should be created for commit "abc123def"
    And the build should use that specific commit SHA

  @build @manual @webui
  Scenario: Trigger build from web UI
    Given I am on the repository details page
    When I click "Trigger Build"
    And I select branch "main" in the modal
    And I click "Start Build"
    Then a new build should be created
    And I should be redirected to the build details page

  # =============================================================================
  # Build Execution Flow
  # =============================================================================

  @build @execution
  Scenario: Build clones repository
    Given a build is in "pending" status
    When the build worker picks up the job
    Then the repository should be cloned to a workspace
    And the workspace should be at "/var/lib/oore/workspaces/<build_id>/"
    And the build status should change to "running"

  @build @execution
  Scenario: Build resolves pipeline config from database
    Given the repository has a stored pipeline config
    When the build starts
    Then the build should use the stored config
    And the build should have config_source "database"

  @build @execution
  Scenario: Build resolves pipeline config from repository
    Given the repository does NOT have a stored pipeline config
    And the repository contains an "oore.yaml" file
    When the build starts
    Then the build should use the repository config
    And the build should have config_source "repository"

  @build @execution
  Scenario: Build executes steps sequentially
    Given the pipeline has 3 steps
    When the build runs
    Then step 1 should start and complete
    And then step 2 should start and complete
    And then step 3 should start and complete
    And each step should have timing information

  @build @execution
  Scenario: Build injects environment variables
    When a build step runs
    Then the step should have access to CI=true
    And the step should have access to OORE=true
    And the step should have access to OORE_BUILD_ID
    And the step should have access to OORE_COMMIT_SHA
    And the step should have access to OORE_BRANCH

  @build @execution
  Scenario: Build collects logs
    When a build step runs
    Then stdout should be captured to a log file
    And stderr should be captured separately
    And logs should be stored at "/var/lib/oore/logs/<build_id>/"

  # =============================================================================
  # Build State Transitions
  # =============================================================================

  @build @states
  Scenario: Build transitions pending -> running -> success
    Given a build is created with status "pending"
    When the build worker starts the build
    Then the status should change to "running"
    And when all steps complete successfully
    Then the status should change to "success"

  @build @states
  Scenario: Build transitions pending -> running -> failure
    Given a build is created
    When a step exits with non-zero code
    Then the build status should change to "failure"
    And subsequent steps should be "skipped"
    And the build should have an error_message

  @build @states
  Scenario: Step with ignore_failure continues build
    Given the pipeline has a step with ignore_failure=true
    When that step fails
    Then the build should continue to the next step
    And the failed step should show status "failure"
    And the build can still complete as "success"

  # =============================================================================
  # Build Cancellation
  # =============================================================================

  @build @cancel @cli
  Scenario: Cancel pending build via CLI
    Given a build is in "pending" status
    When I run "oore build cancel <build_id>"
    Then the build status should change to "cancelled"
    And the build should not start executing

  @build @cancel @cli
  Scenario: Cancel running build via CLI
    Given a build is in "running" status
    When I run "oore build cancel <build_id>"
    Then the running process should receive SIGTERM
    And after a grace period, SIGKILL if needed
    And the build status should change to "cancelled"

  @build @cancel @webui
  Scenario: Cancel build from web UI
    Given I am viewing a running build
    When I click "Cancel Build"
    And I confirm the cancellation
    Then the build should be cancelled
    And the UI should update to show "cancelled" status

  # =============================================================================
  # Build Monitoring
  # =============================================================================

  @build @monitoring @cli
  Scenario: List builds via CLI
    Given there are multiple builds
    When I run "oore build list"
    Then I should see a table of builds
    And each row should show ID, repo, status, branch, and time

  @build @monitoring @cli
  Scenario: Show build details via CLI
    Given a build exists
    When I run "oore build show <build_id>"
    Then I should see build details
    And I should see the list of steps with statuses
    And I should see timing information

  @build @monitoring @cli
  Scenario: View build logs via CLI
    Given a build has completed
    When I run "oore build logs <build_id>"
    Then I should see the logs for all steps

  @build @monitoring @cli
  Scenario: View specific step logs via CLI
    Given a build has multiple steps
    When I run "oore build logs <build_id> --step 2"
    Then I should see only the logs for step 2

  @build @monitoring @webui
  Scenario: View build in web UI
    Given I navigate to "/builds/<build_id>"
    Then I should see the build header with status
    And I should see a list of steps
    And I should be able to expand steps to see logs

  @build @monitoring @webui
  Scenario: Real-time log updates in web UI
    Given I am viewing a running build
    Then the step statuses should update in real-time
    And logs should auto-scroll as new lines arrive

  # =============================================================================
  # Build Timeouts
  # =============================================================================

  @build @timeout
  Scenario: Build exceeds maximum duration
    Given the build has been running for longer than OORE_MAX_BUILD_DURATION_SECS
    Then the build should be terminated
    And the status should be "failure"
    And the error message should mention "timeout"

  @build @timeout
  Scenario: Step exceeds maximum duration
    Given a step has been running for longer than its timeout
    Then the step should be terminated
    And the step status should be "failure"
    And the build should fail unless ignore_failure is set

  # =============================================================================
  # Concurrent Builds
  # =============================================================================

  @build @concurrency
  Scenario: Multiple builds run concurrently
    Given OORE_MAX_CONCURRENT_BUILDS is set to 2
    When 3 builds are triggered simultaneously
    Then 2 builds should start running
    And 1 build should remain in "pending" status
    And when a running build completes, the pending build should start

  @build @concurrency
  Scenario: Same repository concurrent builds
    Given a repository has a running build
    When a new commit is pushed
    Then a new build should be queued
    And both builds can run if slots are available

  # =============================================================================
  # Error Scenarios
  # =============================================================================

  @build @error
  Scenario: Clone fails
    Given the repository URL is invalid or inaccessible
    When the build tries to clone
    Then the build should fail with status "failure"
    And the error message should mention "clone" or "repository"

  @build @error
  Scenario: Pipeline config not found
    Given the repository has no pipeline config anywhere
    When a build is triggered
    Then the build should fail or use a default config
    And the error should be logged

  @build @error
  Scenario: Invalid pipeline config
    Given the repository has an invalid oore.yaml
    When a build is triggered
    Then the build should fail
    And the error should mention parsing failure
