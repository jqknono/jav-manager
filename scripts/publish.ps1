<#
.SYNOPSIS
    Publish JavManager for multiple platforms as self-contained single-file executables.
    为多个平台发布 JavManager 独立单文件可执行程序。

.DESCRIPTION
    Builds JavManager for each specified runtime identifier (RID) with strict validation:
    each output must contain exactly one executable file. Outputs to artifacts/publish/<rid>/.
    为每个指定的运行时标识符 (RID) 构建 JavManager，严格验证：
    每个输出必须仅包含一个可执行文件。输出到 artifacts/publish/<rid>/。

.PARAMETER Project
    Path to the project file. Default: JavManager/JavManager.csproj
    项目文件路径。默认：JavManager/JavManager.csproj

.PARAMETER RuntimeIdentifiers
    Array of runtime identifiers. Default: win-x64, linux-x64, linux-arm64, osx-x64, osx-arm64
    运行时标识符数组。默认：win-x64, linux-x64, linux-arm64, osx-x64, osx-arm64

.EXAMPLE
    .\publish.ps1
    .\publish.ps1 -RuntimeIdentifiers @("win-x64", "linux-x64")
#>

param(
    [string]$Project = "JavManager/JavManager.csproj",
    [string]$Configuration = "Release",
    [string]$OutputRoot = "artifacts/publish",
    [string[]]$RuntimeIdentifiers = @("win-x64", "linux-x64", "linux-arm64", "osx-x64", "osx-arm64"),
    [bool]$SelfContained = $true,
    [bool]$SingleFile = $true,
    [bool]$ReadyToRun = $false,
    [bool]$Trimmed = $false
)

$ErrorActionPreference = "Stop"

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

Write-Host "Project: $Project"
Write-Host "Configuration: $Configuration"
Write-Host "Output: $OutputRoot"
Write-Host "RIDs: $($RuntimeIdentifiers -join ', ')"
Write-Host "SelfContained=$sc SingleFile=$single ReadyToRun=$r2r Trimmed=$trim StrictSingleFile=$strictSingleFile"

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

foreach ($rid in $RuntimeIdentifiers) {
    $outDir = Join-Path $OutputRoot $rid
    if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null

    Write-Host ""
    Write-Host "Publishing $rid -> $outDir"

    dotnet publish $Project `
        -c $Configuration `
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

