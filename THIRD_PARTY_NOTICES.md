# Third-party notices

Plynex application code is GPL-3.0-or-later; see LICENSE. This document records dependency provenance. Source and lockfiles are provided in the repository and each tagged source archive.

## Playback engine (separately acquired)

Plynex release installers/portable archives do **not** contain mpv/FFmpeg executables. On Windows, the user's installation downloads the original engine archive directly from its upstream release. On Linux, the user/package manager supplies system mpv >=0.34. Engine licensing remains independent of Plynex's UI dependencies.

Windows engine baseline:

- [shinchiro/mpv-winbuild-cmake, release 20261015](https://github.com/shinchiro/mpv-winbuild-cmake/releases/tag/20261015)
- Archive: mpv-x86_64-20261015-git-492bae0768.7z
- SHA-256: f9becefe40e2a29d2ce5f3ab231ff094f9cf3e4038ff014cfe4a0c09ad90e79e
- mpv revision: [492bae0768](https://github.com/mpv-player/mpv/tree/492bae0768)
- Build scripts revision: [1f8d2e76255abc48f0456d9be99b4cab9c6566e6](https://github.com/shinchiro/mpv-winbuild-cmake/tree/1f8d2e76255abc48f0456d9be99b4cab9c6566e6)
- [Upstream build workflow](https://github.com/shinchiro/mpv-winbuild-cmake/actions/runs/38657432408)

[mpv](https://github.com/mpv-player/mpv) has GPL-2.0-or-later/LGPL build options; the selected upstream build includes GPL components. [FFmpeg](https://ffmpeg.org/legal.html) has LGPL/GPL options depending on configuration. [libass](https://github.com/libass/libass) uses ISC. The original archive's documentation and notices remain in the user's engine directory. If you redistribute engine binaries yourself, supply the matching corresponding source and all notices required by that exact build. Upstream links alone are not a substitute for those distribution obligations.

## Application dependencies

| Dependency                  | License                   | Source                                              |
| --------------------------- | ------------------------- | --------------------------------------------------- |
| Tauri / plugins / Wry / Tao | MIT OR Apache-2.0         | https://github.com/tauri-apps/tauri                 |
| React / React DOM           | MIT                       | https://github.com/facebook/react                   |
| Phosphor React icons        | MIT                       | https://github.com/phosphor-icons/react             |
| serde / serde_json          | MIT OR Apache-2.0         | https://github.com/serde-rs/serde                   |
| Tokio                       | MIT                       | https://github.com/tokio-rs/tokio                   |
| windows-sys                 | MIT OR Apache-2.0         | https://github.com/microsoft/windows-rs             |
| raw-window-handle           | MIT OR Apache-2.0 OR Zlib | https://github.com/rust-windowing/raw-window-handle |
| x11-dl                      | MIT                       | https://github.com/AltF02/x11-rs                    |
| Manrope font                | SIL OFL-1.1               | https://github.com/sharanda/manrope                 |
| Vazirmatn font              | SIL OFL-1.1               | https://github.com/rastikerdar/vazirmatn            |

Exact direct/transitive versions are in package-lock.json and src-tauri/Cargo.lock. License texts for distributed npm/Rust dependencies are collected in LICENSES/DEPENDENCIES.txt by scripts/collect-licenses.mjs. Font license texts are retained under assets/fonts and alongside the runtime TTF. WebView2 and system WebKitGTK are platform runtimes governed by their own licenses.

## Original assets

The Plynex raster app icon and quiet-horizon scene were generated for this project with the built-in ImageGen tool. Prompts are recorded in assets/image-prompts.md. The sample video animates that scene and contains locally synthesized ambient audio plus original sample subtitles and chapters. These project-owned/generated assets are provided under CC0-1.0 to the extent the maintainer can grant rights; no exclusive copyright claim is made over AI-generated imagery. See assets/ASSET_LICENSE.md. Internal UI icons are Phosphor, not generated artwork.
