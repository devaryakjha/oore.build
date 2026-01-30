//! Output formatting utilities for CLI.

#![allow(dead_code)]

use console::style;

/// Prints a table header with the given columns.
pub fn print_table_header(columns: &[(&str, usize)]) {
    let header: String = columns
        .iter()
        .map(|(name, width)| format!("{:<width$}", name, width = width))
        .collect::<Vec<_>>()
        .join(" ");
    println!("{}", style(header).bold());

    let total_width: usize = columns.iter().map(|(_, w)| w + 1).sum();
    println!("{}", "-".repeat(total_width.saturating_sub(1)));
}

/// Prints a table row with the given values.
pub fn print_table_row(values: &[(&str, usize)]) {
    let row: String = values
        .iter()
        .map(|(val, width)| {
            // Truncate value if too long
            if val.len() > *width {
                format!("{}...", &val[..width.saturating_sub(3)])
            } else {
                format!("{:<width$}", val, width = width)
            }
        })
        .collect::<Vec<_>>()
        .join(" ");
    println!("{}", row);
}

/// Prints a key-value pair with consistent formatting.
pub fn print_key_value(key: &str, value: &str) {
    println!("{:<16}{}", format!("{}:", key), value);
}

/// Prints a section header.
pub fn print_section(title: &str) {
    println!();
    println!("{}", style(title).bold().underlined());
}

/// Prints an empty line.
pub fn print_empty() {
    println!();
}

/// Prints a success message.
pub fn print_success(message: &str) {
    println!("{} {}", style("✓").green(), message);
}

/// Prints an info message.
pub fn print_info(message: &str) {
    println!("{} {}", style("ℹ").blue(), message);
}

/// Prints a warning message.
pub fn print_warning(message: &str) {
    eprintln!("{} {}", style("⚠").yellow(), message);
}

/// Prints an error message.
pub fn print_error(message: &str) {
    eprintln!("{} {}", style("✗").red(), message);
}
