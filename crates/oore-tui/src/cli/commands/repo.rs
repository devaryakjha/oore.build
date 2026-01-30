//! Repository command handlers.

use anyhow::Result;

use crate::cli::args::RepoCommands;
use crate::cli::output::{print_key_value, print_success, print_table_header, print_table_row};
use crate::shared::api::{
    create_repository, delete_repository, get_repository, get_webhook_url, list_repositories,
    CreateRepositoryRequest, RepositoryResponse,
};
use crate::shared::client::OoreClient;

/// Handle repository subcommands.
pub async fn handle_repo_command(client: &OoreClient, cmd: RepoCommands) -> Result<()> {
    match cmd {
        RepoCommands::List => list_repos(client).await,
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
                client,
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
        RepoCommands::Show { id } => show_repo(client, &id).await,
        RepoCommands::Remove { id } => remove_repo(client, &id).await,
        RepoCommands::WebhookUrl { id } => show_webhook_url(client, &id).await,
    }
}

async fn list_repos(client: &OoreClient) -> Result<()> {
    let repos = list_repositories(client).await?;

    if repos.is_empty() {
        println!("No repositories found.");
        return Ok(());
    }

    print_table_header(&[("ID", 28), ("PROVIDER", 10), ("NAME", 30), ("ACTIVE", 10)]);

    for repo in repos {
        let active = if repo.is_active { "yes" } else { "no" };
        print_table_row(&[
            (&repo.id, 28),
            (&repo.provider, 10),
            (&repo.name, 30),
            (active, 10),
        ]);
    }

    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn add_repo(
    client: &OoreClient,
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

    let repo = create_repository(client, &request).await?;

    print_success("Repository added successfully!");
    println!();
    print_repo(&repo);

    Ok(())
}

async fn show_repo(client: &OoreClient, id: &str) -> Result<()> {
    let repo = get_repository(client, id).await?;
    print_repo(&repo);
    Ok(())
}

async fn remove_repo(client: &OoreClient, id: &str) -> Result<()> {
    delete_repository(client, id).await?;
    println!("Repository {} removed.", id);
    Ok(())
}

async fn show_webhook_url(client: &OoreClient, id: &str) -> Result<()> {
    let response = get_webhook_url(client, id).await?;

    print_key_value("Provider", &response.provider);
    print_key_value("Webhook URL", &response.webhook_url);
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
    print_key_value("ID", &repo.id);
    print_key_value("Name", &repo.name);
    print_key_value("Provider", &repo.provider);
    print_key_value("Owner", &repo.owner);
    print_key_value("Repository", &repo.repo_name);
    print_key_value("Clone URL", &repo.clone_url);
    print_key_value("Default Branch", &repo.default_branch);
    print_key_value("Active", if repo.is_active { "yes" } else { "no" });

    if let Some(id) = repo.github_repository_id {
        print_key_value("GitHub Repo ID", &id.to_string());
    }
    if let Some(id) = repo.github_installation_id {
        print_key_value("GitHub Install", &id.to_string());
    }
    if let Some(id) = repo.gitlab_project_id {
        print_key_value("GitLab Project", &id.to_string());
    }

    print_key_value("Created", &repo.created_at.to_rfc3339());
}
