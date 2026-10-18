$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'install-engine.ps1') -Destination (Join-Path $projectRoot 'src-tauri/resources/mpv') -Archive (Join-Path $projectRoot 'assets/mpv.7z')
node (Join-Path $PSScriptRoot 'prepare-runtime.mjs')
