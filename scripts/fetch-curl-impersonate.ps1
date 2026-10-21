<#
.SYNOPSIS
    Download and vendor curl-impersonate executables from lexiforest/curl-impersonate releases.

.DESCRIPTION
    Downloads prebuilt curl-impersonate artifacts from:
      https://github.com/lexiforest/curl-impersonate
    and copies the bundled curl executables into:
      third_party/curl-impersonate/

    Supported platforms:
      - Linux: linux-x64, linux-arm64 (gnu/musl variants)
      - macOS: osx-x64, osx-arm64

    This is primarily used by the Node.js/TypeScript version to locate
    `curl_<target>` binaries under `third_party/curl-impersonate/`.

    Note: lexiforest/curl-impersonate does not currently ship Windows
    curl-impersonate executables in its releases. This script will warn and
    skip win-* RIDs.

.EXAMPLE
    # Fetch for current platform (default)
    pwsh scripts/fetch-curl-impersonate.ps1

.EXAMPLE
    # Fetch for Linux x64 (gnu) only
    pwsh scripts/fetch-curl-impersonate.ps1 -RuntimeIdentifiers @("linux-x64") -LinuxVariant "gnu"

.EXAMPLE
    # Pin a specific version
    pwsh scripts/fetch-curl-impersonate.ps1 -Version "v1.4.2"
#>

param(
    [string]$Version = "latest",
    [string[]]$RuntimeIdentifiers = @(),
    [ValidateSet("gnu","musl","all")]
    [string]$LinuxVariant = "all",
    [string]$Repo = "lexiforest/curl-impersonate",
    [string]$DestinationRoot = "third_party/curl-impersonate"
)

$ErrorActionPreference = "Stop"

function Get-ReleaseJson([string]$repo, [string]$version) {
    $apiBase = "https://api.github.com/repos/$repo/releases"

    if ($version -eq "latest") {
        return curl.exe -L -H "Accept: application/vnd.github+json" -H "User-Agent: jav-manager" "$apiBase/latest" | ConvertFrom-Json
    }

    return curl.exe -L -H "Accept: application/vnd.github+json" -H "User-Agent: jav-manager" "$apiBase/tags/$version" | ConvertFrom-Json
}

function Get-AssetSuffix([string]$rid, [string]$linuxVariant) {
    switch ($rid) {
        "linux-x64"     { return "x86_64-linux-$linuxVariant" }
        "linux-arm64"   { return "aarch64-linux-$linuxVariant" }
        "osx-x64"       { return "x86_64-macos" }
        "osx-arm64"     { return "arm64-macos" }
        default         { throw "Unsupported RID: $rid. Supported RIDs: linux-x64, linux-arm64, osx-x64, osx-arm64." }
    }
}

function Ensure-Directory([string]$path) {
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Force -Path $path | Out-Null
    }
}

$release = Get-ReleaseJson -repo $Repo -version $Version
$tag = $release.tag_name
if ([string]::IsNullOrWhiteSpace($tag)) {
    throw "Failed to resolve release tag for Repo=$Repo Version=$Version"
}

Write-Host "Repo: $Repo"
Write-Host "Release: $tag"
Ensure-Directory $DestinationRoot

# Default to current platform RID if none specified
if ($RuntimeIdentifiers.Count -eq 0) {
    $arch = [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString().ToLowerInvariant()
    if ($IsWindows) {
        # lexiforest/curl-impersonate does not ship win-* executables in releases.
        # Default to Linux binaries for use via WSL / CI packaging.
        $RuntimeIdentifiers = @($(if ($arch -eq "arm64") { "linux-arm64" } else { "linux-x64" }))
    }
    elseif ($IsLinux) {
        $RuntimeIdentifiers = @($(if ($arch -eq "arm64") { "linux-arm64" } else { "linux-x64" }))
    }
    elseif ($IsMacOS) {
        $RuntimeIdentifiers = @($(if ($arch -eq "arm64") { "osx-arm64" } else { "osx-x64" }))
    }
    else {
        throw "Unsupported platform: $([System.Environment]::OSVersion.Platform)"
    }
}

Write-Host "RIDs: $($RuntimeIdentifiers -join ', ')"

# Determine Linux variants to process
$linuxVariants = if ($LinuxVariant -eq "all") { @("gnu","musl") } else { @($LinuxVariant) }

$didVendor = $false

function Resolve-ExtractedBinDir([string]$root) {
    # Newer lexiforest tarballs may place curl_* binaries at the archive root (no bin/ folder).
    $hasAtRoot = (Get-ChildItem -Path $root -File -Filter "curl_*" -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0
    if ($hasAtRoot) {
        return $root
    }

    $candidates = Get-ChildItem -Path $root -Directory -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq "bin" }
    foreach ($candidate in $candidates) {
        $hasCurlProfiles = (Get-ChildItem -Path $candidate.FullName -File -Filter "curl_*" -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0
        if ($hasCurlProfiles) {
            return $candidate.FullName
        }
    }
    return $null
}

function Process-Rid([string]$rid, [string]$suffix) {
    if ($rid -like "win-*") {
        Write-Host "Warning: win-* is not supported for curl-impersonate executables (no release assets found). Skipping: $rid"
        return
    }

    $assetName = "curl-impersonate-$tag.$suffix.tar.gz"

    $asset = $release.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1
    if ($null -eq $asset) {
        Write-Host "Warning: Release asset not found: $assetName (skipping)"
        return
    }

    $url = $asset.browser_download_url
    if ([string]::IsNullOrWhiteSpace($url)) {
        Write-Host "Warning: Asset has no browser_download_url: $assetName (skipping)"
        return
    }

    $tmpTar = Join-Path $env:TEMP $assetName
    $tmpExtract = Join-Path $env:TEMP ("curl-impersonate-extract-" + [Guid]::NewGuid().ToString("N"))

    Write-Host ""
    Write-Host "Downloading: $assetName"
    curl.exe -L -o $tmpTar $url | Out-Null

    Ensure-Directory $tmpExtract
    tar -xf $tmpTar -C $tmpExtract

    $binDir = Resolve-ExtractedBinDir -root $tmpExtract
    if ([string]::IsNullOrWhiteSpace($binDir)) {
        Remove-Item -Recurse -Force $tmpExtract
        Remove-Item -Force $tmpTar
        throw "Failed to locate extracted 'bin' directory containing curl_* executables for asset: $assetName"
    }

    $destBin = Join-Path $DestinationRoot "bin"
    Ensure-Directory $destBin
    Copy-Item -Force (Join-Path $binDir "curl_*") $destBin
    # Also include the generic curl-impersonate entrypoint if present
    Copy-Item -Force (Join-Path $binDir "curl-impersonate*") $destBin -ErrorAction SilentlyContinue
    $script:didVendor = $true

    Remove-Item -Recurse -Force $tmpExtract
    Remove-Item -Force $tmpTar

    Write-Host "Vendored -> $destBin"
}

foreach ($rid in $RuntimeIdentifiers) {

    # For Linux RIDs, iterate through all selected variants
    if ($rid -like "linux-*") {
        foreach ($variant in $linuxVariants) {
            $suffix = Get-AssetSuffix -rid $rid -linuxVariant $variant
            Process-Rid -rid $rid -suffix $suffix
        }
    }
    elseif ($rid -like "osx-*") {
        $suffix = Get-AssetSuffix -rid $rid -linuxVariant "gnu"
        Process-Rid -rid $rid -suffix $suffix
    }
    elseif ($rid -like "win-*") {
        Write-Host "Warning: win-* is not supported for curl-impersonate executables (no release assets found). Skipping: $rid"
    }
}

if (-not $didVendor) {
    Write-Host "No curl-impersonate executables were downloaded."
    Write-Host "Note: lexiforest/curl-impersonate does not ship win-* curl-impersonate executables; try linux-* or osx-* RIDs." -ForegroundColor Yellow
    return
}
