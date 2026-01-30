<#
.SYNOPSIS
    Download and vendor libcurl-impersonate from lexiforest/curl-impersonate releases.

.DESCRIPTION
    Downloads prebuilt libcurl-impersonate artifacts from:
      https://github.com/lexiforest/curl-impersonate
    and copies the required native files into:
      JavManager/native/curl-impersonate/<rid>/

    This is used by JavManager's single-file publish to embed these native files
    into the final executable.

.EXAMPLE
    # Fetch for win-x64 (default)
    .\scripts\fetch-curl-impersonate-libs.ps1

.EXAMPLE
    # Fetch for multiple RIDs
    .\scripts\fetch-curl-impersonate-libs.ps1 -RuntimeIdentifiers @("win-x64","linux-x64","linux-arm64","osx-x64","osx-arm64")

.EXAMPLE
    # Pin a specific version
    .\scripts\fetch-curl-impersonate-libs.ps1 -Version "v1.3.1"
#>

param(
    [string]$Version = "latest",
    [string[]]$RuntimeIdentifiers = @("win-x64"),
    [ValidateSet("gnu","musl")]
    [string]$LinuxVariant = "gnu",
    [string]$Repo = "lexiforest/curl-impersonate",
    [string]$DestinationRoot = "JavManager/native/curl-impersonate"
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
        "win-x64"     { return "x86_64-win32" }
        "win-x86"     { return "i686-win32" }
        "win-arm64"   { return "aarch64-win32" }
        "linux-x64"   { return "x86_64-linux-$linuxVariant" }
        "linux-arm64" { return "aarch64-linux-$linuxVariant" }
        "osx-x64"     { return "x86_64-macos" }
        "osx-arm64"   { return "arm64-macos" }
        default       { throw "Unsupported RID: $rid" }
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
Write-Host "RIDs: $($RuntimeIdentifiers -join ', ')"

Ensure-Directory $DestinationRoot

foreach ($rid in $RuntimeIdentifiers) {
    $suffix = Get-AssetSuffix -rid $rid -linuxVariant $LinuxVariant
    $assetName = "libcurl-impersonate-$tag.$suffix.tar.gz"

    $asset = $release.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1
    if ($null -eq $asset) {
        throw "Release asset not found: $assetName"
    }

    $url = $asset.browser_download_url
    if ([string]::IsNullOrWhiteSpace($url)) {
        throw "Asset has no browser_download_url: $assetName"
    }

    $tmpTar = Join-Path $env:TEMP $assetName
    $tmpExtract = Join-Path $env:TEMP ("curl-impersonate-extract-" + [Guid]::NewGuid().ToString("N"))

    Write-Host ""
    Write-Host "Downloading: $assetName"
    curl.exe -L -o $tmpTar $url | Out-Null

    Ensure-Directory $tmpExtract
    tar -xf $tmpTar -C $tmpExtract

    $dest = Join-Path $DestinationRoot $rid
    Ensure-Directory $dest

    if ($rid -like "win-*") {
        # Windows bundles ship patched libcurl as libcurl.dll (+ dependencies like zlib.dll).
        $bin = Join-Path $tmpExtract "bin"
        Copy-Item -Force (Join-Path $bin "*.dll") $dest

        # Provide CA bundle (PEM). Some Windows builds do not use the OS cert store.
        $caPath = Join-Path $dest "cacert.pem"
        curl.exe -L -o $caPath https://curl.se/ca/cacert.pem | Out-Null
    }
    else {
        # Unix bundles ship libcurl-impersonate as .so/.dylib somewhere under the archive.
        $libs = Get-ChildItem -Path $tmpExtract -Recurse -File -Include "libcurl-impersonate*.so","libcurl-impersonate*.dylib"
        if ($libs.Count -eq 0) {
            throw "No libcurl-impersonate library found in $assetName"
        }

        foreach ($lib in $libs) {
            Copy-Item -Force $lib.FullName $dest
        }
    }

    Remove-Item -Recurse -Force $tmpExtract
    Remove-Item -Force $tmpTar

    Write-Host "Vendored -> $dest"
}

