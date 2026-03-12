use serde::Serialize;

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
    .invoke_handler(tauri::generate_handler![get_app_overview])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
