# Testing Guide

This document describes the testing strategy, structure, and guidelines for the Oore project.

## Testing Philosophy

Every feature in Oore should be tested at multiple levels:

1. **User Journeys** - Document the user experience first
2. **API Integration Tests** - Verify endpoints work correctly
3. **BDD Specifications** - Define behavior in human-readable format
4. **Manual QA Checklist** - Catch edge cases before release

## Directory Structure

```
oore.build/
├── documentation/
│   ├── TESTING.md           # This file
│   ├── user-journeys.md     # All user scenarios and paths
│   └── qa-checklist.md      # Manual testing checklist
│
├── tests/
│   └── specs/
│       └── *.feature        # BDD specifications (Gherkin)
│
└── crates/oore-server/
    ├── src/
    │   ├── lib.rs           # Exposes test utilities
    │   └── test_utils.rs    # Test helpers
    └── tests/
        └── api_tests.rs     # API integration tests
```

## Running Tests

### All Rust Tests
```bash
cargo test
```

### API Integration Tests Only
```bash
cargo test -p oore-server --test api_tests
```

### Unit Tests for Specific Crate
```bash
cargo test -p oore-core
cargo test -p oore-server
```

## Writing Tests for New Features

### Step 1: Document the User Journey

Before writing any code, add the user journey to `documentation/user-journeys.md`:

```markdown
## Journey N: Feature Name

### N.1 Web UI: Feature Flow

**Happy Path**
```
User navigates to feature page
→ Expected result 1
→ Expected result 2
```

**Alternate Scenarios**

| Scenario | Expected Behavior |
|----------|-------------------|
| Edge case 1 | What should happen |
| Error case | Error message |
```

### Step 2: Add BDD Specification

Create or update a `.feature` file in `tests/specs/`:

```gherkin
# tests/specs/journey_XX_feature_name.feature

Feature: Feature Name
  As a user
  I want to do something
  So that I get some benefit

  @feature @api
  Scenario: Happy path
    Given precondition
    When I make an API request
    Then expected result

  @feature @error
  Scenario: Error handling
    Given error condition
    When I make an API request
    Then appropriate error shown
```

### Step 3: Write API Integration Tests

Add tests to `crates/oore-server/tests/api_tests.rs`:

```rust
mod feature_name {
    use super::*;

    #[tokio::test]
    async fn feature_happy_path() {
        let server = create_server().await;

        let response = server.get("/api/feature").await;

        response.assert_status_ok();
        let body: Value = response.json();
        assert_eq!(body["expected"], "value");
    }

    #[tokio::test]
    async fn feature_error_case() {
        let server = create_server().await;

        let response = server.get("/api/feature/invalid").await;

        response.assert_status(axum::http::StatusCode::NOT_FOUND);
    }
}
```

### Step 4: Update QA Checklist

Add items to `documentation/qa-checklist.md`:

```markdown
## N. Feature Name

### N.1 Feature Aspect
- [ ] Test case 1
- [ ] Test case 2
- [ ] Error handling works

**Notes:**
```

## Test Utilities

### API Test Helpers

Located in `crates/oore-server/src/test_utils.rs`:

```rust
use oore_server::test_utils::{
    create_test_app_with_state,  // Creates app with in-memory DB
    setup_test_db,               // Creates in-memory SQLite
    setup_test_state,            // Creates AppState for testing
    TEST_ADMIN_TOKEN,            // Token for admin endpoints
};
```

### Creating a Test Server

```rust
use axum_test::TestServer;
use oore_server::test_utils::{create_test_app_with_state, TEST_ADMIN_TOKEN};

async fn create_server() -> TestServer {
    let (app, _config) = create_test_app_with_state().await;
    TestServer::new(app).expect("Failed to create test server")
}

#[tokio::test]
async fn my_test() {
    let server = create_server().await;

    // Make requests
    let response = server
        .get("/api/endpoint")
        .add_header("Authorization", format!("Bearer {}", TEST_ADMIN_TOKEN))
        .await;

    response.assert_status_ok();
}
```

### Accessing Test Database

```rust
async fn test_with_db() {
    let (state, config) = setup_test_state().await;

    // Access database directly
    let db = &config.db;

    // Access worker channels
    let mut webhook_rx = config.webhook_rx;
    let mut build_rx = config.build_rx;
}
```

## Test Categories

### Unit Tests
- Located within source files as `#[cfg(test)] mod tests`
- Test individual functions and modules
- Fast, no external dependencies

### Integration Tests
- Located in `crates/*/tests/`
- Test API endpoints with real database (in-memory)
- Test component interactions

### BDD Specifications
- Located in `tests/specs/`
- Human-readable test definitions
- Can be converted to executable tests

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Release tags

```yaml
# Example GitHub Actions workflow
test:
  runs-on: macos-latest
  steps:
    - uses: actions/checkout@v4
    - name: Run Rust tests
      run: cargo test
```

## Coverage Goals

| Component | Target Coverage |
|-----------|-----------------|
| Core business logic | 80%+ |
| API endpoints | 100% happy paths |
| Error handling | Critical paths |

## Best Practices

1. **Test behavior, not implementation** - Tests should verify what the code does, not how it does it.

2. **Use descriptive test names** - `test_create_repository_with_invalid_provider` not `test_repo_1`.

3. **One assertion per test** (when practical) - Makes failures easier to diagnose.

4. **Keep tests independent** - Each test should set up its own state.

5. **Test error cases** - Don't just test the happy path.

6. **Update tests when changing behavior** - Tests are documentation.

7. **Document the user journey first** - Write `user-journeys.md` before code.

## Troubleshooting

### Tests fail with "database is locked"
- Ensure tests use unique in-memory databases
- Check for leaked connections

### axum-test version mismatch
- Ensure `axum-test` version matches `axum` version
- Check workspace Cargo.toml for version alignment
