param([Parameter(Mandatory=$true)][string]$Destination, [string]$Archive = '')
$ErrorActionPreference = 'Stop'
$expected = 'f9becefe40e2a29d2ce5f3ab231ff094f9cf3e4038ff014cfe4a0c09ad90e79e'
$uri = 'https://github.com/shinchiro/mpv-winbuild-cmake/releases/download/20261015/mpv-x86_64-20261015-git-492bae0768.7z'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
New-Item -ItemType Directory -Force -Path $Destination | Out-Null
if (!$Archive) { $Archive = Join-Path $Destination 'engine.7z' }
if (!(Test-Path -LiteralPath $Archive)) {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -UseBasicParsing -Uri $uri -OutFile "$Archive.partial"
    if ((Get-FileHash -LiteralPath "$Archive.partial" -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'Engine checksum mismatch.' }
    Move-Item -LiteralPath "$Archive.partial" -Destination $Archive -Force
}
if ((Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'Engine checksum mismatch.' }
& tar.exe -xf $Archive -C $Destination
if ($LASTEXITCODE -ne 0) { throw 'Could not extract the engine with Windows tar.exe.' }
if (!(Test-Path -LiteralPath (Join-Path $Destination 'mpv.exe'))) { throw 'Engine archive did not contain mpv.exe.' }
Write-Output 'Pinned mpv engine installed and checksum verified.'
