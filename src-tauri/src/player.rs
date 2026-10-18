use serde_json::{json, Value};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::{
    collections::HashMap,
    path::Path,
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{Emitter, Manager};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader, WriteHalf},
    sync::{broadcast, oneshot, Mutex as AsyncMutex},
};

#[derive(Default)]
pub struct Engine {
    pub host: AtomicUsize,
    pub surface: crate::surface::Surface,
    started: AtomicBool,
    writer: AsyncMutex<Option<WriteHalf<crate::ipc::Stream>>>,
    child: Mutex<Option<Child>>,
    pending: Mutex<HashMap<u64, oneshot::Sender<Value>>>,
    next_id: AtomicU64,
    generation: AtomicU64,
    start_gate: AsyncMutex<()>,
    load_gate: AsyncMutex<()>,
    endpoint: Mutex<Option<crate::ipc::Endpoint>>,
    events: std::sync::OnceLock<broadcast::Sender<Value>>,
}

impl Engine {
    pub async fn start(self: &Arc<Self>, app: tauri::AppHandle) -> Result<(), String> {
        let _gate = self.start_gate.lock().await;
        if self.started.load(Ordering::SeqCst) {
            return Ok(());
        }
        self.stop();
        let result = self.start_inner(app).await;
        if result.is_err() {
            self.stop();
        }
        result
    }

    async fn start_inner(self: &Arc<Self>, app: tauri::AppHandle) -> Result<(), String> {
        let binary = crate::engine_binary::locate(&app).await?;
        let endpoint = crate::ipc::Endpoint::create()?;
        let pipe = endpoint.path.to_string_lossy().into_owned();
        let generation = self.generation.fetch_add(1, Ordering::SeqCst) + 1;
        let runtime = crate::engine_binary::runtime_dir(&app)?;
        let log_dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;
        let log_path = log_dir.join("mpv.log");
        let log_file = std::fs::File::create(&log_path).map_err(|e| e.to_string())?;
        let mut process = Command::new(binary);
        process
            .args([
                "--no-config",
                "--idle=yes",
                "--keep-open=yes",
                "--force-window=yes",
                "--osc=no",
                "--input-default-bindings=no",
                "--input-vo-keyboard=no",
                "--input-cursor=no",
                "--cursor-autohide=no",
                "--terminal=yes",
                "--msg-level=all=warn",
                "--hwdec=auto-safe",
                "--vo=gpu-next,gpu",
                "--volume-max=150",
                "--volume=75",
                "--sub-auto=fuzzy",
                "--sub-codepage=auto",
                "--sub-font=Vazirmatn",
                "--sub-font-size=40",
                "--sub-border-size=2",
                "--osd-level=0",
                "--screenshot-format=png",
                "--audio-client-name=Plynex",
                "--autofit=100%",
                "--input-terminal=no",
                "--load-scripts=no",
                "--save-position-on-quit=no",
                "--audio-display=no",
            ])
            .arg(format!("--config-dir={}", runtime.display()))
            .arg(format!("--wid={}", self.host.load(Ordering::Relaxed)))
            .arg(format!("--input-ipc-server={pipe}"))
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::from(
                log_file.try_clone().map_err(|e| e.to_string())?,
            ))
            .stdout(Stdio::from(log_file));
        #[cfg(windows)]
        process.arg("--gpu-api=d3d11").creation_flags(0x08000000);
        #[cfg(target_os = "linux")]
        process.args(["--gpu-context=x11egl", "--vo=gpu-next,gpu,x11"]);
        let child = process
            .spawn()
            .map_err(|e| format!("Could not start the playback engine: {e}"))?;
        *self.child.lock().map_err(|e| e.to_string())? = Some(child);
        let mut connection = None;
        for _ in 0..100 {
            match endpoint.connect().await {
                Ok(client) => {
                    connection = Some(client);
                    break;
                }
                Err(_) => tokio::time::sleep(Duration::from_millis(50)).await,
            }
        }
        let client = connection.ok_or_else(|| {
            format!(
                "The playback engine did not become ready within 5 seconds. See {}",
                log_path.display()
            )
        })?;
        *self.endpoint.lock().map_err(|e| e.to_string())? = Some(endpoint);
        // Windows requires overlapped I/O: a synchronous event read on a cloned
        // pipe handle can otherwise prevent command writes from completing.
        let (reader, writer) = tokio::io::split(client);
        *self.writer.lock().await = Some(writer);
        let engine = self.clone();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(reader).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let Ok(value) = serde_json::from_str::<Value>(&line) else {
                    continue;
                };
                if let Some(id) = value.get("request_id").and_then(Value::as_u64) {
                    if let Ok(mut pending) = engine.pending.lock() {
                        if let Some(tx) = pending.remove(&id) {
                            let _ = tx.send(value);
                        }
                    }
                } else {
                    let _ = engine
                        .events
                        .get_or_init(|| broadcast::channel(128).0)
                        .send(value.clone());
                    let _ = app.emit("mpv-event", value);
                }
            }
            if engine.generation.load(Ordering::SeqCst) == generation {
                engine.started.store(false, Ordering::SeqCst);
                if let Ok(mut pending) = engine.pending.lock() {
                    pending.clear();
                }
                let _ = app.emit("engine-disconnected", ());
            }
        });
        for (index, property) in [
            "time-pos",
            "duration",
            "pause",
            "volume",
            "mute",
            "speed",
            "track-list",
            "chapter-list",
            "chapter",
            "video-params",
            "audio-params",
            "media-title",
            "path",
            "eof-reached",
            "sub-delay",
            "audio-delay",
            "sub-scale",
            "sid",
            "aid",
            "hwdec-current",
            "paused-for-cache",
            "seeking",
            "demuxer-cache-state",
        ]
        .iter()
        .enumerate()
        {
            self.request(vec![
                json!("observe_property"),
                json!(index + 1),
                json!(property),
            ])
            .await?;
        }
        self.started.store(true, Ordering::SeqCst);
        Ok(())
    }

    pub async fn load(&self, path: String, start: f64) -> Result<(), String> {
        if !std::path::Path::new(&path).is_file() {
            return Err("The media file no longer exists.".into());
        }
        let _gate = self.load_gate.lock().await;
        let mut events = self
            .events
            .get_or_init(|| broadcast::channel(128).0)
            .subscribe();
        self.request(vec![json!("set_property"), json!("pause"), json!(true)])
            .await?;
        self.request(vec![json!("loadfile"), json!(path), json!("replace")])
            .await?;
        tokio::time::timeout(Duration::from_secs(20), async {
            loop {
                let event = events.recv().await.map_err(|e| e.to_string())?;
                if event["event"] == "file-loaded" {
                    return Ok::<(), String>(());
                }
                if event["event"] == "end-file" && event["reason"] == "error" {
                    return Err(event["file_error"]
                        .as_str()
                        .unwrap_or("The file could not be decoded.")
                        .to_owned());
                }
            }
        })
        .await
        .map_err(|_| "Media loading timed out".to_owned())??;
        let duration = self
            .request(vec![json!("get_property"), json!("duration")])
            .await
            .ok()
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let resume =
            if start.is_finite() && start > 0.0 && (duration == 0.0 || start < duration - 2.0) {
                start
            } else {
                0.0
            };
        if resume > 0.0 {
            self.request(vec![json!("seek"), json!(resume), json!("absolute+exact")])
                .await?;
        }
        self.request(vec![json!("set_property"), json!("pause"), json!(false)])
            .await?;
        Ok(())
    }

    pub async fn stop_media(&self) -> Result<(), String> {
        let _gate = self.load_gate.lock().await;
        self.request(vec![json!("stop")]).await?;
        Ok(())
    }

    pub async fn request(&self, command: Vec<Value>) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        self.pending
            .lock()
            .map_err(|e| e.to_string())?
            .insert(id, tx);
        let payload = json!({"command":command,"request_id":id}).to_string() + "\n";
        let result = async {
            {
                let mut guard = self.writer.lock().await;
                let writer = guard
                    .as_mut()
                    .ok_or("Playback engine is not ready".to_owned())?;
                writer
                    .write_all(payload.as_bytes())
                    .await
                    .map_err(|e| e.to_string())?;
            }
            let response = rx.await.map_err(|e| e.to_string())?;
            if response["error"] != "success" {
                return Err(response["error"]
                    .as_str()
                    .unwrap_or("Playback command failed")
                    .to_owned());
            }
            Ok(response["data"].clone())
        };
        let result = tokio::time::timeout(Duration::from_secs(8), result).await;
        self.pending.lock().map_err(|e| e.to_string())?.remove(&id);
        result.map_err(|_| "Playback request timed out".to_owned())?
    }

    pub fn stop(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
        if let Ok(mut child) = self.child.lock() {
            if let Some(mut process) = child.take() {
                let _ = process.kill();
                let _ = process.wait();
            }
        }
        if let Ok(mut writer) = self.writer.try_lock() {
            *writer = None;
        }
        self.started.store(false, Ordering::SeqCst);
        if let Ok(mut pending) = self.pending.lock() {
            pending.clear();
        }
        if let Ok(mut endpoint) = self.endpoint.lock() {
            *endpoint = None;
        }
    }
}

pub fn is_media(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| {
            [
                "mp4", "mkv", "avi", "mov", "webm", "m4v", "wmv", "flv", "ts", "mts", "m2ts",
                "mpeg", "mpg", "vob", "ogv", "3gp", "hevc", "h264", "m2v", "mp3", "flac", "wav",
                "ogg", "m4a", "aac", "opus", "wma", "aiff", "ape", "alac",
            ]
            .contains(&e.to_lowercase().as_str())
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn media_filter_is_case_insensitive_and_rejects_scripts() {
        assert!(is_media(Path::new("film.MKV")));
        assert!(is_media(Path::new("song.FLAC")));
        assert!(!is_media(Path::new("setup.exe")));
        assert!(!is_media(Path::new("captions.srt")));
    }
}
