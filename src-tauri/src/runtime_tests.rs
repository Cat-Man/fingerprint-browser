use std::path::PathBuf;

use crate::runtime::{
  launch_runtime_process, refresh_runtime_handle, resolve_browser_binary_from_candidates,
  LaunchPlan, LaunchRuntimeRequest, RuntimeHealthSnapshot, RuntimeLogEntry,
};

#[test]
fn resolves_installed_chromium_family_browser() {
  let path = resolve_browser_binary_from_candidates(
    "Chromium",
    &[
      PathBuf::from("/tmp/does-not-exist"),
      PathBuf::from("/Applications/Chromium.app/Contents/MacOS/Chromium"),
      PathBuf::from("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    ],
  )
  .unwrap();

  let resolved = path.to_string_lossy();
  assert!(resolved.ends_with("Chromium") || resolved.ends_with("Google Chrome"));
}

#[test]
fn builds_runtime_handle_from_launch_request() {
  let request = LaunchRuntimeRequest {
    profile_id: "profile-a".to_string(),
    profile_name: "Profile A".to_string(),
    browser_engine: "Chromium".to_string(),
    debug_port: 9333,
    launch_plan: LaunchPlan {
      adapter_id: "chromium".to_string(),
      launch_args: vec!["--remote-debugging-port=9333".to_string()],
      env: Default::default(),
    },
  };

  let handle = launch_runtime_process(&request).unwrap();

  assert_eq!(handle.profile_id, "profile-a");
  assert_eq!(handle.debug_port, 9333);
  assert_eq!(handle.status, "running");
  assert!(handle.logs[0].message.contains("Chromium runtime"));
  assert_eq!(handle.health.status, "healthy");
}

#[test]
fn marks_runtime_handle_healthy_when_process_and_cdp_are_available() {
  let handle = launch_runtime_process(&LaunchRuntimeRequest {
    profile_id: "profile-a".to_string(),
    profile_name: "Profile A".to_string(),
    browser_engine: "Chromium".to_string(),
    debug_port: 9333,
    launch_plan: LaunchPlan {
      adapter_id: "chromium".to_string(),
      launch_args: vec!["--remote-debugging-port=9333".to_string()],
      env: Default::default(),
    },
  })
  .unwrap();

  let refreshed = refresh_runtime_handle(
    handle,
    true,
    Ok("ws://127.0.0.1:9333/devtools/browser/next".to_string()),
    "2026-03-25T10:00:00.000Z".to_string(),
  );

  assert_eq!(
    refreshed.health,
    RuntimeHealthSnapshot {
      status: "healthy",
      checked_at: "2026-03-25T10:00:00.000Z".to_string(),
      message: "Native runtime is reachable".to_string(),
    }
  );
  assert_eq!(
    refreshed.ws_endpoint,
    "ws://127.0.0.1:9333/devtools/browser/next".to_string()
  );
}

#[test]
fn marks_runtime_handle_degraded_when_cdp_is_unreachable_and_appends_a_log() {
  let mut handle = launch_runtime_process(&LaunchRuntimeRequest {
    profile_id: "profile-a".to_string(),
    profile_name: "Profile A".to_string(),
    browser_engine: "Chromium".to_string(),
    debug_port: 9333,
    launch_plan: LaunchPlan {
      adapter_id: "chromium".to_string(),
      launch_args: vec!["--remote-debugging-port=9333".to_string()],
      env: Default::default(),
    },
  })
  .unwrap();
  handle.logs.push(RuntimeLogEntry {
    at: "2026-03-25T09:59:00.000Z".to_string(),
    level: "info",
    message: "Existing log".to_string(),
  });

  let refreshed = refresh_runtime_handle(
    handle,
    true,
    Err("failed to connect to CDP port".to_string()),
    "2026-03-25T10:00:00.000Z".to_string(),
  );

  assert_eq!(refreshed.health.status, "degraded");
  assert!(refreshed.health.message.contains("CDP endpoint is unreachable"));
  assert_eq!(refreshed.logs.len(), 3);
  assert!(
    refreshed.logs.last().unwrap().message.contains("Runtime health check: degraded")
  );
}
