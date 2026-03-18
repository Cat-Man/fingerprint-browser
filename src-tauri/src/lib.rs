mod automation;
mod runtime;

#[cfg(test)]
mod automation_tests;

#[cfg(test)]
mod runtime_tests;

use serde::Serialize;
use automation::run_detection_probe;
use runtime::{launch_runtime, restart_runtime, stop_runtime, RuntimeRegistry};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppOverview {
  app_name: &'static str,
  runtime: &'static str,
  source: &'static str,
  profiles_ready: bool,
}

#[tauri::command]
fn get_app_overview() -> AppOverview {
  AppOverview {
    app_name: "fingerprint-browser",
    runtime: "tauri-rust",
    source: "tauri",
    profiles_ready: true,
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(RuntimeRegistry::default())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_app_overview,
      run_detection_probe,
      launch_runtime,
      restart_runtime,
      stop_runtime
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
