//! Oore Core Library
//!
//! Shared types, database operations, and business logic for the Oore CI/CD platform.

pub mod auth;
pub mod crypto;
pub mod db;
pub mod demo;
pub mod error;
pub mod flutter;
pub mod models;
pub mod oauth;
pub mod pipeline;
pub mod providers;
pub mod signing;
pub mod webhook;

pub use error::{OoreError, Result};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
