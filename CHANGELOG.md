# Changelog

## 0.2.0

First public open-source release.

- Rust/Tauri 2 desktop app with mpv JSON IPC, Windows native video host and Linux X11 host.
- Warm neutral light/dark themes, original Plynex app icon, Phosphor UI icons, Manrope and Vazirmatn typography.
- Quiet drag/open empty state, full-width seek timeline, glass controls that fade during viewing, and a playlist that reserves video space.
- Fixed pointer seek click/drag behavior and playback-speed multiplier alignment.
- Serialized engine startup/file loading, compatible mpv 0.34+ load commands, explicit load errors and safer resume positions.
- Correct end-of-file replay and automatic queue stopping, validated preferences, serialized atomic settings writes and stale-load protection.
- 150% volume, playback speed, audio/subtitle tracks and synchronization, screenshot capture, chapters, fullscreen and keyboard shortcuts.
- Windows first-run verified engine acquisition; Linux system-mpv dependencies; install/development/contribution/roadmap documentation.

Known limits: unsigned packages; Linux requires X11/XWayland and a compositor; RPM runtime validation is more limited than Ubuntu; codec and hardware support depend on mpv/FFmpeg and drivers. No DRM, native Wayland embedding, casting or automatic updater yet.
