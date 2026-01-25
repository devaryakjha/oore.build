//! Webhook verification and parsing.

pub mod parser;
pub mod verifier;

pub use parser::{
    extract_github_repo_info, extract_gitlab_repo_info, is_github_installation_event,
    parse_github_installation_webhook, parse_github_webhook, parse_gitlab_webhook,
};
pub use verifier::*;
