//! Server middleware.

pub mod admin_auth;

pub use admin_auth::{AdminAuthConfig, require_admin};
