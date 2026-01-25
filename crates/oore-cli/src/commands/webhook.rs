//! Webhook event commands.

use anyhow::{Context, Result};
use clap::Subcommand;
use serde::Deserialize;

#[derive(Subcommand)]
pub enum WebhookCommands {
    /// List webhook events
    List {
        /// Filter by repository ID
        #[arg(long)]
        repo: Option<String>,
    },

    /// Show webhook event details
    Show {
        /// Event ID
        id: String,
    },
}

#[derive(Deserialize)]
struct WebhookEventResponse {
    id: String,
    repository_id: Option<String>,
    provider: String,
    event_type: String,
    delivery_id: String,
    processed: bool,
    error_message: Option<String>,
    received_at: String,
}

pub async fn handle_webhook_command(server: &str, cmd: WebhookCommands) -> Result<()> {
    match cmd {
        WebhookCommands::List { repo } => list_events(server, repo).await,
        WebhookCommands::Show { id } => show_event(server, &id).await,
    }
}

async fn list_events(server: &str, _repo: Option<String>) -> Result<()> {
    // TODO: Add repo filter query param when implemented
    let url = format!("{}/api/webhooks/events", server);
    let response: Vec<WebhookEventResponse> = reqwest::get(&url)
        .await
        .context("Failed to connect to server")?
        .json()
        .await
        .context("Failed to parse response")?;

    if response.is_empty() {
        println!("No webhook events found.");
        return Ok(());
    }

    println!(
        "{:<28} {:<10} {:<15} {:<10} {:<10}",
        "ID", "PROVIDER", "EVENT TYPE", "PROCESSED", "ERROR"
    );
    println!("{}", "-".repeat(80));

    for event in response {
        let processed = if event.processed { "yes" } else { "no" };
        let error = if event.error_message.is_some() {
            "yes"
        } else {
            "no"
        };
        println!(
            "{:<28} {:<10} {:<15} {:<10} {:<10}",
            event.id, event.provider, event.event_type, processed, error
        );
    }

    Ok(())
}

async fn show_event(server: &str, id: &str) -> Result<()> {
    let url = format!("{}/api/webhooks/events/{}", server, id);
    let response: WebhookEventResponse = reqwest::get(&url)
        .await
        .context("Failed to connect to server")?
        .json()
        .await
        .context("Failed to parse response")?;

    println!("ID:           {}", response.id);
    println!("Provider:     {}", response.provider);
    println!("Event Type:   {}", response.event_type);
    println!("Delivery ID:  {}", response.delivery_id);
    println!("Processed:    {}", if response.processed { "yes" } else { "no" });

    if let Some(repo_id) = &response.repository_id {
        println!("Repository:   {}", repo_id);
    }

    if let Some(error) = &response.error_message {
        println!("Error:        {}", error);
    }

    println!("Received:     {}", response.received_at);

    Ok(())
}
