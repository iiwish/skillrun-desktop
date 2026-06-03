use std::ffi::OsString;
use std::path::{Path, PathBuf};
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
        .plugin(tauri_plugin_dialog::init())
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
fn run_skillrun(
    args: Vec<String>,
    cwd: Option<String>,
    extra_path_dirs: Option<Vec<String>>,
) -> Result<SkillrunProcessOutput, String> {
    let mut command = std::process::Command::new(resolve_skillrun_binary());
    command.args(args);

    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }

    if let Some(path_env) = build_path_with_extra_dirs(extra_path_dirs) {
        command.env("PATH", path_env);
    }

    let output = command.output().map_err(|error| error.to_string())?;

    Ok(SkillrunProcessOutput {
        exit_code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

fn build_path_with_extra_dirs(extra_path_dirs: Option<Vec<String>>) -> Option<OsString> {
    let extra_dirs: Vec<PathBuf> = extra_path_dirs
        .unwrap_or_default()
        .into_iter()
        .map(|path| path.trim().to_string())
        .filter(|path| !path.is_empty())
        .map(PathBuf::from)
        .collect();

    if extra_dirs.is_empty() {
        return None;
    }

    let mut paths = extra_dirs;
    if let Some(current_path) = std::env::var_os("PATH") {
        paths.extend(std::env::split_paths(&current_path));
    }

    std::env::join_paths(paths).ok()
}

fn resolve_skillrun_binary() -> OsString {
    resolve_skillrun_binary_from_env(
        std::env::var_os("SKILLRUN_CLI_PATH"),
        std::env::var_os("PATH"),
        std::env::var_os("HOME"),
        |path| path.is_file(),
    )
}

fn resolve_skillrun_binary_from_env(
    configured_path: Option<OsString>,
    path_env: Option<OsString>,
    home_dir: Option<OsString>,
    exists: impl Fn(&Path) -> bool,
) -> OsString {
    if let Some(configured_path) = configured_path {
        if !configured_path.is_empty() {
            return configured_path;
        }
    }

    if path_env
        .as_deref()
        .map(|paths| {
            std::env::split_paths(paths)
                .map(|path| path.join("skillrun"))
                .any(|path| exists(&path))
        })
        .unwrap_or(false)
    {
        return OsString::from("skillrun");
    }

    #[cfg(target_os = "macos")]
    if let Some(home_dir) = home_dir {
        if !home_dir.is_empty() {
            let candidate = PathBuf::from(home_dir).join(".cargo/bin/skillrun");
            if exists(&candidate) {
                return candidate.into_os_string();
            }
        }
    }

    OsString::from("skillrun")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn configured_skillrun_path_wins() {
        let resolved = resolve_skillrun_binary_from_env(
            Some(OsString::from("/tmp/core/skillrun")),
            Some(OsString::from("/usr/bin")),
            Some(OsString::from("/Users/iiwish")),
            |_| true,
        );

        assert_eq!(resolved, OsString::from("/tmp/core/skillrun"));
    }

    #[test]
    fn path_lookup_keeps_command_name_when_available() {
        let resolved = resolve_skillrun_binary_from_env(
            None,
            Some(OsString::from("/usr/bin:/opt/homebrew/bin")),
            Some(OsString::from("/Users/iiwish")),
            |path| path == Path::new("/opt/homebrew/bin/skillrun"),
        );

        assert_eq!(resolved, OsString::from("skillrun"));
    }

    #[test]
    fn prepends_runtime_paths_when_configured() {
        let runtime_path = PathBuf::from("/tmp/skillrun-runtime/bin");
        let path_env = build_path_with_extra_dirs(Some(vec![
            runtime_path.to_string_lossy().to_string(),
            " ".to_string(),
        ]))
        .expect("path should be built");
        let paths: Vec<PathBuf> = std::env::split_paths(&path_env).collect();

        assert_eq!(paths.first(), Some(&runtime_path));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_falls_back_to_cargo_bin_when_path_is_missing_skillrun() {
        let resolved = resolve_skillrun_binary_from_env(
            None,
            Some(OsString::from("/usr/bin:/bin")),
            Some(OsString::from("/Users/iiwish")),
            |path| path == Path::new("/Users/iiwish/.cargo/bin/skillrun"),
        );

        assert_eq!(
            resolved,
            OsString::from("/Users/iiwish/.cargo/bin/skillrun")
        );
    }
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
