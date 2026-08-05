use std::os::fd::{AsRawFd, OwnedFd};
use std::time::Duration;

use anyhow::Context;
use oore_contract::ConsumeComponentCredentialGrantRequest;
use tokio::io::AsyncWriteExt;
use zeroize::Zeroizing;

use crate::{RunnerConfig, require_safe_daemon_url};

const COMPONENT_CREDENTIAL_FD: i32 = 3;
const COMPONENT_CREDENTIAL_GRANT_HEADER: &str = "x-oore-component-credential-grant";
const COMPONENT_CREDENTIAL_CONTENT_TYPE: &str = "application/octet-stream";
const MAX_COMPONENT_CREDENTIAL_BYTES: usize = 8 * 1024 * 1024;
const COMPONENT_CREDENTIAL_REQUEST_TIMEOUT: Duration = Duration::from_secs(15);

/// A one-use broker handle held only by the trusted runner parent.
pub struct ComponentCredentialGrantHandle(Zeroizing<String>);

impl ComponentCredentialGrantHandle {
    pub fn new(raw_handle: String) -> anyhow::Result<Self> {
        anyhow::ensure!(
            raw_handle.len() == 64
                && raw_handle
                    .bytes()
                    .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte)),
            "component credential grant handle is invalid"
        );
        Ok(Self(Zeroizing::new(raw_handle)))
    }

    fn as_str(&self) -> &str {
        self.0.as_str()
    }
}

/// Redeem one exact grant. This request is never retried because redemption is one-use.
pub async fn consume_component_credential_grant(
    client: &reqwest::Client,
    config: &RunnerConfig,
    request: &ConsumeComponentCredentialGrantRequest,
    handle: &ComponentCredentialGrantHandle,
) -> anyhow::Result<Zeroizing<Vec<u8>>> {
    require_safe_daemon_url(&config.daemon_url)?;
    let response = client
        .post(format!(
            "{}/v1/runners/{}/component-credentials/consume",
            config.daemon_url.trim_end_matches('/'),
            config.runner_id
        ))
        .bearer_auth(&config.runner_token)
        .header(COMPONENT_CREDENTIAL_GRANT_HEADER, handle.as_str())
        .json(request)
        .timeout(COMPONENT_CREDENTIAL_REQUEST_TIMEOUT)
        .send()
        .await
        .context("component credential grant request failed")?;

    anyhow::ensure!(
        response.status() == reqwest::StatusCode::OK,
        "component credential grant was unavailable ({})",
        response.status()
    );
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok());
    anyhow::ensure!(
        content_type == Some(COMPONENT_CREDENTIAL_CONTENT_TYPE),
        "component credential grant returned an invalid content type"
    );
    anyhow::ensure!(
        response
            .headers()
            .get(reqwest::header::CACHE_CONTROL)
            .and_then(|value| value.to_str().ok())
            == Some("no-store"),
        "component credential grant did not forbid caching"
    );
    if let Some(length) = response.content_length() {
        anyhow::ensure!(
            length > 0 && length <= MAX_COMPONENT_CREDENTIAL_BYTES as u64,
            "component credential grant size is invalid"
        );
    }

    let mut response = response;
    let mut secret = Zeroizing::new(Vec::new());
    while let Some(chunk) = response
        .chunk()
        .await
        .context("component credential grant body could not be read")?
    {
        anyhow::ensure!(
            secret.len().saturating_add(chunk.len()) <= MAX_COMPONENT_CREDENTIAL_BYTES,
            "component credential grant exceeds the size limit"
        );
        secret.extend_from_slice(&chunk);
    }
    anyhow::ensure!(!secret.is_empty(), "component credential grant is empty");
    Ok(secret)
}

/// The runner side of the private fd 3 channel.
///
/// Keep this value until the component completes its verified hello handshake.
/// Then call `deliver` once. Dropping it closes the channel without sending data.
pub struct ComponentCredentialChannel {
    writer: tokio::fs::File,
}

impl ComponentCredentialChannel {
    pub async fn deliver(mut self, secret: Zeroizing<Vec<u8>>) -> anyhow::Result<()> {
        self.writer
            .write_all(secret.as_slice())
            .await
            .context("component credential channel closed before delivery")?;
        self.writer
            .shutdown()
            .await
            .context("component credential channel could not be closed")
    }
}

/// Spawn one verified component with an empty private fd 3 channel.
///
/// This helper does not build the command. The caller must apply the component
/// identity, argument, environment, directory, and standard-stream rules first.
pub fn spawn_component_with_credential_channel(
    command: &mut tokio::process::Command,
) -> anyhow::Result<(tokio::process::Child, ComponentCredentialChannel)> {
    let (reader, writer) = credential_pipe()?;
    let reader_fd = reader.as_raw_fd();

    // SAFETY: The closure calls only async-signal-safe descriptor operations.
    // `reader` stays open in the parent until spawn returns. The child replaces
    // only reserved fd 3 and closes the original duplicate before exec.
    unsafe {
        command.pre_exec(move || prepare_child_credential_fd(reader_fd));
    }
    let child = command
        .spawn()
        .context("component process could not be started")?;
    drop(reader);

    let writer = std::fs::File::from(writer);
    Ok((
        child,
        ComponentCredentialChannel {
            writer: tokio::fs::File::from_std(writer),
        },
    ))
}

fn credential_pipe() -> std::io::Result<(OwnedFd, OwnedFd)> {
    use std::net::Shutdown;
    use std::os::unix::net::UnixStream;

    let (reader, writer) = UnixStream::pair()?;
    reader.shutdown(Shutdown::Write)?;
    writer.shutdown(Shutdown::Read)?;
    Ok((reader.into(), writer.into()))
}

fn prepare_child_credential_fd(reader_fd: i32) -> std::io::Result<()> {
    if reader_fd != COMPONENT_CREDENTIAL_FD {
        // SAFETY: Both values are valid file descriptor numbers in the child.
        if unsafe { libc::dup2(reader_fd, COMPONENT_CREDENTIAL_FD) } == -1 {
            return Err(std::io::Error::last_os_error());
        }
        // SAFETY: The duplicated source descriptor is no longer needed.
        unsafe {
            libc::close(reader_fd);
        }
        return Ok(());
    }

    // dup2 clears close-on-exec. Clear it directly when pipe2 returned fd 3.
    // SAFETY: fd 3 is the valid pipe descriptor in this branch.
    let flags = unsafe { libc::fcntl(COMPONENT_CREDENTIAL_FD, libc::F_GETFD) };
    if flags == -1 {
        return Err(std::io::Error::last_os_error());
    }
    // SAFETY: fd 3 is valid and `flags` came from F_GETFD.
    if unsafe {
        libc::fcntl(
            COMPONENT_CREDENTIAL_FD,
            libc::F_SETFD,
            flags & !libc::FD_CLOEXEC,
        )
    } == -1
    {
        return Err(std::io::Error::last_os_error());
    }
    Ok(())
}
