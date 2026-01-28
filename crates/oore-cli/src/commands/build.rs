//! Build management commands.

use anyhow::{Context, Result};
use clap::Subcommand;
use serde::{Deserialize, Serialize};

#[derive(Subcommand)]
pub enum BuildCommands {
    /// List builds
    List {
        /// Filter by repository ID
        #[arg(long)]
        repo: Option<String>,
    },

    /// Show build details
    Show {
        /// Build ID
        id: String,
    },

    /// Trigger a manual build
    Trigger {
        /// Repository ID
        repo_id: String,

        /// Branch to build (defaults to repo's default branch)
        #[arg(long)]
        branch: Option<String>,

        /// Specific commit SHA to build
        #[arg(long)]
        commit: Option<String>,
    },

    /// Cancel a build
    Cancel {
        /// Build ID
        id: String,
    },

    /// Show build steps
    Steps {
        /// Build ID
        id: String,
    },

    /// Show build logs
    Logs {
        /// Build ID
        id: String,

        /// Show logs for specific step (0-indexed)
        #[arg(long)]
        step: Option<i32>,
    },
}

#[derive(Deserialize)]
struct BuildResponse {
    id: String,
    repository_id: String,
    webhook_event_id: Option<String>,
    commit_sha: String,
    branch: String,
    trigger_type: String,
    status: String,
    started_at: Option<String>,
    finished_at: Option<String>,
    created_at: String,
    workflow_name: Option<String>,
    config_source: Option<String>,
    error_message: Option<String>,
}

#[derive(Deserialize)]
struct BuildStepResponse {
    id: String,
    step_index: i32,
    name: String,
    status: String,
    exit_code: Option<i32>,
    started_at: Option<String>,
    finished_at: Option<String>,
}

#[derive(Deserialize)]
struct BuildLogContentResponse {
    step_index: i32,
    stream: String,
    content: String,
    line_count: i32,
}

#[derive(Serialize)]
struct TriggerBuildRequest {
    branch: Option<String>,
    commit_sha: Option<String>,
}

pub async fn handle_build_command(server: &str, cmd: BuildCommands) -> Result<()> {
    match cmd {
        BuildCommands::List { repo } => list_builds(server, repo).await,
        BuildCommands::Show { id } => show_build(server, &id).await,
        BuildCommands::Trigger {
            repo_id,
            branch,
            commit,
        } => trigger_build(server, &repo_id, branch, commit).await,
        BuildCommands::Cancel { id } => cancel_build(server, &id).await,
        BuildCommands::Steps { id } => show_build_steps(server, &id).await,
        BuildCommands::Logs { id, step } => show_build_logs(server, &id, step).await,
    }
}

async fn list_builds(server: &str, repo: Option<String>) -> Result<()> {
    let url = match repo {
        Some(repo_id) => format!("{}/api/builds?repo={}", server, repo_id),
        None => format!("{}/api/builds", server),
    };

    let response: Vec<BuildResponse> = reqwest::get(&url)
        .await
        .context("Failed to connect to server")?
        .json()
        .await
        .context("Failed to parse response")?;

    if response.is_empty() {
        println!("No builds found.");
        return Ok(());
    }

    println!(
        "{:<28} {:<12} {:<15} {:<10} {:<10}",
        "ID", "STATUS", "TRIGGER", "BRANCH", "COMMIT"
    );
    println!("{}", "-".repeat(80));

    for build in response {
        let commit_short = if build.commit_sha.len() > 7 {
            &build.commit_sha[..7]
        } else {
            &build.commit_sha
        };
        let branch_short = if build.branch.len() > 15 {
            format!("{}...", &build.branch[..12])
        } else {
            build.branch.clone()
        };

        println!(
            "{:<28} {:<12} {:<15} {:<10} {:<10}",
            build.id, build.status, build.trigger_type, branch_short, commit_short
        );
    }

    Ok(())
}

async fn show_build(server: &str, id: &str) -> Result<()> {
    let url = format!("{}/api/builds/{}", server, id);
    let response: BuildResponse = reqwest::get(&url)
        .await
        .context("Failed to connect to server")?
        .json()
        .await
        .context("Failed to parse response")?;

    println!("ID:           {}", response.id);
    println!("Repository:   {}", response.repository_id);
    println!("Status:       {}", response.status);
    println!("Trigger:      {}", response.trigger_type);
    println!("Branch:       {}", response.branch);
    println!("Commit:       {}", response.commit_sha);

    if let Some(workflow) = &response.workflow_name {
        println!("Workflow:     {}", workflow);
    }

    if let Some(source) = &response.config_source {
        println!("Config:       {}", source);
    }

    if let Some(event_id) = &response.webhook_event_id {
        println!("Webhook:      {}", event_id);
    }

    println!("Created:      {}", response.created_at);

    if let Some(started) = &response.started_at {
        println!("Started:      {}", started);
    }

    if let Some(finished) = &response.finished_at {
        println!("Finished:     {}", finished);
    }

    if let Some(error) = &response.error_message {
        println!();
        println!("Error:        {}", error);
    }

    Ok(())
}

async fn trigger_build(
    server: &str,
    repo_id: &str,
    branch: Option<String>,
    commit: Option<String>,
) -> Result<()> {
    let url = format!("{}/api/repositories/{}/trigger", server, repo_id);

    let request = TriggerBuildRequest {
        branch,
        commit_sha: commit,
    };

    let client = reqwest::Client::new();
    let response: BuildResponse = client
        .post(&url)
        .json(&request)
        .send()
        .await
        .context("Failed to connect to server")?
        .json()
        .await
        .context("Failed to parse response")?;

    println!("Build triggered successfully!");
    println!();
    println!("ID:     {}", response.id);
    println!("Branch: {}", response.branch);
    println!("Commit: {}", response.commit_sha);
    println!("Status: {}", response.status);

    Ok(())
}

async fn cancel_build(server: &str, id: &str) -> Result<()> {
    let url = format!("{}/api/builds/{}/cancel", server, id);
    let client = reqwest::Client::new();
    client
        .post(&url)
        .send()
        .await
        .context("Failed to connect to server")?;

    println!("Build {} cancelled.", id);

    Ok(())
}

async fn show_build_steps(server: &str, id: &str) -> Result<()> {
    let url = format!("{}/api/builds/{}/steps", server, id);
    let response: Vec<BuildStepResponse> = reqwest::get(&url)
        .await
        .context("Failed to connect to server")?
        .json()
        .await
        .context("Failed to parse response")?;

    if response.is_empty() {
        println!("No steps found for build {}.", id);
        return Ok(());
    }

    println!(
        "{:<5} {:<30} {:<12} {:<10}",
        "STEP", "NAME", "STATUS", "EXIT CODE"
    );
    println!("{}", "-".repeat(60));

    for step in response {
        let exit_code = step
            .exit_code
            .map(|c| c.to_string())
            .unwrap_or_else(|| "-".to_string());
        let name_short = if step.name.len() > 28 {
            format!("{}...", &step.name[..25])
        } else {
            step.name.clone()
        };

        println!(
            "{:<5} {:<30} {:<12} {:<10}",
            step.step_index, name_short, step.status, exit_code
        );
    }

    Ok(())
}

async fn show_build_logs(server: &str, id: &str, step: Option<i32>) -> Result<()> {
    let url = match step {
        Some(s) => format!("{}/api/builds/{}/logs/content?step={}", server, id, s),
        None => format!("{}/api/builds/{}/logs/content?step=0", server, id),
    };

    let response: Vec<BuildLogContentResponse> = reqwest::get(&url)
        .await
        .context("Failed to connect to server")?
        .json()
        .await
        .context("Failed to parse response")?;

    let has_content = response.iter().any(|l| !l.content.is_empty());

    for log in &response {
        if !log.content.is_empty() {
            println!("=== Step {} {} ({} lines) ===", log.step_index, log.stream.to_uppercase(), log.line_count);
            println!("{}", log.content);
            println!();
        }
    }

    if !has_content {
        println!("No logs available for step {}.", step.unwrap_or(0));
    }

    Ok(())
}
