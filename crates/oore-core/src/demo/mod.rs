//! Demo mode support for local development and testing.
//!
//! When `OORE_DEMO_MODE=true`, the server provides fake data to simulate
//! GitHub/GitLab connections, repositories, builds, and logs without
//! requiring real OAuth setup.

mod data;
mod provider;

pub use data::*;
pub use provider::*;
