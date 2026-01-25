//! Oore Core Library
//!
//! Shared types, database operations, and business logic for the Oore CI/CD platform.

pub mod crypto;
pub mod db;
pub mod error;
pub mod models;
pub mod oauth;
pub mod providers;
pub mod webhook;

pub use error::{OoreError, Result};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
