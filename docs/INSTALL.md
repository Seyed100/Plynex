# Install Plynex

Download packages only from [GitHub Releases](https://github.com/Seyed100/Plynex/releases).
Compare the file's SHA-256 with `SHA256SUMS.txt` in the same release.

## Windows 10/11, x64

1. Download `Plynex-0.2.0-windows-x64-setup.exe` and run it. Installation is per user; administrator rights are normally unnecessary.
2. Allow the Microsoft WebView2 runtime installation if it is missing.
3. Launch Plynex. The first launch downloads the pinned mpv engine directly from its upstream GitHub release and verifies the archive's SHA-256 before extraction. Keep your internet connection available until **Native playback is ready** appears. The archive is approximately 34 MB (about 125 MB extracted); startup time depends on the connection.
4. Choose **Open a video**, drag a media file onto the window, or try the bundled sample.

The portable ZIP is an alternative: extract the **entire** archive, then run `Plynex.exe`. Keep `runtime/` and `WebView2Loader.dll` (when present) beside the executable. The engine and preferences are stored in the current user's profile, so portable refers to the application folder, not a fully self-contained profile.

Packages are unsigned. Windows may show an unknown-publisher warning. Signing and automatic updates are planned; verify the release and checksum before running.

PowerShell checksum:

```powershell
Get-FileHash .\Plynex-0.2.0-windows-x64-setup.exe -Algorithm SHA256
```

### Offline machines

Run Plynex once on an online machine. Copy the complete engine directory `%LOCALAPPDATA%\studio.plynex.player\engines\mpv-20261015` into the same location for the offline user. Install WebView2 separately using Microsoft's offline installer when needed. Playback itself uses no network service. Do not redistribute the cached engine as part of a Plynex release without satisfying its separate licenses.

## Linux x86_64

The native video surface currently requires **X11 or XWayland with a compositor**. Pure Wayland embedding is not supported yet. The app selects `GDK_BACKEND=x11` when no backend is explicitly set. XWayland requires an available `DISPLAY`.

### Ubuntu / Debian (recommended)

Ubuntu 22.04+ with the WebKitGTK 4.1 runtime is the baseline. Use the DEB so the package manager resolves dependencies, including mpv:

```bash
sudo apt update
sudo apt install ./Plynex_0.2.0_amd64.deb
plynex
```

### AppImage

The AppImage includes the app and its UI runtime dependencies, but uses **system mpv >= 0.34**. Install mpv separately; this allows distro-maintained codec and security updates.

```bash
sudo apt install mpv libfuse2
chmod +x Plynex_0.2.0_amd64.AppImage
./Plynex_0.2.0_amd64.AppImage
```

If FUSE is unavailable:

```bash
./Plynex_0.2.0_amd64.AppImage --appimage-extract
./squashfs-root/AppRun
```

### Fedora / RPM

Install mpv from a trusted repository configured for your distribution first. Package availability varies by distro; the RPM declares `mpv`, `webkit2gtk4.1`, `gtk3`, and `libX11` dependencies.

```bash
sudo dnf install ./Plynex-0.2.0-1.x86_64.rpm
```

The RPM is built as a convenience artifact. The primary Linux runtime validation is Ubuntu 22.04/X11; Fedora-specific installation needs community testing.

### Troubleshooting

- **Engine never becomes ready on Windows:** check internet access to GitHub and PowerShell/tar availability, then restart. A partial engine download is never executed. If the cached engine is damaged, rename its version directory and restart to reacquire it.
- **Black video on Linux:** ensure a compositor and X11/XWayland session are available; try `GDK_BACKEND=x11 plynex`. Run `mpv /path/to/film.mkv` to verify graphics drivers/codecs independently. The app's hardware-decoding toggle can help diagnose driver problems.
- **Black video on Windows:** turn hardware decoding off in Settings, then reopen the file. Update graphics drivers. If you report the issue, include OS, GPU, codec, and whether the sample plays.
- **No audio:** verify the OS output device, volume, mute, and selected audio track. Volume above 100% can clip already loud material.
- **Unreadable subtitles:** prefer UTF-8 SRT/ASS. Vazirmatn is bundled for Persian/Arabic shaping; font rendering also depends on libass and the file.
- **Bad saved settings:** quit the app and rename `preferences.json` in the config folder. Windows: `%APPDATA%\studio.plynex.player`; Linux: `$XDG_CONFIG_HOME/studio.plynex.player` or `~/.config/studio.plynex.player`.
- **Engine diagnostics:** the most recent startup/playback log is `mpv.log` in the application's log directory (typically `%LOCALAPPDATA%\studio.plynex.player\logs` on Windows or `~/.local/share/studio.plynex.player/logs` on Linux). The startup error displays its exact path. Logs may contain local media paths; redact them before sharing.
- **Missing or unsupported codec:** format coverage depends on mpv/FFmpeg and your platform. DRM-protected, corrupt, and some proprietary files are outside the supported scope.

## Uninstall

Use Windows Installed Apps, `sudo apt remove plynex`, or `sudo dnf remove plynex`. Delete the extracted portable/AppImage folder if applicable. User preferences, screenshots, and the Windows engine cache are retained; remove those explicitly if you no longer need them. Screenshots live in your Pictures/Plynex folder.
