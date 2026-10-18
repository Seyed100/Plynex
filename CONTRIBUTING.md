# Contributing to Plynex

Thanks for helping make local playback quieter and more dependable. Read the [architecture](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md), and [test guide](docs/TESTING.md) first.

## Development environment

Use Node.js 22 LTS, npm, a stable Rust toolchain, and the [Tauri 2 prerequisites](https://tauri.app/start/prerequisites/) for your OS. Commit both lockfiles when dependencies change.

```bash
git clone https://github.com/Seyed100/Plynex.git
cd Plynex
npm ci
npm run prepare:runtime
npm run desktop
```

Windows needs the Visual Studio C++ build tools and WebView2 (or a configured GNU Rust toolchain). The first desktop launch downloads its pinned engine. `scripts/setup-mpv.ps1` prepares a separate engine for integration tests, using the same verified upstream archive. It requires the `assets` directory and built-in Windows `tar.exe`.

Ubuntu build dependencies:

```bash
sudo apt update
sudo apt install build-essential curl wget file libwebkit2gtk-4.1-dev libxdo-dev \
  libssl-dev librsvg2-dev libayatana-appindicator3-dev libx11-dev mpv ffmpeg \
  rpm patchelf
```

Linux development requires X11/XWayland. In a container, run a compositor such as xcompmgr alongside Xvfb/Openbox. Use a separate build tree and npm install for each OS; Windows and Linux native modules/target directories are not interchangeable.

## Before opening a pull request

```bash
npm run build
npm run test:preferences
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --locked
npm run test:engine
```

Run `npm run test:ui` with Vite running when UI behavior changes. Use the native test suite for playback/window changes. Explain the exact OS, codec, GPU/session, and test result; browser preview alone does not verify native video.

Keep PRs focused. Describe the trigger, previous behavior, resulting behavior, and validation. Include before/after screenshots for visual changes and test steps for playback fixes. Avoid unnecessary UI libraries, copied playback engines, telemetry, or new background processes.

## Design rules

- Warm neutral tokens are shared by light and dark themes: `#1A1A1A`, `#2E2E2E`, `#D4B896`, `#E7D8C9`, `#F5F5F4`.
- Use **Phosphor** for internal icons. Keep SVGs centered and consistently sized; do not draw replacement icons by hand.
- The app logo is an original asset; keep clear spacing and a recognizable silhouette.
- Use Manrope for Latin UI and Vazirmatn for Persian/Arabic. Support keyboard navigation, visible focus, usable hit targets, and reduced motion.
- Animate opacity/transforms when possible. Keep video geometry stable while controls fade. A playlist reserves space instead of obscuring video.
- Preserve media aspect ratio by default. Hardware decoding has a software fallback; don't promise all codecs or universally smooth 4K.

## Bug reports and features

Use the GitHub templates. A small non-private reproduction file is helpful, but do not upload copyrighted films, personal paths, credentials, or private subtitles. Share `mpv --version`, codec information, and concise steps instead. Feature requests should explain the viewing problem and acceptance criteria.

Contributions are licensed under GPL-3.0-or-later. You must have permission to submit your code/assets. Credit upstream work and retain its license. No CLA is required. Be respectful and keep discussions focused on the work.
