//! Application state.

use crate::shared::client::OoreClient;

/// Main application state.
pub struct App {
    /// HTTP client for API calls.
    pub client: OoreClient,

    /// Whether the application should quit.
    pub should_quit: bool,

    /// Whether to show the help overlay.
    pub show_help: bool,
}

impl App {
    /// Create a new application instance.
    pub fn new(client: OoreClient) -> Self {
        Self {
            client,
            should_quit: false,
            show_help: false,
        }
    }
}
