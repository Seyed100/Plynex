param([string]$ReleaseDirectory = '')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$version = (Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'package.json') | ConvertFrom-Json).version
if (!$ReleaseDirectory) { $ReleaseDirectory = Join-Path $projectRoot 'src-tauri/target/release' }
$portableDir = Join-Path $projectRoot "output/Plynex-$version-windows-x64"
New-Item -ItemType Directory -Force -Path $portableDir | Out-Null
Copy-Item -LiteralPath (Join-Path $ReleaseDirectory 'plynex.exe') -Destination (Join-Path $portableDir 'Plynex.exe') -Force
$loader = Join-Path $ReleaseDirectory 'WebView2Loader.dll'
if (Test-Path -LiteralPath $loader) { Copy-Item -LiteralPath $loader -Destination $portableDir -Force }
Copy-Item -LiteralPath (Join-Path $projectRoot 'src-tauri/resources/runtime') -Destination $portableDir -Recurse -Force
foreach ($document in @('LICENSE','THIRD_PARTY_NOTICES.md','README.md')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $document) -Destination $portableDir -Force
}
$archive = Join-Path $projectRoot "output/Plynex-$version-windows-x64-portable.zip"
Compress-Archive -Path "$portableDir/*" -DestinationPath $archive -Force
Copy-Item -LiteralPath (Join-Path $ReleaseDirectory "bundle/nsis/Plynex_$($version)_x64-setup.exe") -Destination (Join-Path $projectRoot "output/Plynex-$version-windows-x64-setup.exe") -Force
Write-Output "Portable archive: $archive"
