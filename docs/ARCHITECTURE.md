# Architecture

## Components

```text
React UI (Manrope / Vazirmatn / Phosphor)
  ↕ typed Tauri commands + mpv-event notifications
Rust application (preferences, files, window bounds, lifecycle)
  ↕ JSON IPC: overlapped named pipe on Windows / private Unix socket on Linux
mpv process (FFmpeg codecs, libass subtitles, audio/video clocks, decoding)
  → native video host under a transparent WebView
```

`src/App.tsx` coordinates the collection and viewing state. `src/usePlayer.ts` maps native events into UI state; browser preview uses HTML video and has browser-dependent codecs. `src/components.tsx` contains accessible controls and the pointer-driven seek bar.

`src-tauri/src/player.rs` owns the mpv process, serializes startup and file loads, matches JSON request IDs to responses, and broadcasts engine events. Loading waits for `file-loaded` or an explicit decoding error before unpausing. Resume positions are applied only after a successful load and are bounded by duration. Generation IDs prevent an old pipe reader from disconnecting a replacement engine.

`ipc.rs` isolates platform transports. Linux sockets live in a uniquely named, mode-0700 temporary directory; shutdown removes it. Windows uses Tokio's overlapped named pipe client so blocking event reads cannot deadlock writes.

`surface/windows.rs` uses a separate Win32 host window immediately behind the transparent application window. `surface/linux.rs` creates an X11 host below the window-manager frame. Bounds are converted from CSS pixels to device pixels and resynchronized when the app moves/resizes. The playlist changes available video bounds. Linux requires a compositor; native Wayland embedding remains future work.

## Engine distribution

Plynex release packages do not redistribute an mpv executable. Windows downloads a fixed upstream archive on first launch, checks its SHA-256, extracts it with Windows tar, and caches it under LocalAppData. The download URL and hash are in `scripts/install-engine.ps1`; bump them together after validation. Linux uses distro mpv >=0.34, declared as a DEB/RPM dependency. See [third-party notices](../THIRD_PARTY_NOTICES.md).

## State and persistence

Preferences and collection metadata stay local. JSON writes are serialized and use a temporary file plus rename. Type, range, queue, and resume-position validation recovers from malformed/older settings. Current video time is saved only when the engine's active path matches the selected media. Local file paths are never sent to a remote service by app code. Engine/bootstrap and WebView2 installation may contact their upstream hosts.

mpv is the authoritative audio/video clock. Seeking sends explicit `absolute+exact` or `relative+exact` commands. The seek thumb uses immediate local feedback during pointer capture; it reconciles with the engine's time position after the seek completes. Cache and seeking events are tracked independently from pause. Large files, long GOPs, network-mounted files, and slow hardware can still delay decoding.

## VLC study

Implementation ideas were informed by VideoLAN's public source, especially [player/timer.c](https://github.com/videolan/vlc/blob/master/src/player/timer.c), [player/input.c](https://github.com/videolan/vlc/blob/master/src/player/input.c), and [clock documentation](https://github.com/videolan/vlc/blob/master/doc/clock.md). The relevant principles are explicit input lifecycle, a distinct seek state, and treating the media clock as authoritative rather than a UI timer. No VLC binary reverse engineering or copied VLC implementation was needed. Codec and clock handling are delegated to mpv instead of reimplemented in the WebView.

## Boundaries

Currently supported: local files/folders, embedded/external subtitle tracks, common video/audio codecs exposed by mpv. Missing: DRM, disc navigation, streaming-service integration, native Wayland embedding, casting, signed updates, global media keys, and OS file associations. Public API compatibility and platform coverage are still evolving.
