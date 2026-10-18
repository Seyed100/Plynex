use std::path::PathBuf;
#[cfg(target_os = "linux")]
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(windows)]
pub type Stream = tokio::net::windows::named_pipe::NamedPipeClient;
#[cfg(target_os = "linux")]
pub type Stream = tokio::net::UnixStream;

pub struct Endpoint {
    pub path: PathBuf,
    directory: Option<PathBuf>,
}
impl Endpoint {
    pub fn create() -> Result<Self, String> {
        #[cfg(windows)]
        {
            Ok(Self {
                path: PathBuf::from(format!(r"\\.\pipe\plynex-{}", std::process::id())),
                directory: None,
            })
        }
        #[cfg(target_os = "linux")]
        {
            use std::os::unix::fs::DirBuilderExt;
            let stamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|e| e.to_string())?
                .as_nanos();
            let directory =
                std::env::temp_dir().join(format!("plynex-{}-{stamp}", std::process::id()));
            std::fs::DirBuilder::new()
                .mode(0o700)
                .create(&directory)
                .map_err(|e| e.to_string())?;
            Ok(Self {
                path: directory.join("ipc.sock"),
                directory: Some(directory),
            })
        }
    }
    pub async fn connect(&self) -> std::io::Result<Stream> {
        #[cfg(windows)]
        {
            tokio::net::windows::named_pipe::ClientOptions::new().open(&self.path)
        }
        #[cfg(target_os = "linux")]
        {
            Stream::connect(&self.path).await
        }
    }
}
impl Drop for Endpoint {
    fn drop(&mut self) {
        if let Some(directory) = &self.directory {
            let _ = std::fs::remove_file(&self.path);
            let _ = std::fs::remove_dir(directory);
        }
    }
}
