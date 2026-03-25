use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
  collections::HashMap,
  io::{Read, Write},
  net::TcpStream,
  path::{Path, PathBuf},
  process::{Child, Command, Stdio},
  sync::Mutex,
  thread,
  time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

const CDP_HOST: &str = "127.0.0.1";
const CDP_POLL_INTERVAL: Duration = Duration::from_millis(250);
const CDP_READY_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchRuntimeRequest {
  pub profile_id: String,
  pub profile_name: String,
  pub browser_engine: String,
  pub debug_port: u16,
  pub launch_plan: LaunchPlan,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchPlan {
  pub adapter_id: String,
  pub launch_args: Vec<String>,
  #[serde(default)]
  pub env: HashMap<String, String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StopRuntimeRequest {
  pub profile_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshRuntimeHealthRequest {
  pub profile_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeLogEntry {
  pub at: String,
  pub level: &'static str,
  pub message: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeHealthSnapshot {
  pub status: &'static str,
  pub checked_at: String,
  pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeProcessHandle {
  pub id: String,
  pub profile_id: String,
  pub profile_name: String,
  pub status: &'static str,
  pub debug_port: u16,
  pub ws_endpoint: String,
  pub started_at: String,
  pub updated_at: String,
  pub process_id: Option<u32>,
  pub last_error: Option<String>,
  pub logs: Vec<RuntimeLogEntry>,
  pub health: RuntimeHealthSnapshot,
}

#[derive(Default)]
pub struct RuntimeRegistry {
  processes: Mutex<HashMap<String, ManagedRuntime>>,
}

struct ManagedRuntime {
  child: Child,
  handle: RuntimeProcessHandle,
}

#[tauri::command]
pub fn launch_runtime(
  request: LaunchRuntimeRequest,
  state: tauri::State<'_, RuntimeRegistry>,
) -> Result<RuntimeProcessHandle, String> {
  let mut processes = state
    .processes
    .lock()
    .map_err(|_| "failed to lock runtime registry".to_string())?;

  if let Some(existing) = processes.get(&request.profile_id) {
    if existing.handle.status == "running" {
      return Err(format!("Profile {} is already running", request.profile_name));
    }
  }

  let handle = launch_runtime_process(&request)?;
  let browser_path = resolve_browser_binary(&request.browser_engine)?;
  let child = spawn_browser_process(&browser_path, &request)?;
  let ws_endpoint = wait_for_cdp_ws_endpoint(request.debug_port)?;
  let started_handle = RuntimeProcessHandle {
    ws_endpoint,
    process_id: Some(child.id()),
    ..handle
  };

  processes.insert(
    request.profile_id.clone(),
    ManagedRuntime {
      child,
      handle: started_handle.clone(),
    },
  );

  Ok(started_handle)
}

#[tauri::command]
pub fn stop_runtime(
  request: StopRuntimeRequest,
  state: tauri::State<'_, RuntimeRegistry>,
) -> Result<RuntimeProcessHandle, String> {
  let mut processes = state
    .processes
    .lock()
    .map_err(|_| "failed to lock runtime registry".to_string())?;
  let mut managed = processes
    .remove(&request.profile_id)
    .ok_or_else(|| format!("Profile {} does not have a runtime instance", request.profile_id))?;

  stop_child(&mut managed.child)?;

  let timestamp = iso_timestamp();
  managed.handle.status = "stopped";
  managed.handle.ws_endpoint = String::new();
  managed.handle.updated_at = timestamp.clone();
  managed.handle.logs.push(RuntimeLogEntry {
    at: timestamp,
    level: "info",
    message: "Stopped native runtime and released profile lock".to_string(),
  });

  Ok(managed.handle)
}

#[tauri::command]
pub fn restart_runtime(
  request: LaunchRuntimeRequest,
  state: tauri::State<'_, RuntimeRegistry>,
) -> Result<RuntimeProcessHandle, String> {
  {
    let mut processes = state
      .processes
      .lock()
      .map_err(|_| "failed to lock runtime registry".to_string())?;

    if let Some(mut managed) = processes.remove(&request.profile_id) {
      stop_child(&mut managed.child)?;
    }
  }

  launch_runtime(request, state)
}

#[tauri::command]
pub fn refresh_runtime_health(
  request: RefreshRuntimeHealthRequest,
  state: tauri::State<'_, RuntimeRegistry>,
) -> Result<RuntimeProcessHandle, String> {
  let mut processes = state
    .processes
    .lock()
    .map_err(|_| "failed to lock runtime registry".to_string())?;
  let managed = processes
    .get_mut(&request.profile_id)
    .ok_or_else(|| format!("Profile {} does not have a runtime instance", request.profile_id))?;

  let checked_at = iso_timestamp();
  let process_running = child_is_running(&mut managed.child)?;
  let cdp_result = if process_running {
    fetch_cdp_ws_endpoint(managed.handle.debug_port)
  } else {
    Err("native runtime process is not running".to_string())
  };
  let refreshed =
    refresh_runtime_handle(managed.handle.clone(), process_running, cdp_result, checked_at);

  managed.handle = refreshed.clone();

  Ok(refreshed)
}

pub(crate) fn launch_runtime_process(
  request: &LaunchRuntimeRequest,
) -> Result<RuntimeProcessHandle, String> {
  let checked_at = iso_timestamp();

  Ok(RuntimeProcessHandle {
    id: request.profile_id.clone(),
    profile_id: request.profile_id.clone(),
    profile_name: request.profile_name.clone(),
    status: "running",
    debug_port: request.debug_port,
    ws_endpoint: String::new(),
    started_at: iso_timestamp(),
    updated_at: iso_timestamp(),
    process_id: None,
    last_error: None,
    logs: vec![RuntimeLogEntry {
      at: iso_timestamp(),
      level: "info",
      message: format!(
        "Launched {} runtime via {} adapter",
        request.browser_engine, request.launch_plan.adapter_id
      ),
    }],
    health: RuntimeHealthSnapshot {
      status: "healthy",
      checked_at: checked_at.clone(),
      message: "Native runtime is reachable".to_string(),
    },
  })
}

pub(crate) fn refresh_runtime_handle(
  mut handle: RuntimeProcessHandle,
  process_running: bool,
  cdp_result: Result<String, String>,
  checked_at: String,
) -> RuntimeProcessHandle {
  let (status, level, message, ws_endpoint, last_error) = if !process_running {
    let message = "Native runtime process is not running".to_string();
    (
      "degraded",
      "error",
      message.clone(),
      handle.ws_endpoint.clone(),
      Some(message),
    )
  } else {
    match cdp_result {
      Ok(ws_endpoint) => (
        "healthy",
        "info",
        "Native runtime is reachable".to_string(),
        ws_endpoint,
        None,
      ),
      Err(error) => {
        let message = format!("CDP endpoint is unreachable: {error}");
        (
          "degraded",
          "error",
          message.clone(),
          handle.ws_endpoint.clone(),
          Some(message),
        )
      }
    }
  };

  handle.updated_at = checked_at.clone();
  handle.ws_endpoint = ws_endpoint;
  handle.last_error = last_error;
  handle.health = RuntimeHealthSnapshot {
    status,
    checked_at: checked_at.clone(),
    message: message.clone(),
  };
  handle.logs.push(RuntimeLogEntry {
    at: checked_at,
    level,
    message: format!("Runtime health check: {status} - {message}"),
  });

  handle
}

pub(crate) fn resolve_browser_binary(browser_engine: &str) -> Result<PathBuf, String> {
  let candidates = chromium_candidates(browser_engine);
  resolve_browser_binary_from_candidates(browser_engine, &candidates)
}

pub(crate) fn resolve_browser_binary_from_candidates(
  browser_engine: &str,
  candidates: &[PathBuf],
) -> Result<PathBuf, String> {
  candidates
    .iter()
    .find(|path| path.exists())
    .cloned()
    .ok_or_else(|| format!("No supported browser binary found for {}", browser_engine))
}

fn chromium_candidates(_browser_engine: &str) -> Vec<PathBuf> {
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ]
  .into_iter()
  .map(PathBuf::from)
  .collect()
}

fn spawn_browser_process(
  binary: &Path,
  request: &LaunchRuntimeRequest,
) -> Result<Child, String> {
  let mut command = Command::new(binary);
  command
    .args(&request.launch_plan.launch_args)
    .arg("--headless=new")
    .arg("--no-first-run")
    .arg("--disable-background-networking")
    .arg("--disable-renderer-backgrounding")
    .arg("--disable-default-apps")
    .arg("--remote-allow-origins=*")
    .arg("about:blank")
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null());

  for (key, value) in &request.launch_plan.env {
    command.env(key, value);
  }

  command
    .spawn()
    .map_err(|error| format!("failed to spawn browser: {error}"))
}

fn child_is_running(child: &mut Child) -> Result<bool, String> {
  child
    .try_wait()
    .map(|status| status.is_none())
    .map_err(|error| format!("failed to inspect runtime process: {error}"))
}

fn wait_for_cdp_ws_endpoint(debug_port: u16) -> Result<String, String> {
  let deadline = Instant::now() + CDP_READY_TIMEOUT;

  loop {
    if let Ok(endpoint) = fetch_cdp_ws_endpoint(debug_port) {
      return Ok(endpoint);
    }

    if Instant::now() >= deadline {
      return Err(format!(
        "Timed out waiting for CDP endpoint on port {}",
        debug_port
      ));
    }

    thread::sleep(CDP_POLL_INTERVAL);
  }
}

fn fetch_cdp_ws_endpoint(debug_port: u16) -> Result<String, String> {
  let mut stream = TcpStream::connect((CDP_HOST, debug_port))
    .map_err(|error| format!("failed to connect to CDP port: {error}"))?;
  let request = format!(
    "GET /json/version HTTP/1.1\r\nHost: {}:{}\r\nConnection: close\r\n\r\n",
    CDP_HOST, debug_port
  );

  stream
    .write_all(request.as_bytes())
    .map_err(|error| format!("failed to write CDP request: {error}"))?;

  let mut response = String::new();
  stream
    .read_to_string(&mut response)
    .map_err(|error| format!("failed to read CDP response: {error}"))?;

  let body = response
    .split("\r\n\r\n")
    .nth(1)
    .ok_or_else(|| "invalid CDP HTTP response".to_string())?;
  let payload: Value =
    serde_json::from_str(body).map_err(|error| format!("invalid CDP payload: {error}"))?;

  payload["webSocketDebuggerUrl"]
    .as_str()
    .map(ToOwned::to_owned)
    .ok_or_else(|| "CDP endpoint missing webSocketDebuggerUrl".to_string())
}

fn stop_child(child: &mut Child) -> Result<(), String> {
  match child.kill() {
    Ok(()) => {
      let _ = child.wait();
      Ok(())
    }
    Err(error) if error.kind() == std::io::ErrorKind::InvalidInput => Ok(()),
    Err(error) => Err(format!("failed to stop browser process: {error}")),
  }
}

fn iso_timestamp() -> String {
  let seconds = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default()
    .as_secs();

  format!("{seconds}")
}
