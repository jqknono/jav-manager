<#
.SYNOPSIS
  Single build entry for curl-impersonate native libs (Windows/Linux/macOS).

.DESCRIPTION
  This script vendors native libraries into:
    JavManager/native/curl-impersonate/<rid>/

  Build strategy per RID:
  - win-*:
      Copy vendored DLLs from third_party/bin/<rid>/ into JavManager/native/curl-impersonate/<rid>/
  - linux-*:
      Build via Docker (uses WSL docker on Windows)
  - osx-*:
      Only supported on macOS. Run bash scripts/build-curl-impersonate.sh <rid>

.EXAMPLE
  # Windows: build win-x64, win-arm64, linux-x64, linux-arm64
  pwsh scripts/build-curl-impersonate.ps1 -RuntimeIdentifiers @("win-x64","win-arm64","linux-x64","linux-arm64")

.EXAMPLE
  # Build all supported platforms (except macOS which requires macOS host)
  pwsh scripts/build-curl-impersonate.ps1 -RuntimeIdentifiers @("win-x64","win-arm64","linux-x64","linux-arm64")

.EXAMPLE
  # macOS: build macOS libs from source
  pwsh scripts/build-curl-impersonate.ps1 -RuntimeIdentifiers @("osx-x64","osx-arm64")
#>

param(
    [string[]]$RuntimeIdentifiers = @("linux-x64", "linux-arm64"),
    [string]$CurlImpersonateVersion = ""
)

$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
    $here = Split-Path -Parent $PSCommandPath
    return (Resolve-Path (Join-Path $here "..")).Path
}

function Resolve-CurlImpersonateVersion([string]$explicit, [string]$repoRoot) {
    if (-not [string]::IsNullOrWhiteSpace($explicit)) { return $explicit.Trim() }

    $sub = Join-Path $repoRoot "third_party\curl-impersonate"
    if (Test-Path $sub) {
        $tag = (& git -C $sub describe --tags --always 2>$null)
        if (-not [string]::IsNullOrWhiteSpace($tag)) {
            if ($tag -match '^v\d+\.\d+\.\d+$') { return $tag }
            if ($tag -match '^v\d+\.\d+\.\d+') { return ($tag.Split('-')[0]) }
        }
    }
    return "v1.4.2"
}

function Ensure-Dir([string]$path) {
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Force -Path $path | Out-Null
    }
}

function Download-File([string]$url, [string]$dest) {
    Ensure-Dir (Split-Path -Parent $dest)
    & curl.exe -fsSL -o $dest $url
    if ($LASTEXITCODE -ne 0) { throw "Failed to download: $url" }
}

function Ensure-WindowsLibs([string]$repoRoot, [string]$rid) {
    $destDir = Join-Path $repoRoot ("JavManager\\native\\curl-impersonate\\" + $rid)
    if (Test-Path $destDir) {
        return $true
    }

    $src = Join-Path $repoRoot ("third_party\\bin\\" + $rid)
    if (-not (Test-Path $src)) {
        return $false
    }

    $libcurl = Join-Path $src "libcurl.dll"
    $zlib = Join-Path $src "zlib.dll"
    if (-not (Test-Path $libcurl)) { return $false }
    if (-not (Test-Path $zlib)) { return $false }

    Ensure-Dir $destDir

    Copy-Item -Force $libcurl $destDir
    Copy-Item -Force $zlib $destDir

    $ca = Join-Path $src "cacert.pem"
    if (Test-Path $ca) { Copy-Item -Force $ca $destDir }

    return $true
}

function Run-WslDocker {
    param(
        [string]$argString,
        [switch]$Silent,
        [switch]$CaptureOutput
    )
    $cmd = "docker $argString"
    if (-not $Silent) {
        Write-Host "  Running: wsl $cmd" -ForegroundColor DarkGray
    }
    if ($CaptureOutput) {
        $output = & wsl bash -c $cmd
        return @{ ExitCode = $LASTEXITCODE; Output = $output }
    }
    else {
        & wsl bash -c $cmd | Out-Null
        return $LASTEXITCODE
    }
}

function Run-WslDockerBuildx([string]$argString) {
    $cmd = "docker buildx $argString"
    Write-Host "  Running: wsl $cmd" -ForegroundColor DarkGray
    & wsl bash -c $cmd
    return $LASTEXITCODE
}

function To-WslPath([string]$windowsPath) {
    if (-not $IsWindows) { return $windowsPath }
    $p = $windowsPath -replace '\\', '/'
    if ($p -match '^([A-Za-z]):/(.*)$') {
        return '/mnt/' + $Matches[1].ToLowerInvariant() + '/' + $Matches[2]
    }
    return $p
}

function Build-LinuxWithDocker([string]$repoRoot, [string]$rid) {
    $context = Join-Path $repoRoot "third_party\curl-impersonate"
    $dockerfile = Join-Path $context "docker\debian.dockerfile"
    if (-not (Test-Path $dockerfile)) { throw "Missing dockerfile: $dockerfile" }

    $tag = "javmanager-curl-impersonate-$rid-local"

    $platform = ""
    switch ($rid) {
        "linux-arm64" { $platform = "linux/arm64" }
        "linux-x64"   { $platform = "linux/amd64" }
        default { throw "Unsupported Linux RID for docker build: $rid" }
    }

    $contextWsl = To-WslPath $context
    $dockerfileWsl = To-WslPath $dockerfile

    Write-Host "Building Docker image for $rid (platform: $platform)..."
    if ($IsWindows) {
        $exitCode = Run-WslDockerBuildx "build --platform $platform -f $dockerfileWsl -t $tag --load $contextWsl"
        if ($exitCode -ne 0) { throw "Docker build failed for $rid" }

        $container = "tmp-curl-impersonate-$rid"
        Run-WslDocker "rm -f $container" -Silent | Out-Null
        
        $exitCode = Run-WslDocker "create --name $container $tag"
        if ($exitCode -ne 0) { throw "Docker create failed" }

        $destDir = Join-Path $repoRoot ("JavManager\native\curl-impersonate\" + $rid)
        Ensure-Dir $destDir
        $soOut = Join-Path $destDir "libcurl-impersonate.so"
        $soOutWsl = To-WslPath $soOut

        # The .so is a symlink; copy the actual versioned file
        $result = Run-WslDocker "run --rm $tag ls /usr/local/lib/" -CaptureOutput
        $soFile = ($result.Output -split "`n" | Where-Object { $_ -match '^libcurl-impersonate\.so\.\d+\.\d+\.\d+$' } | Select-Object -First 1)
        if ([string]::IsNullOrWhiteSpace($soFile)) {
            $soFile = "libcurl-impersonate.so.4.8.0"  # fallback
        }
        $tempOutWsl = $soOutWsl + ".tmp"
        $exitCode = Run-WslDocker "cp ${container}:/usr/local/lib/$soFile $tempOutWsl"
        Run-WslDocker "rm -f $container" -Silent | Out-Null
        if ($exitCode -ne 0) { throw "Docker cp failed for $rid" }
        
        # Rename to final name
        $tempFile = $soOut + ".tmp"
        if (Test-Path $soOut) { Remove-Item $soOut -Force }
        Rename-Item $tempFile $soOut
    }
    else {
        & docker buildx build --platform $platform -f $dockerfile -t $tag --load $context
        if ($LASTEXITCODE -ne 0) { throw "Docker build failed for $rid" }
        
        $container = "tmp-curl-impersonate-$rid"
        & docker rm -f $container 2>$null | Out-Null
        & docker create --name $container $tag | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Docker create failed" }
        
        $destDir = Join-Path $repoRoot ("JavManager/native/curl-impersonate/" + $rid)
        Ensure-Dir $destDir
        & docker cp "${container}:/usr/local/lib/libcurl-impersonate.so" "$destDir/libcurl-impersonate.so"
        & docker rm -f $container | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Docker cp failed for $rid" }
    }

    Download-File "https://curl.se/ca/cacert.pem" (Join-Path $destDir "cacert.pem")
    Write-Host "Vendored -> $destDir"
}

function Build-FromBash([string]$repoRoot, [string]$rid) {
    $script = Join-Path $repoRoot "scripts/build-curl-impersonate.sh"
    if (-not (Test-Path $script)) { throw "Missing: $script" }
    
    & bash -lc "cd '$repoRoot' && bash scripts/build-curl-impersonate.sh $rid"
    if ($LASTEXITCODE -ne 0) { throw "bash build failed for $rid" }
}

# ============================================================================
# Main
# ============================================================================

$repoRoot = Resolve-RepoRoot
$version = Resolve-CurlImpersonateVersion $CurlImpersonateVersion $repoRoot

Write-Host "Repo: $repoRoot"
Write-Host "curl-impersonate version: $version"
Write-Host "RIDs: $($RuntimeIdentifiers -join ', ')"

foreach ($rid in $RuntimeIdentifiers) {
    Write-Host ""
    Write-Host "=== Building $rid ===" -ForegroundColor Cyan

    if ($rid -like "win-*") {
        if (-not $IsWindows) { throw "win-* build must run on Windows." }
        $ok = Ensure-WindowsLibs $repoRoot $rid
        if (-not $ok) {
            Write-Host "Skipping ${rid}: curl-impersonate Windows libs are not vendored and are no longer downloaded by scripts." -ForegroundColor Yellow
        }
        continue
    }

    if ($rid -like "linux-*") {
        Build-LinuxWithDocker $repoRoot $rid
        continue
    }

    if ($rid -like "osx-*") {
        if ($IsWindows) {
            throw "macOS builds are not supported on Windows. Run this script on macOS or use GitHub Actions CI."
        }
        Build-FromBash $repoRoot $rid
        continue
    }

    throw "Unsupported RID: $rid"
}

Write-Host ""
Write-Host "=== Build complete ===" -ForegroundColor Green
