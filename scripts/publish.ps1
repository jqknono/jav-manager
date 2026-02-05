<#
.SYNOPSIS
    Publish JavManager for multiple platforms.
    为多个平台发布 JavManager 独立单文件可执行程序。

.DESCRIPTION
    Builds JavManager for each specified runtime identifier (RID).
    - Desktop RIDs: strict validation: each output must contain exactly one executable file.
    Outputs to artifacts/publish/<rid>/.
    为每个指定的运行时标识符 (RID) 构建 JavManager，严格验证：
    每个输出必须仅包含一个可执行文件。输出到 artifacts/publish/<rid>/。

.PARAMETER Project
    Path to the project file. Default: JavManager/JavManager.csproj
    项目文件路径。默认：JavManager/JavManager.csproj

.PARAMETER RuntimeIdentifiers
    Array of runtime identifiers.
    Default: win-x64, linux-x64, linux-arm64, osx-x64, osx-arm64
    运行时标识符数组。默认：win-x64, linux-x64, linux-arm64, osx-x64, osx-arm64

.EXAMPLE
    .\publish.ps1
    .\publish.ps1 win-x64 linux-x64
    .\publish.ps1 -RuntimeIdentifiers @("win-x64", "linux-x64")
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string[]]$RuntimeIdentifiers = @("win-x64", "linux-x64", "linux-arm64", "osx-x64", "osx-arm64"),
    [string]$Project = "JavManager/JavManager.csproj",
    [string]$Configuration = "Release",
    [string]$OutputRoot = "artifacts/publish",
    [bool]$SelfContained = $true,
    [bool]$SingleFile = $true,
    [bool]$ReadyToRun = $false,
    [bool]$Trimmed = $false
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Resolve-RepoPath([string]$path) {
    if ([System.IO.Path]::IsPathRooted($path)) {
        return $path
    }
    return (Join-Path $repoRoot $path)
}

$defaultRuntimeIdentifiers = @("win-x64", "linux-x64", "linux-arm64", "osx-x64", "osx-arm64")

# Back-compat: allow ".\publish.ps1 <project.csproj> [rid...]" while enabling ".\publish.ps1 <rid...>".
if (-not $PSBoundParameters.ContainsKey("Project") -and $RuntimeIdentifiers.Count -ge 1) {
    $first = $RuntimeIdentifiers[0]
    if ($first -like "*.csproj") {
        $maybeProjectPath = Resolve-RepoPath $first
        if (Test-Path $maybeProjectPath) {
            $Project = $first
            if ($RuntimeIdentifiers.Count -gt 1) {
                $RuntimeIdentifiers = $RuntimeIdentifiers[1..($RuntimeIdentifiers.Count - 1)]
            } else {
                $RuntimeIdentifiers = $defaultRuntimeIdentifiers
            }
        }
    }
}

if ($RuntimeIdentifiers.Count -lt 1) {
    $RuntimeIdentifiers = $defaultRuntimeIdentifiers
}

if ([string]::IsNullOrWhiteSpace($Project)) {
    throw "Project must not be empty. Use -Project <path-to-csproj>."
}

$projectPath = Resolve-RepoPath $Project
if (-not (Test-Path $projectPath)) {
    throw "Project file not found: $projectPath. Use -Project <path-to-csproj> (default: JavManager/JavManager.csproj)."
}

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    throw "OutputRoot must not be empty."
}

$outputRootPath = Resolve-RepoPath $OutputRoot

function ToLowerBool([bool]$value) {
    return $value.ToString().ToLowerInvariant()
}

$sc = ToLowerBool $SelfContained
$single = ToLowerBool $SingleFile
$r2r = ToLowerBool $ReadyToRun
$trim = ToLowerBool $Trimmed
$includeNative = "true"
$compression = "true"
$strictSingleFile = ToLowerBool $SelfContained

if (-not $SelfContained -and $Trimmed) {
    Write-Host "PublishTrimmed requires self-contained output; disabling Trimmed for framework-dependent publish."
    $Trimmed = $false
    $trim = ToLowerBool $Trimmed
}

Write-Host "Project: $projectPath"
Write-Host "Configuration: $Configuration"
Write-Host "Output: $outputRootPath"
Write-Host "RIDs: $($RuntimeIdentifiers -join ', ')"
Write-Host "SelfContained=$sc SingleFile=$single ReadyToRun=$r2r Trimmed=$trim StrictSingleFile=$strictSingleFile"

New-Item -ItemType Directory -Force -Path $outputRootPath | Out-Null

foreach ($rid in $RuntimeIdentifiers) {
    $outDir = Join-Path $outputRootPath $rid
    if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null

    Write-Host ""
    Write-Host "Publishing $rid -> $outDir"

    dotnet publish $projectPath `
        -c $Configuration `
        -f net10.0 `
        -r $rid `
        --output $outDir `
        --self-contained $sc `
        -p:PublishSingleFile=$single `
        -p:IncludeNativeLibrariesForSelfExtract=$includeNative `
        -p:IncludeAllContentForSelfExtract=true `
        -p:EnableCompressionInSingleFile=$compression `
        -p:PublishReadyToRun=$r2r `
        -p:PublishTrimmed=$trim `
        -p:StrictSingleFileReleasePublish=$strictSingleFile `
        -p:DebugType=None

    $files = Get-ChildItem -Path $outDir -File
    if ($files.Count -ne 1) {
        throw "STRICT MODE: publish output must contain exactly 1 file. RID=$rid; Found: $($files.Name -join ', ')"
    }
    if ($rid -like "win-*" -and $files[0].Name -notlike "*.exe") {
        throw "STRICT MODE: Windows publish output must be an .exe. RID=$rid; Found: $($files[0].Name)"
    }
}

