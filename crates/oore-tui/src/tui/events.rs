//! Event handling for the TUI.
//!
//! This module provides async event handling infrastructure.
//! Currently unused (using synchronous polling in main loop),
//! but prepared for future async operations.

#![allow(dead_code)]

use std::time::Duration;

use crossterm::event::{self, Event, KeyEvent};

/// Event handler for keyboard and tick events.
pub struct EventHandler {
    /// Tick rate for periodic updates.
    pub tick_rate: Duration,
}

impl EventHandler {
    /// Create a new event handler with the given tick rate.
    pub fn new(tick_rate: Duration) -> Self {
        Self { tick_rate }
    }

    /// Poll for the next event.
    ///
    /// Returns `Some(event)` if an event is available within the tick rate,
    /// or `None` if the timeout elapsed.
    pub fn poll(&self) -> Option<Event> {
        if event::poll(self.tick_rate).ok()? {
            event::read().ok()
        } else {
            None
        }
    }

    /// Poll for keyboard events only.
    pub fn poll_key(&self) -> Option<KeyEvent> {
        match self.poll() {
            Some(Event::Key(key)) => Some(key),
            _ => None,
        }
    }
}

impl Default for EventHandler {
    fn default() -> Self {
        Self::new(Duration::from_millis(100))
    }
}
