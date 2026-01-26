param(
    [string]$Project = "JavManager/JavManager.csproj",
    [string]$Configuration = "Release",
    [string]$OutputRoot = "artifacts/publish",
    [string[]]$RuntimeIdentifiers = @("win-x64", "linux-x64", "linux-arm64", "osx-x64", "osx-arm64"),
    [bool]$SelfContained = $true,
    [bool]$SingleFile = $true,
    [bool]$ReadyToRun = $true,
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

Write-Host "Project: $Project"
Write-Host "Configuration: $Configuration"
Write-Host "Output: $OutputRoot"
Write-Host "RIDs: $($RuntimeIdentifiers -join ', ')"
Write-Host "SelfContained=$sc SingleFile=$single ReadyToRun=$r2r Trimmed=$trim"

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
        -p:IncludeNativeLibrariesForSelfExtract=true `
        -p:IncludeAllContentForSelfExtract=true `
        -p:EnableCompressionInSingleFile=true `
        -p:PublishReadyToRun=$r2r `
        -p:PublishTrimmed=$trim `
        -p:DebugType=None

    $files = Get-ChildItem -Path $outDir -File
    if ($files.Count -ne 1) {
        throw "STRICT MODE: publish output must contain exactly 1 file. RID=$rid; Found: $($files.Name -join ', ')"
    }
    if ($rid -like "win-*" -and $files[0].Name -notlike "*.exe") {
        throw "STRICT MODE: Windows publish output must be an .exe. RID=$rid; Found: $($files[0].Name)"
    }
}

