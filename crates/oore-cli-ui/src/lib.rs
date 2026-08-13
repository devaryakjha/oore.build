//! Shared terminal presentation for Oore command-line applications.
//!
//! This crate owns terminal detection, color policy, Oore's theme, and common
//! prompt framing. It keeps interactive rendering on stderr, so commands can
//! reserve stdout for data.

#![forbid(unsafe_code)]
#![deny(missing_docs)]

use std::fmt::Display;
use std::io::{self, IsTerminal};

use cliclack::{Theme, ThemeState};
use console::{Color, Emoji, Style, style};

const RADIO_ACTIVE: Emoji<'_, '_> = Emoji("●", ">");
const RADIO_INACTIVE: Emoji<'_, '_> = Emoji("○", " ");
const CHECKBOX_ACTIVE: Emoji<'_, '_> = Emoji("◻", "[•]");
const CHECKBOX_SELECTED: Emoji<'_, '_> = Emoji("◼", "[+]");
const CHECKBOX_INACTIVE: Emoji<'_, '_> = Emoji("◻", "[ ]");

/// Controls ANSI color in human-readable terminal output.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum ColorMode {
    /// Use color only when stderr supports it.
    #[default]
    Auto,
    /// Always emit ANSI color.
    Always,
    /// Never emit ANSI color.
    Never,
}

/// One selectable value with a short decision hint.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SelectChoice<T> {
    value: T,
    label: String,
    hint: String,
}

impl<T> SelectChoice<T> {
    /// Creates one choice for a terminal selection prompt.
    pub fn new(value: T, label: impl Into<String>, hint: impl Into<String>) -> Self {
        Self {
            value,
            label: label.into(),
            hint: hint.into(),
        }
    }
}

/// The outcome of an interactive prompt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PromptResult<T> {
    /// The user submitted a value.
    Submitted(T),
    /// The user cancelled with Escape or Control-C.
    Cancelled,
}

/// Oore's terminal presentation context.
#[derive(Debug, Clone, Copy)]
pub struct Terminal {
    interactive: bool,
    decorated: bool,
    color_enabled: bool,
}

/// One human-readable operation in an Oore command flow.
pub struct Operation {
    progress: Option<cliclack::ProgressBar>,
}

impl Operation {
    /// Updates the active operation message.
    pub fn update(&self, message: impl Display) {
        if let Some(progress) = &self.progress {
            progress.set_message(message);
        }
    }

    /// Finishes the operation with a success state.
    pub fn done(self, message: impl Display) {
        if let Some(progress) = self.progress {
            progress.stop(message);
        } else {
            eprintln!("{message}");
        }
    }

    /// Finishes the operation with an error state.
    pub fn failed(self, message: impl Display) {
        if let Some(progress) = self.progress {
            progress.error(message);
        } else {
            eprintln!("{message}");
        }
    }
}

impl Terminal {
    /// Detects terminal capabilities and applies Oore's process-wide theme.
    pub fn new(color_mode: ColorMode) -> Self {
        let stdin_is_terminal = std::io::stdin().is_terminal();
        let stderr_is_terminal = std::io::stderr().is_terminal();
        let term = std::env::var("TERM").ok();
        let term_is_dumb = terminal_is_dumb(term.as_deref());
        let no_color = std::env::var_os("NO_COLOR").is_some();
        let color_enabled = resolve_color(color_mode, stderr_is_terminal, no_color, term_is_dumb);

        console::set_colors_enabled(color_enabled);
        console::set_colors_enabled_stderr(color_enabled);
        cliclack::set_theme(OoreTheme);

        Self {
            interactive: stdin_is_terminal && stderr_is_terminal && !term_is_dumb,
            decorated: stderr_is_terminal && !term_is_dumb,
            color_enabled,
        }
    }

    /// Returns true when this process can prompt for input.
    pub fn is_interactive(self) -> bool {
        self.interactive
    }

    /// Returns true when common SSH session variables identify a remote shell.
    pub fn is_remote_session(self) -> bool {
        ["SSH_CONNECTION", "SSH_CLIENT", "SSH_TTY"]
            .into_iter()
            .any(|key| std::env::var_os(key).is_some_and(|value| !value.is_empty()))
    }

    /// Starts a framed Oore command flow.
    pub fn intro(self, flow: impl Display) -> io::Result<()> {
        if self.decorated {
            let brand = brand_label();
            let flow = style(flow).dim().for_stderr();
            cliclack::intro(format!("{brand}  {flow}"))
        } else {
            let brand = if self.color_enabled {
                brand_label().to_string()
            } else {
                "Oore".to_string()
            };
            eprintln!("{brand} — {flow}");
            Ok(())
        }
    }

    /// Ends a framed Oore command flow.
    pub fn outro(self, message: impl Display) -> io::Result<()> {
        if self.decorated {
            cliclack::outro(message)
        } else {
            eprintln!("{message}");
            Ok(())
        }
    }

    /// Prints a titled block of human-readable information.
    pub fn note(self, title: impl Display, message: impl Display) -> io::Result<()> {
        if self.decorated {
            cliclack::note(title, message)
        } else {
            let title = style(title).bold().for_stderr();
            eprintln!();
            eprintln!("{title}");
            for line in message.to_string().lines() {
                if line.is_empty() {
                    eprintln!();
                } else {
                    eprintln!("  {line}");
                }
            }
            Ok(())
        }
    }

    /// Starts one progress operation.
    pub fn operation(self, message: impl Display) -> Operation {
        let message = message.to_string();
        if self.decorated {
            let progress = cliclack::spinner();
            progress.start(&message);
            Operation {
                progress: Some(progress),
            }
        } else {
            eprintln!("{message}");
            Operation { progress: None }
        }
    }

    /// Prompts for one value.
    ///
    /// # Errors
    ///
    /// Returns [`io::ErrorKind::NotConnected`] when no interactive terminal is
    /// available. Other terminal I/O errors pass through unchanged.
    pub fn select<T>(
        self,
        prompt: impl Display,
        choices: impl IntoIterator<Item = SelectChoice<T>>,
        initial_value: T,
    ) -> io::Result<PromptResult<T>>
    where
        T: Clone + Eq,
    {
        if !self.interactive {
            return Err(io::ErrorKind::NotConnected.into());
        }

        let mut selection = cliclack::select(prompt).initial_value(initial_value);
        for choice in choices {
            selection = selection.item(choice.value, choice.label, choice.hint);
        }

        match selection.interact() {
            Ok(value) => Ok(PromptResult::Submitted(value)),
            Err(error) if error.kind() == io::ErrorKind::Interrupted => Ok(PromptResult::Cancelled),
            Err(error) => Err(error),
        }
    }

    /// Prompts for one text value.
    ///
    /// # Errors
    ///
    /// Returns [`io::ErrorKind::NotConnected`] when no interactive terminal is
    /// available. Other terminal I/O errors pass through unchanged.
    pub fn input(
        self,
        prompt: impl Display,
        default: Option<&str>,
        required: bool,
    ) -> io::Result<PromptResult<String>> {
        if !self.interactive {
            return Err(io::ErrorKind::NotConnected.into());
        }

        let mut input = cliclack::input(prompt).required(required);
        if let Some(default) = default {
            input = input.default_input(default);
        }
        match input.interact() {
            Ok(value) => Ok(PromptResult::Submitted(value)),
            Err(error) if error.kind() == io::ErrorKind::Interrupted => Ok(PromptResult::Cancelled),
            Err(error) => Err(error),
        }
    }

    /// Prompts for one masked value.
    ///
    /// # Errors
    ///
    /// Returns [`io::ErrorKind::NotConnected`] when no interactive terminal is
    /// available. Other terminal I/O errors pass through unchanged.
    pub fn password(
        self,
        prompt: impl Display,
        allow_empty: bool,
    ) -> io::Result<PromptResult<String>> {
        if !self.interactive {
            return Err(io::ErrorKind::NotConnected.into());
        }

        let mut password = cliclack::password(prompt);
        if allow_empty {
            password = password.allow_empty();
        }
        match password.interact() {
            Ok(value) => Ok(PromptResult::Submitted(value)),
            Err(error) if error.kind() == io::ErrorKind::Interrupted => Ok(PromptResult::Cancelled),
            Err(error) => Err(error),
        }
    }

    /// Prompts for confirmation.
    ///
    /// # Errors
    ///
    /// Returns [`io::ErrorKind::NotConnected`] when no interactive terminal is
    /// available. Other terminal I/O errors pass through unchanged.
    pub fn confirm(
        self,
        prompt: impl Display,
        initial_value: bool,
    ) -> io::Result<PromptResult<bool>> {
        if !self.interactive {
            return Err(io::ErrorKind::NotConnected.into());
        }

        match cliclack::confirm(prompt)
            .initial_value(initial_value)
            .interact()
        {
            Ok(value) => Ok(PromptResult::Submitted(value)),
            Err(error) if error.kind() == io::ErrorKind::Interrupted => Ok(PromptResult::Cancelled),
            Err(error) => Err(error),
        }
    }
}

fn brand_label() -> impl Display {
    style(" oore ").black().on_color256(172).bold().for_stderr()
}

fn terminal_is_dumb(term: Option<&str>) -> bool {
    match term {
        Some(value) => value.trim().is_empty() || value.eq_ignore_ascii_case("dumb"),
        None => true,
    }
}

fn resolve_color(
    mode: ColorMode,
    stderr_is_terminal: bool,
    no_color: bool,
    term_is_dumb: bool,
) -> bool {
    match mode {
        ColorMode::Always => true,
        ColorMode::Never => false,
        ColorMode::Auto => stderr_is_terminal && !no_color && !term_is_dumb,
    }
}

struct OoreTheme;

impl OoreTheme {
    fn accent() -> Style {
        Style::new().fg(Color::Color256(172)).for_stderr()
    }
}

impl Theme for OoreTheme {
    fn bar_color(&self, state: &ThemeState) -> Style {
        match state {
            ThemeState::Active => Self::accent(),
            ThemeState::Cancel => Style::new().red().for_stderr(),
            ThemeState::Submit => Style::new().dim().for_stderr(),
            ThemeState::Error(_) => Style::new().yellow().for_stderr(),
        }
    }

    fn state_symbol_color(&self, state: &ThemeState) -> Style {
        match state {
            ThemeState::Submit => Style::new().green().for_stderr(),
            _ => self.bar_color(state),
        }
    }

    fn radio_symbol(&self, state: &ThemeState, selected: bool) -> String {
        match state {
            ThemeState::Active if selected => Self::accent().apply_to(RADIO_ACTIVE),
            ThemeState::Active => Style::new().dim().for_stderr().apply_to(RADIO_INACTIVE),
            _ => Style::new().apply_to(Emoji("", "")),
        }
        .to_string()
    }

    fn checkbox_symbol(&self, state: &ThemeState, selected: bool, active: bool) -> String {
        match state {
            ThemeState::Active | ThemeState::Error(_) if selected => {
                Self::accent().apply_to(CHECKBOX_SELECTED)
            }
            ThemeState::Active | ThemeState::Error(_) if active => {
                Self::accent().apply_to(CHECKBOX_ACTIVE)
            }
            ThemeState::Active | ThemeState::Error(_) => {
                Style::new().dim().for_stderr().apply_to(CHECKBOX_INACTIVE)
            }
            _ => Style::new().apply_to(Emoji("", "")),
        }
        .to_string()
    }
}
