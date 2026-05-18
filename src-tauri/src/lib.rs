use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WindowEvent};

const OPEN_DASHBOARD: &str = "open_dashboard";
const IMPORT_SKR: &str = "import_skr";
const REFRESH: &str = "refresh";
const MOUNT_MANAGER: &str = "mount_manager";
const ENVELOPE_EXPLORER: &str = "envelope_explorer";
const QUIT: &str = "quit";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![run_skillrun])
        .setup(|app| {
            create_tray(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SkillrunProcessOutput {
    exit_code: i32,
    stdout: String,
    stderr: String,
}

#[tauri::command]
fn run_skillrun(args: Vec<String>, cwd: Option<String>) -> Result<SkillrunProcessOutput, String> {
    let mut command = std::process::Command::new("skillrun");
    command.args(args);

    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }

    let output = command.output().map_err(|error| error.to_string())?;

    Ok(SkillrunProcessOutput {
        exit_code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let open_dashboard =
        MenuItem::with_id(app, OPEN_DASHBOARD, "Open Dashboard", true, None::<&str>)?;
    let import_skr = MenuItem::with_id(app, IMPORT_SKR, "Import .skr...", true, None::<&str>)?;
    let refresh = MenuItem::with_id(app, REFRESH, "Refresh", true, None::<&str>)?;
    let mount_manager = MenuItem::with_id(app, MOUNT_MANAGER, "Mount Manager", true, None::<&str>)?;
    let envelope_explorer = MenuItem::with_id(
        app,
        ENVELOPE_EXPLORER,
        "Envelope Explorer",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, QUIT, "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &open_dashboard,
            &import_skr,
            &refresh,
            &mount_manager,
            &envelope_explorer,
            &quit,
        ],
    )?;

    let icon = app
        .default_window_icon()
        .cloned()
        .expect("generated Tauri context should include an application icon");

    TrayIconBuilder::with_id("skillrun-tray")
        .tooltip("SkillRun")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            OPEN_DASHBOARD | IMPORT_SKR | MOUNT_MANAGER | ENVELOPE_EXPLORER => {
                show_dashboard(app);
            }
            REFRESH => {
                show_dashboard(app);
            }
            QUIT => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_dashboard(&tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn show_dashboard(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
