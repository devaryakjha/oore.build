//! Oore server library.
//!
//! This library exposes the server components for use in integration tests.

pub mod middleware;
pub mod routes;
pub mod state;
pub mod worker;

pub use middleware::{AdminAuthConfig, require_admin};
pub use state::{AppState, ServerConfig};
pub use worker::{BuildJob, CancelChannels, WebhookJob};

// Re-export oore_core for convenience
pub use oore_core;

// Test utilities are available for both unit tests and integration tests
#[cfg(any(test, feature = "test-utils"))]
pub mod test_utils;
