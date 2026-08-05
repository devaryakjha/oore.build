use std::collections::VecDeque;
use std::path::{Component, Path, PathBuf};
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::Context as _;
use oore_component_protocol::{
    Body, Correlation, CredentialChannel, CredentialReference, Direction, ExitClass, Frame,
    FrameType, HARD_MAX_STDERR_BYTES, JobBinding, JsonlDecoder, PROTOCOL_WIRE, ProtocolLimits,
    ProtocolStateMachine, SessionConfig, SessionPhase, build_machine_argv, encode_line,
};
use oore_contract::ConsumeComponentCredentialGrantRequest;
use tokio::io::{AsyncReadExt as _, AsyncWriteExt as _};

use crate::{
    ComponentCredentialBinding, ComponentCredentialGrantHandle, RunnerConfig,
    consume_component_credential_grant, spawn_command_with_credential_channel,
};

const COMPONENT_EXIT_TIMEOUT: Duration = Duration::from_secs(15);
const COMPONENT_FRAME_TIMEOUT: Duration = Duration::from_secs(120);
const COMPONENT_CANCEL_GRACE: Duration = Duration::from_secs(5);
const READ_CHUNK_BYTES: usize = 8 * 1024;

/// A reusable cancellation signal for one managed component invocation.
#[derive(Clone, Default)]
pub struct ComponentCancellation {
    inner: Arc<ComponentCancellationInner>,
}

#[derive(Default)]
struct ComponentCancellationInner {
    cancelled: AtomicBool,
    notify: tokio::sync::Notify,
}

#[derive(Clone, Default)]
struct ComponentStderrMonitor {
    inner: Arc<ComponentStderrMonitorInner>,
}

#[derive(Default)]
struct ComponentStderrMonitorInner {
    exceeded: AtomicBool,
    notify: tokio::sync::Notify,
}

impl ComponentStderrMonitor {
    fn mark_exceeded(&self) {
        if !self.inner.exceeded.swap(true, Ordering::AcqRel) {
            self.inner.notify.notify_waiters();
        }
    }

    async fn exceeded(&self) {
        loop {
            let notified = self.inner.notify.notified();
            if self.inner.exceeded.load(Ordering::Acquire) {
                return;
            }
            notified.await;
        }
    }
}

impl ComponentCancellation {
    /// Requests cancellation. Repeated calls have no extra effect.
    pub fn cancel(&self) {
        if !self.inner.cancelled.swap(true, Ordering::AcqRel) {
            self.inner.notify.notify_waiters();
        }
    }

    /// Waits until cancellation is requested.
    pub async fn cancelled(&self) {
        loop {
            let notified = self.inner.notify.notified();
            if self.inner.cancelled.load(Ordering::Acquire) {
                return;
            }
            notified.await;
        }
    }
}

/// Exact public facts needed to start one already verified component binary.
pub struct ManagedComponentInvocation {
    executable: PathBuf,
    workspace: PathBuf,
    identity: oore_component_protocol::ComponentIdentity,
    job: JobBinding,
    operation_id: String,
    capability_id: String,
    payload_schema: String,
    public_input: Vec<u8>,
    credential_ref_id: String,
    credential_expires_at: u64,
    grant_request: ConsumeComponentCredentialGrantRequest,
    grant_handle: ComponentCredentialGrantHandle,
}

impl ManagedComponentInvocation {
    /// Creates one launch request from catalog-verified public facts.
    ///
    /// This constructor validates bindings. Catalog and executable signature
    /// verification remain the caller's responsibility until the component
    /// store lands.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        executable: PathBuf,
        workspace: PathBuf,
        identity: oore_component_protocol::ComponentIdentity,
        job: JobBinding,
        operation_id: String,
        capability_id: String,
        payload_schema: String,
        public_input: Vec<u8>,
        credential_ref_id: String,
        credential_expires_at: u64,
        grant_request: ConsumeComponentCredentialGrantRequest,
        grant_handle: ComponentCredentialGrantHandle,
    ) -> anyhow::Result<Self> {
        identity
            .validate()
            .context("component identity is invalid")?;
        job.validate().context("component job binding is invalid")?;
        anyhow::ensure!(
            valid_absolute_path(&executable),
            "component executable path is invalid"
        );
        anyhow::ensure!(
            valid_absolute_path(&workspace),
            "component workspace path is invalid"
        );
        anyhow::ensure!(!public_input.is_empty(), "component input is empty");
        anyhow::ensure!(
            grant_request.operation_id == operation_id
                && grant_request.component_identity_digest == identity.identity_digest
                && grant_request.capability_id == capability_id
                && grant_request.job_lock_digest == job.job_lock_digest
                && component_fencing_token_digest(grant_request.fencing_token).as_deref()
                    == Some(job.fencing_token_digest.as_str()),
            "component credential grant binding is invalid"
        );
        anyhow::ensure!(
            credential_expires_at > now_unix_seconds(),
            "component credential reference is expired"
        );
        Ok(Self {
            executable,
            workspace,
            identity,
            job,
            operation_id,
            capability_id,
            payload_schema,
            public_input,
            credential_ref_id,
            credential_expires_at,
            grant_request,
            grant_handle,
        })
    }
}

/// Runs one managed, one-shot component and returns its verified public result.
pub async fn invoke_managed_component(
    runner: &RunnerConfig,
    invocation: ManagedComponentInvocation,
    cancellation: ComponentCancellation,
) -> anyhow::Result<Vec<u8>> {
    let session_id = random_public_id("component-session");
    let request_id = random_public_id("component-request");
    let correlation = Correlation::managed(
        &session_id,
        &request_id,
        invocation.operation_id.clone(),
        invocation.identity.clone(),
        invocation.job.clone(),
    )
    .context("component correlation is invalid")?;
    let config = SessionConfig::one_shot(invocation.identity.clone(), correlation.clone())
        .with_credential_channel(CredentialChannel::BrokerFd3)
        .with_broker_fd3(true);
    let mut state = ProtocolStateMachine::new_bound(config, &session_id, &request_id)
        .context("component session binding is invalid")?;
    state.expect_capabilities([invocation.capability_id.clone()]);

    let input = oore_component_runtime::write_input_artifact(
        &invocation.workspace,
        &invocation.public_input,
    )
    .context("component input could not be prepared")?;
    let argv = build_machine_argv(&invocation.executable, false)
        .context("component command is invalid")?;
    let mut command = tokio::process::Command::new(&invocation.executable);
    command
        .args(&argv[1..])
        .current_dir(&invocation.workspace)
        .env_clear()
        .env("LANG", "C")
        .env("LC_ALL", "C")
        .env("TZ", "UTC")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);
    let (mut child, credential_channel) = spawn_command_with_credential_channel(&mut command)?;
    let mut stdin = child
        .stdin
        .take()
        .context("component stdin is unavailable")?;
    let stdout = child
        .stdout
        .take()
        .context("component stdout is unavailable")?;
    let stderr = child
        .stderr
        .take()
        .context("component stderr is unavailable")?;
    let stderr_monitor = ComponentStderrMonitor::default();
    let stderr_task = tokio::spawn(drain_component_stderr(stderr, stderr_monitor.clone()));
    let mut reader = ComponentFrameReader::new(stdout);

    let result = run_session(
        runner,
        &invocation,
        &cancellation,
        &stderr_monitor,
        &mut state,
        &correlation,
        &session_id,
        &request_id,
        input.digest(),
        &mut stdin,
        &mut reader,
        credential_channel,
    )
    .await;

    if result.is_err() && state.phase() != SessionPhase::Terminal {
        let _ = child.kill().await;
    }
    drop(stdin);
    let stdout_task = tokio::spawn(async move { reader.finish_after_terminal().await });
    let status = match tokio::time::timeout(COMPONENT_EXIT_TIMEOUT, child.wait()).await {
        Ok(status) => status.context("component exit could not be observed"),
        Err(_) => {
            let _ = child.kill().await;
            let _ = child.wait().await;
            Err(anyhow::anyhow!("component exit timed out"))
        }
    };
    let stdout_result = join_component_task(stdout_task, "component stdout drain").await;
    let stderr_result = join_component_task(stderr_task, "component stderr drain").await;
    let status = status?;
    stdout_result?;
    let stderr_bytes = stderr_result?;
    anyhow::ensure!(
        stderr_bytes <= HARD_MAX_STDERR_BYTES,
        "component stderr exceeded the size limit"
    );
    let (result_digest, exit_class) = result?;
    state
        .verify_process_exit(exit_class, status.code())
        .context("component exit did not match its result")?;
    state
        .clean_eof()
        .context("component ended without a result")?;
    oore_component_runtime::read_result_artifact(&invocation.workspace, &result_digest)
        .context("component result could not be verified")
}

#[allow(clippy::too_many_arguments, clippy::too_many_lines)]
async fn run_session(
    runner: &RunnerConfig,
    invocation: &ManagedComponentInvocation,
    cancellation: &ComponentCancellation,
    stderr_monitor: &ComponentStderrMonitor,
    state: &mut ProtocolStateMachine,
    correlation: &Correlation,
    session_id: &str,
    request_id: &str,
    input_digest: &str,
    stdin: &mut tokio::process::ChildStdin,
    reader: &mut ComponentFrameReader,
    credential_channel: crate::ComponentCredentialChannel,
) -> anyhow::Result<(String, ExitClass)> {
    let hello = Frame {
        wire: PROTOCOL_WIRE.into(),
        frame_type: FrameType::Request,
        schema_version: 1,
        message_id: "manager-hello-0".into(),
        session_id: session_id.into(),
        request_id: request_id.into(),
        seq: 0,
        reply_to: None,
        correlation: correlation.clone(),
        body: Body::Hello {
            supported_protocols: vec![oore_component_protocol::ProtocolRange::current()],
            expected_identity_digest: invocation.identity.identity_digest.clone(),
            limits: ProtocolLimits::default(),
            service: false,
            credential_channel: CredentialChannel::BrokerFd3,
        },
    };
    send_manager_frame(state, stdin, &hello).await?;
    let hello_ack = next_frame(reader, cancellation, stderr_monitor).await?;
    state
        .accept(Direction::ComponentToManager, &hello_ack)
        .context("component hello response was rejected")?;
    let capability = state
        .capability(&invocation.capability_id)
        .context("component capability is unavailable")?;
    anyhow::ensure!(
        capability.gate_ids.is_empty(),
        "component capability requires a gate"
    );
    anyhow::ensure!(
        capability.credential_requirements.len() == 1,
        "component credential contract is unsupported"
    );
    let requirement = capability.credential_requirements[0].clone();
    let selected_correlation = correlation
        .with_capability(session_id, request_id, invocation.capability_id.clone())
        .context("component capability binding is invalid")?;
    let start = Frame {
        wire: PROTOCOL_WIRE.into(),
        frame_type: FrameType::Request,
        schema_version: 1,
        message_id: "manager-start-1".into(),
        session_id: session_id.into(),
        request_id: request_id.into(),
        seq: 1,
        reply_to: None,
        correlation: selected_correlation,
        body: Body::Start {
            capability_id: invocation.capability_id.clone(),
            payload_schema: invocation.payload_schema.clone(),
            payload_inline: None,
            payload_ref: Some(input_digest.into()),
            plan_hash: invocation.job.plan_hash.clone(),
            gate_outcomes: Vec::new(),
            credential_refs: vec![CredentialReference {
                ref_id: invocation.credential_ref_id.clone(),
                purpose: requirement.purpose,
                capability_id: Some(invocation.capability_id.clone()),
                request_binding: requirement.request_binding,
                one_use: true,
                expires_at: invocation.credential_expires_at,
            }],
        },
    };
    send_manager_frame(state, stdin, &start).await?;

    let secret = tokio::select! {
        biased;
        () = cancellation.cancelled() => {
            return cancel_session(state, stdin, reader, &start).await;
        }
        () = stderr_monitor.exceeded() => anyhow::bail!("component stderr exceeded the size limit"),
        result = consume_component_credential_grant(
            runner,
            &invocation.grant_request,
            &invocation.grant_handle,
        ) => result?,
    };
    let delivery_digest = oore_component_runtime::broker_credential_delivery_digest(&start)
        .context("component credential delivery binding is invalid")?;
    if credential_channel
        .deliver(
            ComponentCredentialBinding::new(&delivery_digest)?,
            secret,
            async {
                tokio::select! {
                    () = cancellation.cancelled() => {}
                    () = stderr_monitor.exceeded() => {}
                }
            },
        )
        .await
        .is_err()
    {
        if cancellation.inner.cancelled.load(Ordering::Acquire) {
            return cancel_session(state, stdin, reader, &start).await;
        }
        if stderr_monitor.inner.exceeded.load(Ordering::Acquire) {
            anyhow::bail!("component stderr exceeded the size limit");
        }
        anyhow::bail!("component credential delivery failed");
    }

    loop {
        let frame = tokio::select! {
            () = cancellation.cancelled() => {
                return cancel_session(state, stdin, reader, &start).await;
            }
            () = stderr_monitor.exceeded() => anyhow::bail!("component stderr exceeded the size limit"),
            result = tokio::time::timeout(COMPONENT_FRAME_TIMEOUT, reader.next()) => {
                result.context("component response timed out")??
                    .context("component ended before a result")?
            }
        };
        state
            .accept(Direction::ComponentToManager, &frame)
            .context("component response was rejected")?;
        match frame.body {
            Body::Completed {
                output_digest: Some(output_digest),
                exit_class,
                ..
            } => return Ok((output_digest, exit_class)),
            Body::Completed { .. } => anyhow::bail!("component completed without a result"),
            Body::Stopped { .. } | Body::Error { .. } => {
                anyhow::bail!("component did not complete the operation")
            }
            _ => {}
        }
    }
}

async fn cancel_session(
    state: &mut ProtocolStateMachine,
    stdin: &mut tokio::process::ChildStdin,
    reader: &mut ComponentFrameReader,
    start: &Frame,
) -> anyhow::Result<(String, ExitClass)> {
    let cancel_id = "manager-cancel-2";
    let cancel = Frame {
        wire: PROTOCOL_WIRE.into(),
        frame_type: FrameType::Cancel,
        schema_version: 1,
        message_id: cancel_id.into(),
        session_id: start.session_id.clone(),
        request_id: start.request_id.clone(),
        seq: 2,
        reply_to: None,
        correlation: start.correlation.clone(),
        body: Body::Cancel {
            cancel_id: cancel_id.into(),
            reason: oore_component_protocol::CancelReason::Operator,
            grace_ms: u32::try_from(COMPONENT_CANCEL_GRACE.as_millis())
                .expect("fixed cancellation grace fits u32"),
        },
    };
    send_manager_frame(state, stdin, &cancel).await?;
    let deadline = tokio::time::Instant::now() + COMPONENT_CANCEL_GRACE;
    loop {
        let frame = tokio::time::timeout_at(deadline, reader.next())
            .await
            .context("component cancellation grace expired")??
            .context("component ended before cancellation completed")?;
        state
            .accept(Direction::ComponentToManager, &frame)
            .context("component cancellation response was rejected")?;
        if frame.body.is_terminal() {
            anyhow::bail!("component invocation was cancelled");
        }
    }
}

async fn send_manager_frame(
    state: &mut ProtocolStateMachine,
    stdin: &mut tokio::process::ChildStdin,
    frame: &Frame,
) -> anyhow::Result<()> {
    state
        .accept(Direction::ManagerToComponent, frame)
        .context("component request was rejected")?;
    let line = encode_line(frame).context("component request could not be encoded")?;
    stdin
        .write_all(&line)
        .await
        .context("component request could not be written")?;
    stdin
        .flush()
        .await
        .context("component request could not be flushed")
}

async fn next_frame(
    reader: &mut ComponentFrameReader,
    cancellation: &ComponentCancellation,
    stderr_monitor: &ComponentStderrMonitor,
) -> anyhow::Result<Frame> {
    tokio::select! {
        biased;
        () = cancellation.cancelled() => anyhow::bail!("component invocation was cancelled"),
        () = stderr_monitor.exceeded() => anyhow::bail!("component stderr exceeded the size limit"),
        result = tokio::time::timeout(COMPONENT_FRAME_TIMEOUT, reader.next()) => {
            result.context("component response timed out")??
                .context("component ended before a result")
        }
    }
}

struct ComponentFrameReader {
    stdout: tokio::process::ChildStdout,
    decoder: JsonlDecoder,
    pending: VecDeque<Frame>,
}

impl ComponentFrameReader {
    fn new(stdout: tokio::process::ChildStdout) -> Self {
        Self {
            stdout,
            decoder: JsonlDecoder::new(),
            pending: VecDeque::new(),
        }
    }

    async fn next(&mut self) -> anyhow::Result<Option<Frame>> {
        if let Some(frame) = self.pending.pop_front() {
            return Ok(Some(frame));
        }
        let mut chunk = [0_u8; READ_CHUNK_BYTES];
        loop {
            let read = self
                .stdout
                .read(&mut chunk)
                .await
                .context("component output could not be read")?;
            if read == 0 {
                self.decoder
                    .finish()
                    .context("component output ended with a partial frame")?;
                return Ok(None);
            }
            self.pending.extend(
                self.decoder
                    .push(&chunk[..read])
                    .context("component output was invalid")?,
            );
            if let Some(frame) = self.pending.pop_front() {
                return Ok(Some(frame));
            }
        }
    }

    async fn finish_after_terminal(&mut self) -> anyhow::Result<()> {
        anyhow::ensure!(
            self.pending.is_empty(),
            "component wrote a frame after its terminal result"
        );
        let mut chunk = [0_u8; READ_CHUNK_BYTES];
        loop {
            let read = self
                .stdout
                .read(&mut chunk)
                .await
                .context("component output could not be drained")?;
            if read == 0 {
                return self
                    .decoder
                    .finish()
                    .context("component output ended with a partial frame");
            }
            anyhow::ensure!(
                self.decoder
                    .push(&chunk[..read])
                    .context("component trailing output was invalid")?
                    .is_empty(),
                "component wrote a frame after its terminal result"
            );
        }
    }
}

async fn join_component_task<T>(
    mut task: tokio::task::JoinHandle<anyhow::Result<T>>,
    label: &'static str,
) -> anyhow::Result<T> {
    match tokio::time::timeout(COMPONENT_EXIT_TIMEOUT, &mut task).await {
        Ok(result) => result.context(format!("{label} task failed"))?,
        Err(_) => {
            task.abort();
            let _ = task.await;
            anyhow::bail!("{label} timed out");
        }
    }
}

async fn drain_component_stderr(
    mut stderr: tokio::process::ChildStderr,
    monitor: ComponentStderrMonitor,
) -> anyhow::Result<u64> {
    let mut total = 0_u64;
    let mut chunk = [0_u8; READ_CHUNK_BYTES];
    loop {
        let read = stderr
            .read(&mut chunk)
            .await
            .context("component stderr could not be drained")?;
        if read == 0 {
            return Ok(total);
        }
        total = total.saturating_add(u64::try_from(read).unwrap_or(u64::MAX));
        if total > HARD_MAX_STDERR_BYTES {
            monitor.mark_exceeded();
        }
    }
}

fn random_public_id(prefix: &str) -> String {
    use rand::RngCore as _;

    let mut random = [0_u8; 16];
    rand::thread_rng().fill_bytes(&mut random);
    format!("{prefix}-{}", hex::encode(random))
}

fn valid_absolute_path(path: &Path) -> bool {
    path.is_absolute()
        && !path
            .components()
            .any(|part| matches!(part, Component::CurDir | Component::ParentDir))
}

fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Returns the public commitment used for one positive D03 fencing token.
#[must_use]
pub fn component_fencing_token_digest(fencing_token: i64) -> Option<String> {
    (fencing_token > 0).then(|| oore_component_protocol::digest_bytes(&fencing_token.to_be_bytes()))
}
