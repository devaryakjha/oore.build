//! Demo mode support for local development and testing.
//!
//! When `OORE_DEMO_MODE=true`, the system provides fake data for testing
//! without requiring real GitHub/GitLab connections.

mod data;
mod provider;

pub use data::*;
pub use provider::*;
