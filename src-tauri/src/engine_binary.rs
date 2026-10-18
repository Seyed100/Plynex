#[cfg(windows)]
pub async fn locate(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use std::os::windows::process::CommandExt;
    use tauri::Manager;
    // Engine files are acquired directly from upstream by the user installation.
    // Public Plynex packages contain no third-party mpv executable.
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("engines/mpv-20261015");
    let binary = directory.join("mpv.exe");
    if binary.is_file() {
        return Ok(binary);
    }
    let output_binary = binary.clone();
    tauri::async_runtime::spawn_blocking(move || {
        std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
        let script = directory.join("install-engine.ps1");
        std::fs::write(&script, include_str!("../../scripts/install-engine.ps1"))
            .map_err(|e| e.to_string())?;
        let status = std::process::Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
            ])
            .arg(script)
            .arg("-Destination")
            .arg(directory)
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| e.to_string())?;
        if !status.status.success() {
            return Err(format!(
                "Engine setup failed. Check your connection and restart Plynex. {}",
                String::from_utf8_lossy(&status.stderr)
            ));
        }
        Ok(output_binary)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(target_os = "linux")]
pub async fn locate(_app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(std::path::PathBuf::from("mpv"))
}
