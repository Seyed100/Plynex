# Release validation: 0.2.0

The first public release was checked on Windows x64 and Ubuntu 22.04 x86_64 in a dedicated WSL2 build environment. Linux GUI automation used Xvfb, Openbox, **client-mode xcompmgr**, system mpv 0.34.1, WebKitGTK 4.1 and tauri-driver. This validates the X11 rendering path; it does not represent all physical GPUs or Wayland compositors.

Completed checks:

- Production TypeScript/Vite build, Rust unit tests and formatting, saved-preference recovery tests.
- Real mpv integration on both operating systems: MP4/H.264, HEVC/MKV, VP9/WebM, MPEG-4/AVI, FLAC, Unicode paths, chapters, Persian/external subtitles, audio/subtitle delays, speed and volume to 150%.
- Browser UI in Edge: light/dark themes, empty state, collection/settings/search, click/drag/keyboard seek, speed alignment, non-overlapping playlist, resize, idle chrome hide/reveal and stable video geometry; no uncaught page errors.
- Windows release WebView2 with native mpv: actual sample playback, pause, keyboard and pointer seek, volume/mute/speed, Persian subtitle selection, chapters, PNG capture, fullscreen, both themes and centered library icons.
- Windows engine acquisition: actual upstream download, fixed SHA-256 verification and extraction with Windows tar.
- Linux release WebView with native mpv: video visible in a full desktop capture (not just a WebView screenshot), pointer seek at 20/65/80%, volume/speed, Persian track, screenshots, fullscreen, reload/resume and missing-file error.
- Installed Linux DEB and extracted AppImage passed the native playback suite. DEB/RPM package contents and dependency declarations were inspected. Fedora/RPM installation was not run.
- GitHub Actions independently built and tested Windows/MSVC and Ubuntu packages from the public repository.

Issues found during validation included an mpv option absent in 0.34, runtime-resource lookup for an unbundled Linux executable, and missing Pictures-directory handling in minimal Linux profiles. These were corrected. Automated tests were also made to wait for asynchronous metadata/seek/fullscreen state rather than assuming immediate completion.

Remaining limits: unsigned installers, first-launch internet for Windows engine acquisition, X11/XWayland plus compositor on Linux, limited physical GPU/HDR/multi-monitor coverage, no native Wayland video surface, and no guarantee for every codec or damaged/DRM file. See [ROADMAP.md](ROADMAP.md).
