//! Repository management commands.

use anyhow::{Context, Result};
use clap::Subcommand;
use serde::{Deserialize, Serialize};

#[derive(Subcommand)]
pub enum RepoCommands {
    /// List all repositories
    List,

    /// Add a new repository
    Add {
        /// Git provider (github or gitlab)
        #[arg(long)]
        provider: String,

        /// Repository owner (user or organization)
        #[arg(long)]
        owner: String,

        /// Repository name
        #[arg(long)]
        repo: String,

        /// Custom name for the repository
        #[arg(long)]
        name: Option<String>,

        /// Default branch
        #[arg(long, default_value = "main")]
        branch: String,

        /// Webhook secret (for GitLab)
        #[arg(long)]
        webhook_secret: Option<String>,

        /// GitHub repository ID (numeric)
        #[arg(long)]
        github_repo_id: Option<i64>,

        /// GitHub App installation ID
        #[arg(long)]
        github_installation_id: Option<i64>,

        /// GitLab project ID (numeric)
        #[arg(long)]
        gitlab_project_id: Option<i64>,
    },

    /// Show repository details
    Show {
        /// Repository ID
        id: String,
    },

    /// Remove a repository
    Remove {
        /// Repository ID
        id: String,
    },

    /// Get webhook URL for a repository
    WebhookUrl {
        /// Repository ID
        id: String,
    },
}

#[derive(Deserialize)]
struct RepositoryResponse {
    id: String,
    name: String,
    provider: String,
    owner: String,
    repo_name: String,
    clone_url: String,
    default_branch: String,
    is_active: bool,
    github_repository_id: Option<i64>,
    github_installation_id: Option<i64>,
    gitlab_project_id: Option<i64>,
    created_at: String,
}

#[derive(Serialize)]
struct CreateRepositoryRequest {
    name: Option<String>,
    provider: String,
    owner: String,
    repo_name: String,
    default_branch: Option<String>,
    webhook_secret: Option<String>,
    github_repository_id: Option<i64>,
    github_installation_id: Option<i64>,
    gitlab_project_id: Option<i64>,
}

#[derive(Deserialize)]
struct WebhookUrlResponse {
    webhook_url: String,
    provider: String,
}

pub async fn handle_repo_command(server: &str, cmd: RepoCommands) -> Result<()> {
    match cmd {
        RepoCommands::List => list_repos(server).await,
        RepoCommands::Add {
            provider,
            owner,
            repo,
            name,
            branch,
            webhook_secret,
            github_repo_id,
            github_installation_id,
            gitlab_project_id,
        } => {
            add_repo(
                server,
                provider,
                owner,
                repo,
                name,
                branch,
                webhook_secret,
                github_repo_id,
                github_installation_id,
                gitlab_project_id,
            )
            .await
        }
        RepoCommands::Show { id } => show_repo(server, &id).await,
        RepoCommands::Remove { id } => remove_repo(server, &id).await,
        RepoCommands::WebhookUrl { id } => get_webhook_url(server, &id).await,
    }
}

async fn list_repos(server: &str) -> Result<()> {
    let url = format!("{}/api/repositories", server);
    let response: Vec<RepositoryResponse> = reqwest::get(&url)
        .await
        .context("Failed to connect to server")?
        .json()
        .await
        .context("Failed to parse response")?;

    if response.is_empty() {
        println!("No repositories found.");
        return Ok(());
    }

    println!("{:<28} {:<10} {:<30} {:<10}", "ID", "PROVIDER", "NAME", "ACTIVE");
    println!("{}", "-".repeat(80));

    for repo in response {
        let active = if repo.is_active { "yes" } else { "no" };
        println!(
            "{:<28} {:<10} {:<30} {:<10}",
            repo.id, repo.provider, repo.name, active
        );
    }

    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn add_repo(
    server: &str,
    provider: String,
    owner: String,
    repo: String,
    name: Option<String>,
    branch: String,
    webhook_secret: Option<String>,
    github_repo_id: Option<i64>,
    github_installation_id: Option<i64>,
    gitlab_project_id: Option<i64>,
) -> Result<()> {
    let url = format!("{}/api/repositories", server);

    let request = CreateRepositoryRequest {
        name,
        provider,
        owner,
        repo_name: repo,
        default_branch: Some(branch),
        webhook_secret,
        github_repository_id: github_repo_id,
        github_installation_id,
        gitlab_project_id,
    };

    let client = reqwest::Client::new();
    let response: RepositoryResponse = client
        .post(&url)
        .json(&request)
        .send()
        .await
        .context("Failed to connect to server")?
        .json()
        .await
        .context("Failed to parse response")?;

    println!("Repository added successfully!");
    println!();
    print_repo(&response);

    Ok(())
}

async fn show_repo(server: &str, id: &str) -> Result<()> {
    let url = format!("{}/api/repositories/{}", server, id);
    let response: RepositoryResponse = reqwest::get(&url)
        .await
        .context("Failed to connect to server")?
        .json()
        .await
        .context("Failed to parse response")?;

    print_repo(&response);

    Ok(())
}

async fn remove_repo(server: &str, id: &str) -> Result<()> {
    let url = format!("{}/api/repositories/{}", server, id);
    let client = reqwest::Client::new();
    client
        .delete(&url)
        .send()
        .await
        .context("Failed to connect to server")?;

    println!("Repository {} removed.", id);

    Ok(())
}

async fn get_webhook_url(server: &str, id: &str) -> Result<()> {
    let url = format!("{}/api/repositories/{}/webhook-url", server, id);
    let response: WebhookUrlResponse = reqwest::get(&url)
        .await
        .context("Failed to connect to server")?
        .json()
        .await
        .context("Failed to parse response")?;

    println!("Provider: {}", response.provider);
    println!("Webhook URL: {}", response.webhook_url);
    println!();

    match response.provider.as_str() {
        "github" => {
            println!("Configure in your GitHub App settings:");
            println!("  1. Go to your GitHub App settings");
            println!("  2. Set the Webhook URL to: {}", response.webhook_url);
            println!("  3. Ensure Content type is: application/json");
        }
        "gitlab" => {
            println!("Configure in your GitLab project:");
            println!("  1. Go to Settings > Webhooks");
            println!("  2. Add webhook URL: {}", response.webhook_url);
            println!("  3. Enter your Secret Token");
            println!("  4. Select triggers: Push events, Merge request events");
        }
        _ => {}
    }

    Ok(())
}

fn print_repo(repo: &RepositoryResponse) {
    println!("ID:             {}", repo.id);
    println!("Name:           {}", repo.name);
    println!("Provider:       {}", repo.provider);
    println!("Owner:          {}", repo.owner);
    println!("Repository:     {}", repo.repo_name);
    println!("Clone URL:      {}", repo.clone_url);
    println!("Default Branch: {}", repo.default_branch);
    println!("Active:         {}", if repo.is_active { "yes" } else { "no" });

    if let Some(id) = repo.github_repository_id {
        println!("GitHub Repo ID: {}", id);
    }
    if let Some(id) = repo.github_installation_id {
        println!("GitHub Install: {}", id);
    }
    if let Some(id) = repo.gitlab_project_id {
        println!("GitLab Project: {}", id);
    }

    println!("Created:        {}", repo.created_at);
}
