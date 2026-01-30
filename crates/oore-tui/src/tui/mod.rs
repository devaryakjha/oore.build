//! Interactive TUI mode.

mod app;
mod events;
mod terminal;

use anyhow::Result;
use crossterm::event::{poll, read, Event, KeyCode, KeyEventKind};
use ratatui::{
    layout::{Constraint, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph},
    Frame,
};

use crate::shared::client::OoreClient;

pub use app::App;
pub use terminal::Terminal;

/// Run the TUI application.
pub async fn run(client: OoreClient) -> Result<()> {
    // Initialize terminal
    let mut terminal = Terminal::new()?;
    terminal.enter()?;

    // Create app state
    let mut app = App::new(client);

    // Main loop
    let result = run_app(&mut terminal, &mut app).await;

    // Restore terminal
    terminal.exit()?;

    result
}

/// Main application loop.
async fn run_app(terminal: &mut Terminal, app: &mut App) -> Result<()> {
    loop {
        // Draw the UI
        terminal.draw(|frame| ui(frame, app))?;

        // Handle events
        if poll(std::time::Duration::from_millis(100))?
            && let Event::Key(key) = read()?
            && key.kind == KeyEventKind::Press
        {
            match key.code {
                KeyCode::Char('q') => {
                    app.should_quit = true;
                }
                KeyCode::Char('?') => {
                    app.show_help = !app.show_help;
                }
                KeyCode::Esc => {
                    if app.show_help {
                        app.show_help = false;
                    }
                }
                _ => {}
            }
        }

        // Check if we should quit
        if app.should_quit {
            break;
        }
    }

    Ok(())
}

/// Render the UI.
fn ui(frame: &mut Frame, app: &App) {
    let area = frame.area();

    // Create main layout: header, content, footer
    let layout = Layout::vertical([
        Constraint::Length(3), // Header
        Constraint::Min(1),    // Content
        Constraint::Length(3), // Footer
    ])
    .split(area);

    // Header
    let header = Paragraph::new(Line::from(vec![
        Span::styled(
            " oore ",
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw("- Self-hosted Flutter CI/CD"),
    ]))
    .block(Block::default().borders(Borders::BOTTOM));
    frame.render_widget(header, layout[0]);

    // Content
    if app.show_help {
        render_help(frame, layout[1]);
    } else {
        render_main(frame, layout[1], app);
    }

    // Footer
    let footer = Paragraph::new(Line::from(vec![
        Span::styled(" q ", Style::default().fg(Color::Yellow)),
        Span::raw("quit  "),
        Span::styled(" ? ", Style::default().fg(Color::Yellow)),
        Span::raw("help"),
    ]))
    .block(Block::default().borders(Borders::TOP));
    frame.render_widget(footer, layout[2]);
}

/// Render the main content area.
fn render_main(frame: &mut Frame, area: Rect, app: &App) {
    let content = vec![
        Line::from(""),
        Line::from(Span::styled(
            "Repository management coming soon...",
            Style::default().fg(Color::DarkGray),
        )),
        Line::from(""),
        Line::from(vec![
            Span::raw("Connected to: "),
            Span::styled(app.client.server(), Style::default().fg(Color::Green)),
        ]),
        Line::from(vec![
            Span::raw("Auth: "),
            Span::styled(
                if app.client.has_admin_token() {
                    "configured"
                } else {
                    "none"
                },
                Style::default().fg(if app.client.has_admin_token() {
                    Color::Green
                } else {
                    Color::Yellow
                }),
            ),
        ]),
    ];

    let paragraph = Paragraph::new(content).block(
        Block::default()
            .title(" Dashboard ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::DarkGray)),
    );

    frame.render_widget(paragraph, area);
}

/// Render the help overlay.
fn render_help(frame: &mut Frame, area: Rect) {
    let help_text = vec![
        Line::from(""),
        Line::from(Span::styled(
            "Keyboard Shortcuts",
            Style::default().add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from(vec![
            Span::styled("  q     ", Style::default().fg(Color::Yellow)),
            Span::raw("Quit the application"),
        ]),
        Line::from(vec![
            Span::styled("  ?     ", Style::default().fg(Color::Yellow)),
            Span::raw("Toggle this help"),
        ]),
        Line::from(vec![
            Span::styled("  Esc   ", Style::default().fg(Color::Yellow)),
            Span::raw("Close help / cancel"),
        ]),
        Line::from(""),
        Line::from(Span::styled(
            "Navigation (coming soon)",
            Style::default().add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from(vec![
            Span::styled("  j/k   ", Style::default().fg(Color::DarkGray)),
            Span::styled("Move down/up", Style::default().fg(Color::DarkGray)),
        ]),
        Line::from(vec![
            Span::styled("  Enter ", Style::default().fg(Color::DarkGray)),
            Span::styled("Select item", Style::default().fg(Color::DarkGray)),
        ]),
        Line::from(vec![
            Span::styled("  Tab   ", Style::default().fg(Color::DarkGray)),
            Span::styled("Switch panel", Style::default().fg(Color::DarkGray)),
        ]),
    ];

    let help = Paragraph::new(help_text).block(
        Block::default()
            .title(" Help ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::Cyan)),
    );

    frame.render_widget(help, area);
}
