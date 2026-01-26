param(
    [string]$Project = "JavManager/JavManager.csproj",
    [string]$Configuration = "Release",
    [string]$PublishRoot = "artifacts/publish",
    [string]$PackageRoot = "artifacts/packages",
    [string[]]$RuntimeIdentifiers = @("win-x64"),
    [bool]$SelfContained = $true,
    [bool]$SingleFile = $true,
    [bool]$ReadyToRun = $true,
    [bool]$Trimmed = $false
)

$ErrorActionPreference = "Stop"

function ToLowerBool([bool]$value) {
    return $value.ToString().ToLowerInvariant()
}

function Get-RepoVersion {
    $propsPath = Join-Path $PSScriptRoot "..\\Directory.Build.props"
    if (!(Test-Path $propsPath)) { return "unknown" }

    try {
        [xml]$xml = Get-Content $propsPath -Raw
        $version = $xml.Project.PropertyGroup.Version
        if ($version -is [array]) { $version = $version[0] }
        if ([string]::IsNullOrWhiteSpace($version)) { return "unknown" }
        return $version.Trim()
    }
    catch {
        return "unknown"
    }
}

$sc = ToLowerBool $SelfContained
$single = ToLowerBool $SingleFile
$r2r = ToLowerBool $ReadyToRun
$trim = ToLowerBool $Trimmed
$version = Get-RepoVersion
$appName = "JavManager"

Write-Host "Project: $Project"
Write-Host "Configuration: $Configuration"
Write-Host "Publish: $PublishRoot"
Write-Host "Packages: $PackageRoot"
Write-Host "RIDs: $($RuntimeIdentifiers -join ', ')"
Write-Host "Version: $version"
Write-Host "SelfContained=$sc SingleFile=$single ReadyToRun=$r2r Trimmed=$trim"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

New-Item -ItemType Directory -Force -Path $PublishRoot | Out-Null
New-Item -ItemType Directory -Force -Path $PackageRoot | Out-Null

$PublishRoot = (Resolve-Path $PublishRoot).Path
$PackageRoot = (Resolve-Path $PackageRoot).Path

$stagingRoot = Join-Path $PackageRoot "_staging"
if (Test-Path $stagingRoot) { Remove-Item -Recurse -Force $stagingRoot }
New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null

foreach ($rid in $RuntimeIdentifiers) {
    $outDir = Join-Path $PublishRoot $rid
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
        -p:IncludeNativeLibrariesForSelfExtract=true `
        -p:IncludeAllContentForSelfExtract=true `
        -p:EnableCompressionInSingleFile=true `
        -p:PublishReadyToRun=$r2r `
        -p:PublishTrimmed=$trim `
        -p:DebugType=None

    $packageName = "$appName-$version-$rid"
    $stagingDir = Join-Path $stagingRoot $packageName
    New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

    Copy-Item -Path (Join-Path $outDir "*") -Destination $stagingDir -Recurse -Force

    $readmePath = Join-Path $repoRoot "README.md"
    if (Test-Path $readmePath) {
        Copy-Item -Path $readmePath -Destination $stagingDir -Force
    }

    $zipPath = Join-Path $PackageRoot "$packageName.zip"
    if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

    Push-Location $stagingRoot
    try {
        Compress-Archive -Path $packageName -DestinationPath $zipPath
    }
    finally {
        Pop-Location
    }

    Write-Host "Created: $zipPath"
}
