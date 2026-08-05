use std::future::Future;
use std::os::fd::{AsRawFd, OwnedFd};
use std::time::Duration;

use anyhow::Context;
use oore_contract::ConsumeComponentCredentialGrantRequest;
use zeroize::Zeroizing;

use crate::{RunnerConfig, require_safe_daemon_url};

const COMPONENT_CREDENTIAL_FD: i32 = 3;
const COMPONENT_CREDENTIAL_GRANT_HEADER: &str = "x-oore-component-credential-grant";
const COMPONENT_CREDENTIAL_CONTENT_TYPE: &str = "application/octet-stream";
const MAX_COMPONENT_CREDENTIAL_BYTES: usize = 8 * 1024 * 1024;
const COMPONENT_CREDENTIAL_REQUEST_TIMEOUT: Duration = Duration::from_secs(15);
const COMPONENT_CREDENTIAL_DELIVERY_TIMEOUT: Duration = Duration::from_secs(15);
const COMPONENT_CREDENTIAL_MAGIC: &[u8; 16] = b"OORE-FD3-CRED-1\n";
const COMPONENT_CREDENTIAL_HEADER_BYTES: usize = 16 + 32 + 8;

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

/// Public SHA-256 binding for the exact credential reference sent in `Start`.
pub struct ComponentCredentialBinding([u8; 32]);

impl ComponentCredentialBinding {
    /// Parses the fixed lowercase `sha256:` binding returned by the component protocol.
    pub fn new(value: &str) -> anyhow::Result<Self> {
        let value = value
            .strip_prefix("sha256:")
            .context("component credential binding is invalid")?;
        anyhow::ensure!(value.len() == 64, "component credential binding is invalid");
        let mut digest = [0_u8; 32];
        for (index, pair) in value.as_bytes().chunks_exact(2).enumerate() {
            digest[index] = decode_hex(pair[0])
                .context("component credential binding is invalid")?
                .checked_mul(16)
                .and_then(|high| decode_hex(pair[1]).map(|low| high + low))
                .context("component credential binding is invalid")?;
        }
        Ok(Self(digest))
    }
}

/// Redeem one exact grant. This request is never retried because redemption is one-use.
pub async fn consume_component_credential_grant(
    config: &RunnerConfig,
    request: &ConsumeComponentCredentialGrantRequest,
    handle: &ComponentCredentialGrantHandle,
) -> anyhow::Result<Zeroizing<Vec<u8>>> {
    require_safe_daemon_url(&config.daemon_url)?;
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .retry(reqwest::retry::never())
        .no_proxy()
        .build()
        .context("component credential client could not be created")?;
    let mut grant_header = reqwest::header::HeaderValue::from_str(handle.as_str())
        .context("component credential grant handle could not be encoded")?;
    grant_header.set_sensitive(true);
    let response = client
        .post(format!(
            "{}/v1/runners/{}/component-credentials/consume",
            config.daemon_url.trim_end_matches('/'),
            config.runner_id
        ))
        .bearer_auth(&config.runner_token)
        .header(COMPONENT_CREDENTIAL_GRANT_HEADER, grant_header)
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
    writer: tokio::io::unix::AsyncFd<OwnedFd>,
}

impl ComponentCredentialChannel {
    /// Sends one reference-bound credential after the verified `Start` frame.
    ///
    /// The current channel version accepts exactly one credential reference.
    /// Delivery stops on cancellation, peer closure, or the fixed timeout.
    pub async fn deliver<C>(
        self,
        binding: ComponentCredentialBinding,
        secret: Zeroizing<Vec<u8>>,
        cancelled: C,
    ) -> anyhow::Result<()>
    where
        C: Future<Output = ()>,
    {
        anyhow::ensure!(
            !secret.is_empty() && secret.len() <= MAX_COMPONENT_CREDENTIAL_BYTES,
            "component credential size is invalid"
        );
        let length = u64::try_from(secret.len()).context("component credential size is invalid")?;
        let mut header = [0_u8; COMPONENT_CREDENTIAL_HEADER_BYTES];
        header[..16].copy_from_slice(COMPONENT_CREDENTIAL_MAGIC);
        header[16..48].copy_from_slice(&binding.0);
        header[48..56].copy_from_slice(&length.to_be_bytes());
        let delivery = async {
            write_all_nonblocking(&self.writer, &header)
                .await
                .context("component credential channel closed before delivery")?;
            write_all_nonblocking(&self.writer, secret.as_slice())
                .await
                .context("component credential channel closed before delivery")
        };
        tokio::select! {
            result = tokio::time::timeout(COMPONENT_CREDENTIAL_DELIVERY_TIMEOUT, delivery) => {
                result.context("component credential delivery timed out")?
            }
            () = cancelled => anyhow::bail!("component credential delivery was cancelled"),
        }
    }
}

async fn write_all_nonblocking(
    writer: &tokio::io::unix::AsyncFd<OwnedFd>,
    mut bytes: &[u8],
) -> std::io::Result<()> {
    while !bytes.is_empty() {
        let mut ready = writer.writable().await?;
        match ready.try_io(|descriptor| {
            rustix::io::write(descriptor.get_ref(), bytes).map_err(std::io::Error::from)
        }) {
            Ok(Ok(0)) => return Err(std::io::ErrorKind::WriteZero.into()),
            Ok(Ok(written)) => bytes = &bytes[written..],
            Ok(Err(error)) => return Err(error),
            Err(_would_block) => {}
        }
    }
    Ok(())
}

const fn decode_hex(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        _ => None,
    }
}

/// Spawn one prepared command with an empty private fd 3 channel.
///
/// This helper does not verify the component or its hello response. The caller
/// must apply all command rules first and must not call `deliver` before a
/// separate component invoker accepts the exact hello response.
pub fn spawn_command_with_credential_channel(
    command: &mut tokio::process::Command,
) -> anyhow::Result<(tokio::process::Child, ComponentCredentialChannel)> {
    let (reader, writer) = credential_pipe()?;
    let writer = tokio::io::unix::AsyncFd::new(writer)
        .context("component credential channel could not be registered")?;
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
    Ok((child, ComponentCredentialChannel { writer }))
}

fn credential_pipe() -> std::io::Result<(OwnedFd, OwnedFd)> {
    #[cfg(target_os = "linux")]
    {
        let (reader, writer) = rustix::pipe::pipe_with(rustix::pipe::PipeFlags::CLOEXEC)
            .map_err(std::io::Error::from)?;
        let flags = rustix::fs::fcntl_getfl(&writer).map_err(std::io::Error::from)?;
        rustix::fs::fcntl_setfl(&writer, flags | rustix::fs::OFlags::NONBLOCK)
            .map_err(std::io::Error::from)?;
        return Ok((reader, writer));
    }

    #[cfg(target_os = "macos")]
    {
        use std::net::Shutdown;
        use std::os::unix::net::UnixStream;

        let (reader, writer) = UnixStream::pair()?;
        reader.shutdown(Shutdown::Write)?;
        writer.shutdown(Shutdown::Read)?;
        writer.set_nonblocking(true)?;
        Ok((reader.into(), writer.into()))
    }
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
