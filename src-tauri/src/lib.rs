use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use sysinfo::System;
use winreg::enums::{HKEY_CURRENT_USER, KEY_WRITE};
use winreg::RegKey;
use tauri::{AppHandle, Manager, Emitter};
use tauri::menu::MenuBuilder;
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton};
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    pub details: String,
    pub state: String,
    pub startup_enabled: bool,
    pub button_label: String,
    pub button_url: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            details: "Cooking something..".to_string(),
            state: "@soraa.aruto".to_string(),
            startup_enabled: true,
            button_label: "Open in Github".to_string(),
            button_url: "https://github.com/YukitanCore".to_string(),
        }
    }
}

pub struct AppState {
    pub config: Mutex<AppConfig>,
    pub config_path: std::path::PathBuf,
    pub csp_running: Mutex<bool>,
    pub discord_connected: Mutex<bool>,
    pub start_time: Mutex<Option<i64>>,
    pub update_pending: Mutex<bool>,
}

#[derive(Serialize, Clone, Debug)]
pub struct FrontendState {
    pub details: String,
    pub state: String,
    pub startup_enabled: bool,
    pub csp_running: bool,
    pub discord_connected: bool,
    pub button_label: String,
    pub button_url: String,
}

fn set_startup_registry(enabled: bool) -> std::io::Result<()> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let subkey = r#"Software\Microsoft\Windows\CurrentVersion\Run"#;
    
    if enabled {
        let key = hkcu.open_subkey_with_flags(subkey, KEY_WRITE)?;
        let exe_path = std::env::current_exe()?;
        let path_str = exe_path.to_string_lossy();
        let value = format!("\"{}\" --minimized", path_str);
        key.set_value("CSP Discord RPC", &value)?;
    } else {
        if let Ok(key) = hkcu.open_subkey_with_flags(subkey, KEY_WRITE) {
            let _ = key.delete_value("CSP Discord RPC");
        }
    }
    Ok(())
}

fn show_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn setup_tray(app: &tauri::App) -> Result<(), tauri::Error> {
    let show_i = tauri::menu::MenuItemBuilder::with_id("show", "Show").build(app)?;
    let quit_i = tauri::menu::MenuItemBuilder::with_id("quit", "Quit").build(app)?;
    
    let menu = MenuBuilder::new(app)
        .item(&show_i)
        .separator()
        .item(&quit_i)
        .build()?;
        
    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "show" => {
                    show_window(app);
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                ..
            } = event {
                let app = tray.app_handle();
                show_window(app);
            }
        })
        .build(app)?;
        
    Ok(())
}

#[tauri::command]
fn get_app_state(state: tauri::State<'_, AppState>) -> FrontendState {
    let config = state.config.lock().unwrap();
    let csp_running = state.csp_running.lock().unwrap();
    let discord_connected = state.discord_connected.lock().unwrap();
    FrontendState {
        details: config.details.clone(),
        state: config.state.clone(),
        startup_enabled: config.startup_enabled,
        csp_running: *csp_running,
        discord_connected: *discord_connected,
        button_label: config.button_label.clone(),
        button_url: config.button_url.clone(),
    }
}

#[tauri::command]
fn update_rpc_config(
    details: String,
    state_str: String,
    button_label: String,
    button_url: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    config.details = details;
    config.state = state_str;
    config.button_label = button_label;
    config.button_url = button_url;
    
    let config_json = serde_json::to_string_pretty(&*config).map_err(|e| e.to_string())?;
    std::fs::write(&state.config_path, config_json).map_err(|e| e.to_string())?;
    
    let mut update_pending = state.update_pending.lock().unwrap();
    *update_pending = true;
    
    Ok(())
}

#[tauri::command]
fn toggle_startup_setting(
    enabled: bool,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    config.startup_enabled = enabled;
    
    let config_json = serde_json::to_string_pretty(&*config).map_err(|e| e.to_string())?;
    std::fs::write(&state.config_path, config_json).map_err(|e| e.to_string())?;
    
    set_startup_registry(enabled).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn delete_app_data(
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let _ = set_startup_registry(false);
    
    if let Some(parent_dir) = state.config_path.parent() {
        let _ = std::fs::remove_dir_all(parent_dir);
    }
    
    app_handle.exit(0);
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_path = app.path().app_data_dir().unwrap();
            let _ = std::fs::create_dir_all(&app_data_path);
            let config_file_path = app_data_path.join("config.json");
            
            let config = if config_file_path.exists() {
                if let Ok(content) = std::fs::read_to_string(&config_file_path) {
                    serde_json::from_str(&content).unwrap_or_else(|_| AppConfig::default())
                } else {
                    AppConfig::default()
                }
            } else {
                let default_cfg = AppConfig::default();
                if let Ok(content) = serde_json::to_string_pretty(&default_cfg) {
                    let _ = std::fs::write(&config_file_path, content);
                }
                default_cfg
            };
            
            let _ = set_startup_registry(config.startup_enabled);
            
            let app_state = AppState {
                config: Mutex::new(config),
                config_path: config_file_path,
                csp_running: Mutex::new(false),
                discord_connected: Mutex::new(false),
                start_time: Mutex::new(None),
                update_pending: Mutex::new(true),
            };
            app.manage(app_state);
            
            setup_tray(app)?;
            
            let is_minimized = std::env::args().any(|a| a == "--minimized");
            if is_minimized {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut sys = System::new();
                let mut client: Option<DiscordIpcClient> = None;
                
                let mut last_process_check = std::time::Instant::now() - std::time::Duration::from_secs(3);
                let mut last_discord_check = std::time::Instant::now() - std::time::Duration::from_secs(5);
                
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    
                    let state = app_handle.state::<AppState>();
                    let now = std::time::Instant::now();
                    
                    if now.duration_since(last_process_check).as_secs() >= 3 {
                        last_process_check = now;
                        sys.refresh_processes();
                        let is_running = sys.processes().values().any(|p| {
                            let name = p.name().to_lowercase();
                            name == "clipstudiopaint.exe" || name == "clipstudiopaint"
                        });
                        
                        let mut csp_running = state.csp_running.lock().unwrap();
                        if *csp_running != is_running {
                            *csp_running = is_running;
                            let _ = app_handle.emit("status-changed", ());
                        }
                    }
                    
                    // snapshot state into locals, then drop all locks immediately
                    let csp_running = *state.csp_running.lock().unwrap();
                    let is_connected = *state.discord_connected.lock().unwrap();
                    
                    if csp_running {
                        // --- attempt connection (lock-free) ---
                        if !is_connected && now.duration_since(last_discord_check).as_secs() >= 5 {
                            last_discord_check = now;
                            
                            if client.is_none() {
                                if let Ok(cli) = DiscordIpcClient::new("1512449466127483001") {
                                    client = Some(cli);
                                }
                            }
                            
                            if let Some(ref mut cli) = client {
                                if cli.connect().is_ok() {
                                    let mut dc = state.discord_connected.lock().unwrap();
                                    *dc = true;
                                    let mut st = state.start_time.lock().unwrap();
                                    if st.is_none() {
                                        *st = Some(
                                            std::time::SystemTime::now()
                                                .duration_since(std::time::UNIX_EPOCH)
                                                .unwrap()
                                                .as_secs() as i64
                                        );
                                    }
                                    let mut up = state.update_pending.lock().unwrap();
                                    *up = true;
                                    let _ = app_handle.emit("status-changed", ());
                                }
                            }
                        }
                        
                        // re-read after potential connection
                        let is_connected = *state.discord_connected.lock().unwrap();
                        let has_pending = *state.update_pending.lock().unwrap();
                        
                        // --- push activity update (lock-free during IPC) ---
                        if is_connected && has_pending {
                            { let mut up = state.update_pending.lock().unwrap(); *up = false; }
                            
                            let config = state.config.lock().unwrap().clone();
                            let timestamp = *state.start_time.lock().unwrap();
                            // all locks dropped here
                            
                            if let Some(ref mut cli) = client {
                                let act = activity::Activity::new()
                                    .details(&config.details)
                                    .state(&config.state)
                                    .assets(activity::Assets::new()
                                        .large_image("https://github.com/YukitanCore/CSP-discordRPC/blob/main/CSPlogoAnimatedSORA.gif?raw=true")
                                        .large_text("CLIP STUDIO PAINT")
                                    );
                                     
                                let act = if let Some(t) = timestamp {
                                    act.timestamps(activity::Timestamps::new().start(t))
                                } else {
                                    act
                                };
                                
                                let act = act.buttons(vec![
                                    activity::Button::new(&config.button_label, &config.button_url)
                                ]);
                                
                                if cli.set_activity(act).is_err() {
                                    let mut dc = state.discord_connected.lock().unwrap();
                                    *dc = false;
                                    client = None;
                                    let _ = app_handle.emit("status-changed", ());
                                }
                            }
                        }
                    } else if is_connected {
                        // CSP closed — disconnect (lock-free during IPC)
                        if let Some(ref mut cli) = client {
                            let _ = cli.close();
                        }
                        client = None;
                        {
                            let mut dc = state.discord_connected.lock().unwrap();
                            *dc = false;
                        }
                        {
                            let mut st = state.start_time.lock().unwrap();
                            *st = None;
                        }
                        let _ = app_handle.emit("status-changed", ());
                    }
                }
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_state,
            update_rpc_config,
            toggle_startup_setting,
            delete_app_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
