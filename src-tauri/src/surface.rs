#[cfg(target_os = "windows")]
#[path = "surface/windows.rs"]
mod platform;
#[cfg(target_os = "linux")]
#[path = "surface/linux.rs"]
mod platform;
pub use platform::Surface;
