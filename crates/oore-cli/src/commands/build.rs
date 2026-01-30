//! Build management commands.

use std::path::PathBuf;

use anyhow::{bail, Context, Result};
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

    /// List build artifacts
    Artifacts {
        /// Build ID
        id: String,
    },

    /// Download a build artifact
    Download {
        /// Build ID
        build_id: String,

        /// Artifact ID
        artifact_id: String,

        /// Output path (defaults to current directory with artifact name)
        #[arg(long, short)]
        output: Option<PathBuf>,
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

#[derive(Deserialize)]
struct BuildArtifactResponse {
    id: String,
    name: String,
    artifact_type: String,
    size_bytes: i64,
    content_type: Option<String>,
    created_at: String,
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
        BuildCommands::Artifacts { id } => list_build_artifacts(server, &id).await,
        BuildCommands::Download {
            build_id,
            artifact_id,
            output,
        } => download_artifact(server, &build_id, &artifact_id, output).await,
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

async fn list_build_artifacts(server: &str, id: &str) -> Result<()> {
    let url = format!("{}/api/builds/{}/artifacts", server, id);

    let response = reqwest::get(&url)
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        bail!("Failed to list artifacts: {} - {}", status, body);
    }

    let artifacts: Vec<BuildArtifactResponse> = response
        .json()
        .await
        .context("Failed to parse response")?;

    if artifacts.is_empty() {
        println!("No artifacts found for build {}.", id);
        return Ok(());
    }

    println!(
        "{:<28} {:<30} {:<12} {:<12}",
        "ID", "NAME", "TYPE", "SIZE"
    );
    println!("{}", "-".repeat(85));

    for artifact in artifacts {
        let name_short = if artifact.name.len() > 28 {
            format!("{}...", &artifact.name[..25])
        } else {
            artifact.name.clone()
        };

        let size_display = format_size(artifact.size_bytes);

        println!(
            "{:<28} {:<30} {:<12} {:<12}",
            artifact.id, name_short, artifact.artifact_type, size_display
        );
    }

    Ok(())
}

async fn download_artifact(
    server: &str,
    build_id: &str,
    artifact_id: &str,
    output: Option<PathBuf>,
) -> Result<()> {
    // First, get artifact metadata to know the filename
    let metadata_url = format!("{}/api/builds/{}/artifacts", server, build_id);
    let metadata_response = reqwest::get(&metadata_url)
        .await
        .context("Failed to connect to server")?;

    if !metadata_response.status().is_success() {
        let status = metadata_response.status();
        let body = metadata_response.text().await.unwrap_or_default();
        bail!("Failed to get artifact metadata: {} - {}", status, body);
    }

    let artifacts: Vec<BuildArtifactResponse> = metadata_response
        .json()
        .await
        .context("Failed to parse artifact metadata")?;

    let artifact = artifacts
        .iter()
        .find(|a| a.id == artifact_id)
        .ok_or_else(|| anyhow::anyhow!("Artifact {} not found in build {}", artifact_id, build_id))?;

    let artifact_name = artifact.name.clone();
    let artifact_size = artifact.size_bytes;

    // Determine output path
    let output_path = match output {
        Some(p) => {
            if p.is_dir() {
                p.join(&artifact_name)
            } else {
                p
            }
        }
        None => PathBuf::from(&artifact_name),
    };

    // Download the artifact
    let download_url = format!(
        "{}/api/builds/{}/artifacts/{}",
        server, build_id, artifact_id
    );

    println!("Downloading {} ({})...", artifact_name, format_size(artifact_size));

    let response = reqwest::get(&download_url)
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        bail!("Failed to download artifact: {} - {}", status, body);
    }

    let bytes = response
        .bytes()
        .await
        .context("Failed to read artifact data")?;

    // Write to file
    tokio::fs::write(&output_path, &bytes)
        .await
        .with_context(|| format!("Failed to write artifact to {:?}", output_path))?;

    println!(
        "Downloaded {} to {}",
        artifact_name,
        output_path.display()
    );

    Ok(())
}

/// Format bytes into human-readable size
fn format_size(bytes: i64) -> String {
    const KB: i64 = 1024;
    const MB: i64 = KB * 1024;
    const GB: i64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}
