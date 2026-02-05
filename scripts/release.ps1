<#
.SYNOPSIS
    Build versioned release artifacts into artifacts/release/.

.DESCRIPTION
    Publishes self-contained single-file executables for common desktop RIDs, then
    copies them into artifacts/release/ with versioned filenames:
      JavManager_<Version>_<rid>[.exe]

    This script exists so VSCode tasks.json can stay simple.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1
#>

[CmdletBinding()]
param(
    [string]$Project = "JavManager/JavManager.csproj",
    [string]$Configuration = "Release",
    [string[]]$RuntimeIdentifiers = @("win-x64", "linux-x64", "linux-arm64", "osx-x64", "osx-arm64"),
    [string]$OutputDir = "artifacts/release",
    [string]$TempOutputRoot = "artifacts/_publish_tmp"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Resolve-RepoPath([string]$path) {
    if ([System.IO.Path]::IsPathRooted($path)) {
        return $path
    }
    return (Join-Path $repoRoot $path)
}

$propsPath = Resolve-RepoPath "Directory.Build.props"
$version = "unknown"
if (Test-Path $propsPath) {
    try {
        [xml]$xml = Get-Content $propsPath -Raw
        $v = $xml.Project.PropertyGroup.Version
        if ($v -is [array]) { $v = $v[0] }
        if (-not [string]::IsNullOrWhiteSpace($v)) { $version = $v.Trim() }
    }
    catch {
        $version = "unknown"
    }
}

$publishScript = Resolve-RepoPath "scripts/publish.ps1"
if (-not (Test-Path $publishScript)) { throw "publish.ps1 not found: $publishScript" }

$tmpRootPath = Resolve-RepoPath $TempOutputRoot
$destPath = Resolve-RepoPath $OutputDir

if (Test-Path $tmpRootPath) { Remove-Item -Recurse -Force $tmpRootPath }
New-Item -ItemType Directory -Force -Path $tmpRootPath | Out-Null
New-Item -ItemType Directory -Force -Path $destPath | Out-Null

Write-Host ("Version: " + $version)
Write-Host ("RIDs: " + ($RuntimeIdentifiers -join ", "))
Write-Host ("Temp: " + $tmpRootPath)
Write-Host ("Dest: " + $destPath)

foreach ($rid in $RuntimeIdentifiers) {
    Write-Host ""
    Write-Host ("Publishing " + $rid + "...")

    & $publishScript -RuntimeIdentifiers @($rid) -Project $Project -Configuration $Configuration -OutputRoot $TempOutputRoot

    $outDir = Resolve-RepoPath (Join-Path $TempOutputRoot $rid)
    $files = Get-ChildItem $outDir -File
    if ($files.Count -ne 1) {
        throw "STRICT MODE: expected exactly 1 file in $outDir; Found: $($files.Name -join ', ')"
    }

    $src = $files[0].FullName
    $destName = if ($rid -like "win-*") { "JavManager_${version}_${rid}.exe" } else { "JavManager_${version}_${rid}" }
    $dest = Join-Path $destPath $destName

    Copy-Item $src -Destination $dest -Force
    Write-Host ("OK: " + $dest)
}

Remove-Item -Recurse -Force $tmpRootPath

