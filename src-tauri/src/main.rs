#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod engine_binary;
mod ipc;
mod player;
mod surface;
use player::Engine;
use serde_json::{json, Value};
use std::{
    path::PathBuf,
    sync::{atomic::Ordering, Arc},
};
use tauri::{Emitter, Manager, State};
static PREFERENCES_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[tauri::command]
async fn load_media(
    path: String,
    start: f64,
    engine: State<'_, Arc<Engine>>,
) -> Result<(), String> {
    engine.load(path, start).await
}

#[tauri::command]
async fn stop_media(engine: State<'_, Arc<Engine>>) -> Result<(), String> {
    engine.stop_media().await
}

#[tauri::command]
async fn engine_start(app: tauri::AppHandle, engine: State<'_, Arc<Engine>>) -> Result<(), String> {
    let engine = engine.inner().clone();
    engine.start(app).await
}

#[tauri::command]
async fn player_command(
    command: Vec<Value>,
    engine: State<'_, Arc<Engine>>,
) -> Result<Value, String> {
    let name = command
        .first()
        .and_then(Value::as_str)
        .ok_or("Missing player command")?;
    if ![
        "loadfile",
        "set_property",
        "get_property",
        "cycle",
        "seek",
        "sub-add",
        "sub-remove",
        "frame-step",
        "frame-back-step",
        "stop",
    ]
    .contains(&name)
    {
        return Err("This player command is not available".into());
    }
    let engine = engine.inner().clone();
    engine.request(command).await
}

#[tauri::command]
fn video_bounds(
    app: tauri::AppHandle,
    engine: State<'_, Arc<Engine>>,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    visible: bool,
) -> Result<(), String> {
    let engine = engine.inner().clone();
    app.run_on_main_thread(move || {
        engine.surface.bounds(x, y, width, height, visible);
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn sample_media(app: tauri::AppHandle) -> Result<String, String> {
    let path = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("runtime")
        .join("quiet-horizon.mp4");
    if path.exists() {
        Ok(path.to_string_lossy().into_owned())
    } else {
        Err("The bundled sample is unavailable.".into())
    }
}

#[tauri::command]
fn collect_media(paths: Vec<String>) -> Vec<Value> {
    let mut files = Vec::<PathBuf>::new();
    for path in paths.into_iter().take(2000) {
        let path = PathBuf::from(path);
        if path.is_dir() {
            if let Ok(entries) = std::fs::read_dir(path) {
                files.extend(
                    entries
                        .flatten()
                        .map(|e| e.path())
                        .filter(|p| p.is_file() && player::is_media(p)),
                );
            }
        } else if path.is_file() && player::is_media(&path) {
            files.push(path);
        }
    }
    files.sort();
    files.dedup();
    files.truncate(2000);
    files.into_iter().map(|p| json!({"path":p.to_string_lossy(),"name":p.file_stem().unwrap_or_default().to_string_lossy()})).collect()
}

#[tauri::command]
fn save_preferences(app: tauri::AppHandle, data: Value) -> Result<(), String> {
    let _lock = PREFERENCES_LOCK.lock().map_err(|e| e.to_string())?;
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let tmp = dir.join("preferences.tmp");
    std::fs::write(
        &tmp,
        serde_json::to_vec_pretty(&data).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    std::fs::rename(tmp, dir.join("preferences.json")).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_preferences(app: tauri::AppHandle) -> Value {
    app.path()
        .app_config_dir()
        .ok()
        .and_then(|d| std::fs::read(d.join("preferences.json")).ok())
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or(json!({}))
}

#[tauri::command]
async fn screenshot(
    app: tauri::AppHandle,
    engine: State<'_, Arc<Engine>>,
) -> Result<String, String> {
    let dir = app
        .path()
        .picture_dir()
        .map_err(|e| e.to_string())?
        .join("Plynex");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let path = dir
        .join(format!("Plynex-{timestamp}.png"))
        .to_string_lossy()
        .into_owned();
    let engine = engine.inner().clone();
    let output = path.clone();
    engine
        .request(vec![
            json!("screenshot-to-file"),
            json!(output),
            json!("subtitles"),
        ])
        .await?;
    Ok(path)
}

fn main() {
    #[cfg(target_os = "linux")]
    if std::env::var_os("GDK_BACKEND").is_none() {
        std::env::set_var("GDK_BACKEND", "x11");
    }
    let engine = Arc::new(Engine::default());
    let cleanup = engine.clone();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(engine)
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .ok_or("Main window missing")?;
            unsafe {
                let engine = app.state::<Arc<Engine>>();
                engine.surface.create(&window)?;
                engine.host.store(
                    engine.surface.host.load(Ordering::Relaxed),
                    Ordering::Relaxed,
                );
            }
            let handle = app.handle().clone();
            window.on_window_event(move |event| {
                let engine = handle.state::<Arc<Engine>>();
                match event {
                    tauri::WindowEvent::Moved(_)
                    | tauri::WindowEvent::Resized(_)
                    | tauri::WindowEvent::Focused(_)
                    | tauri::WindowEvent::ScaleFactorChanged { .. } => engine.surface.sync(),
                    tauri::WindowEvent::Destroyed => {
                        engine.stop();
                        engine.surface.destroy();
                    }
                    _ => {}
                }
                if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) =
                    event
                {
                    let _ = handle.emit(
                        "files-dropped",
                        paths
                            .iter()
                            .map(|p| p.to_string_lossy().into_owned())
                            .collect::<Vec<_>>(),
                    );
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            engine_start,
            load_media,
            stop_media,
            player_command,
            video_bounds,
            sample_media,
            collect_media,
            save_preferences,
            load_preferences,
            screenshot
        ])
        .build(tauri::generate_context!())
        .expect("Failed to build Plynex")
        .run(move |_app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                cleanup.stop();
            }
        });
}
