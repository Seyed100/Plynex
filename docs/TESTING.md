# Testing and release checks

## Automated checks

| Check | Purpose |
|---|---|
| `npm run build` | TypeScript verification, runtime preparation, production Vite build. |
| `npm run test:preferences` | Invalid, legacy and out-of-range saved preferences recover safely. |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked` | Rust compilation and native unit tests. |
| `npm run test:engine` | Real mpv JSON IPC, MP4/H.264 sample, HEVC/MKV, VP9/WebM, MPEG-4/AVI, FLAC, Unicode paths, Persian/external subtitles, chapters, seek, 150% volume and sync. Requires ffmpeg and mpv. |
| `npm run test:ui` | Browser UI, both themes, modal navigation, empty state, collection, seek click/drag/keyboard, speed alignment and idle chrome layout. Run Vite first; uses Edge on Windows or installed Playwright Chromium on Linux. |
| `npm run test:native` | Actual Windows WebView2/mpv playback and controls; connect to a separately launched release app via local CDP port 9222. |
| `node scripts/qa-linux-webdriver.mjs` | Actual Linux release WebView/mpv playback through tauri-driver, native seek, volume, subtitles, screenshots and window controls. |

The browser scripts import Playwright's automation API. Install its browser on Linux with `npx playwright install --with-deps chromium`. A browser-only run is insufficient to verify that the native video host is visible.

Windows native test launch (use only locally while testing; normal launch does not open a debug port):

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9222'
Start-Process -FilePath .\src-tauri\target\release\plynex.exe -WindowStyle Hidden
npm run test:native
Remove-Item Env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
```

Linux native automation uses `cargo install tauri-driver --locked`, the `webkit2gtk-driver` package, a display and compositor. Set `PLYNEX_BINARY` to the release executable, start `tauri-driver`, then run the script. Root-only CI containers may need `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`; do not use this setting for normal desktop sessions.

## Build packages

```bash
npm ci
npm run package
```

Tauri selects `tauri.windows.conf.json` or `tauri.linux.conf.json` automatically. Linux produces DEB, RPM and AppImage under `src-tauri/target/release/bundle`. Windows produces an NSIS installer; run `scripts/package-portable.ps1` afterwards for the portable ZIP. A GNU Windows build must retain `WebView2Loader.dll`; MSVC builds may link the loader statically.

## Manual release checks

Use a fresh user profile/VM when possible: install/uninstall, first-launch engine download and offline retry, bundled sample visibility and audio, a real long film, aspect ratio, seek at 20/65/80%, drag outside the timeline, speed and volume limits, embedded/external Persian subtitles, queue transitions and end-of-file replay, resume after app restart, fullscreen, minimize/restore, move/resize/DPI changes, light/dark contrast, keyboard-only navigation and reduced motion.

Test a Linux package after installation or AppImage extraction, not only the unbundled binary. Inspect DEB/RPM dependencies, record checksums and attach only the intended packages. Never include user settings, media, engine caches, credentials or local test output in git.

GitHub Actions builds Windows/Linux packages and runs reproducible compilation, preference and engine checks. Packaging success is not proof of all GPU/compositor/codec combinations. Record platform-specific gaps honestly in release notes.
