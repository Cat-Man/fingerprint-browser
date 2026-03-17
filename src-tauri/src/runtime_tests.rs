use std::path::PathBuf;

use crate::runtime::{
  launch_runtime_process, resolve_browser_binary_from_candidates, LaunchPlan,
  LaunchRuntimeRequest,
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
}
