//! Pipeline configuration commands.

use anyhow::{Context, Result};
use clap::Subcommand;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Subcommand)]
pub enum PipelineCommands {
    /// Show pipeline configuration for a repository
    Show {
        /// Repository ID
        repo_id: String,
    },

    /// Set pipeline configuration for a repository
    Set {
        /// Repository ID
        repo_id: String,

        /// Path to YAML configuration file
        #[arg(short, long)]
        file: PathBuf,

        /// Name for the configuration (default: "default")
        #[arg(long)]
        name: Option<String>,
    },

    /// Delete pipeline configuration for a repository
    Delete {
        /// Repository ID
        repo_id: String,
    },

    /// Validate a pipeline YAML file
    Validate {
        /// Path to YAML configuration file
        file: PathBuf,
    },
}

#[derive(Deserialize)]
struct PipelineConfigResponse {
    id: String,
    repository_id: String,
    name: String,
    config_yaml: String,
    is_active: bool,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
struct CreatePipelineConfigRequest {
    name: Option<String>,
    config_yaml: String,
}

#[derive(Deserialize)]
struct ValidateResponse {
    valid: bool,
    workflows: Option<Vec<String>>,
    error: Option<String>,
}

pub async fn handle_pipeline_command(server: &str, cmd: PipelineCommands) -> Result<()> {
    match cmd {
        PipelineCommands::Show { repo_id } => show_pipeline(server, &repo_id).await,
        PipelineCommands::Set {
            repo_id,
            file,
            name,
        } => set_pipeline(server, &repo_id, &file, name).await,
        PipelineCommands::Delete { repo_id } => delete_pipeline(server, &repo_id).await,
        PipelineCommands::Validate { file } => validate_pipeline(server, &file).await,
    }
}

async fn show_pipeline(server: &str, repo_id: &str) -> Result<()> {
    let url = format!("{}/api/repositories/{}/pipeline", server, repo_id);
    let response = reqwest::get(&url)
        .await
        .context("Failed to connect to server")?;

    if response.status() == reqwest::StatusCode::NOT_FOUND {
        println!("No pipeline configuration found for repository {}.", repo_id);
        println!();
        println!("To create one, use:");
        println!("  oore pipeline set {} --file codemagic.yaml", repo_id);
        return Ok(());
    }

    let config: PipelineConfigResponse = response
        .json()
        .await
        .context("Failed to parse response")?;

    println!("Pipeline Configuration");
    println!("======================");
    println!("ID:         {}", config.id);
    println!("Repository: {}", config.repository_id);
    println!("Name:       {}", config.name);
    println!("Active:     {}", config.is_active);
    println!("Created:    {}", config.created_at);
    println!("Updated:    {}", config.updated_at);
    println!();
    println!("Configuration:");
    println!("---");
    println!("{}", config.config_yaml);

    Ok(())
}

async fn set_pipeline(
    server: &str,
    repo_id: &str,
    file: &PathBuf,
    name: Option<String>,
) -> Result<()> {
    // Read the YAML file
    let config_yaml = std::fs::read_to_string(file)
        .with_context(|| format!("Failed to read file: {}", file.display()))?;

    let url = format!("{}/api/repositories/{}/pipeline", server, repo_id);
    let request = CreatePipelineConfigRequest {
        name,
        config_yaml,
    };

    let client = reqwest::Client::new();
    let response = client
        .put(&url)
        .json(&request)
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let status = response.status();
        let body: serde_json::Value = response.json().await.unwrap_or_default();
        let error = body
            .get("error")
            .and_then(|e| e.as_str())
            .unwrap_or("Unknown error");
        let details = body
            .get("details")
            .and_then(|d| d.as_str())
            .map(|d| format!("\nDetails: {}", d))
            .unwrap_or_default();
        anyhow::bail!("Failed to set pipeline ({}):\n{}{}", status, error, details);
    }

    let config: PipelineConfigResponse = response
        .json()
        .await
        .context("Failed to parse response")?;

    println!("Pipeline configuration saved successfully!");
    println!();
    println!("ID:   {}", config.id);
    println!("Name: {}", config.name);

    Ok(())
}

async fn delete_pipeline(server: &str, repo_id: &str) -> Result<()> {
    let url = format!("{}/api/repositories/{}/pipeline", server, repo_id);

    let client = reqwest::Client::new();
    let response = client
        .delete(&url)
        .send()
        .await
        .context("Failed to connect to server")?;

    if !response.status().is_success() {
        let status = response.status();
        let body: serde_json::Value = response.json().await.unwrap_or_default();
        let error = body
            .get("error")
            .and_then(|e| e.as_str())
            .unwrap_or("Unknown error");
        anyhow::bail!("Failed to delete pipeline ({}): {}", status, error);
    }

    println!("Pipeline configuration deleted for repository {}.", repo_id);

    Ok(())
}

async fn validate_pipeline(server: &str, file: &PathBuf) -> Result<()> {
    // Read the YAML file
    let config_yaml = std::fs::read_to_string(file)
        .with_context(|| format!("Failed to read file: {}", file.display()))?;

    let url = format!("{}/api/pipelines/validate", server);
    let request = CreatePipelineConfigRequest {
        name: None,
        config_yaml,
    };

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .json(&request)
        .send()
        .await
        .context("Failed to connect to server")?;

    let result: ValidateResponse = response
        .json()
        .await
        .context("Failed to parse response")?;

    if result.valid {
        println!("Pipeline configuration is valid!");
        if let Some(workflows) = result.workflows {
            println!();
            println!("Workflows defined:");
            for workflow in workflows {
                println!("  - {}", workflow);
            }
        }
    } else {
        println!("Pipeline configuration is INVALID:");
        println!();
        if let Some(error) = result.error {
            println!("{}", error);
        }
        std::process::exit(1);
    }

    Ok(())
}
