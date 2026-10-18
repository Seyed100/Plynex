# Development roadmap

The priority is reliable local playback with a small interface. This is a development proposal, not a delivery commitment.

| Priority | Work                        | Acceptance criteria                                                                                                           |
| -------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| P0       | Native Wayland rendering    | Video stays aligned through resize/fullscreen on GNOME and KDE without an XWayland requirement.                               |
| P0       | Wider hardware tests        | Test Intel/AMD/NVIDIA on Windows and Linux, 1080p/4K, SDR/HDR, multiple displays and 125–200% scaling; publish results.       |
| P0       | Lifecycle stress            | Rapid file changes, engine crash/reconnect, sleep/resume, corrupt files and unavailable drives recover without lost UI state. |
| P1       | Signed releases and updater | Maintainer-controlled signing keys, verified update manifest, rollback and offline-safe errors.                               |
| P1       | Better engine diagnostics   | Show mpv/FFmpeg version, safe diagnostic export with personal paths redacted, actionable error/retry UI.                      |
| P1       | Localization                | Persian/English translation files, complete RTL layout review, translated accessibility labels.                               |
| P1       | OS integration              | File associations, command-line file opening, Windows SMTC / Linux MPRIS, optional media keys.                                |
| P1       | Seek previews               | Thumbnails generated asynchronously with bounded CPU/disk cache; no playback interruption.                                    |
| P2       | Audio refinement            | Equalizer presets and optional limiter for amplification, track language preferences, device selection.                       |
| P2       | Library improvements        | Folder watching, recursive import with limits, playlist import/export, unavailable-file recovery.                             |
| P2       | Accessibility               | Screen-reader audit, high-contrast modes, scalable text and remappable shortcuts.                                             |
| P2       | Packaging                   | Flatpak, ARM64, Fedora runtime tests, reproducible build provenance, engine update policy.                                    |

Start with a focused issue that defines a reproducible problem. New features should include keyboard behavior, error recovery, performance limits, and both theme states. Compare cold startup, memory, seek latency, and dropped frames on specified hardware before making performance claims against VLC or other players.
