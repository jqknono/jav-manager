param(
    [string]$PackagePath = "",
    [string]$InstallDir = "",
    [switch]$AddToPath
)

$ErrorActionPreference = "Stop"

function Get-LatestWinX64Package {
    $packagesDir = Join-Path $PSScriptRoot "..\\artifacts\\packages"
    if (!(Test-Path $packagesDir)) { return $null }
    return Get-ChildItem -Path $packagesDir -Filter "JavManager-*-win-x64.zip" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
}

if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    $InstallDir = Join-Path $env:LOCALAPPDATA "JavManager"
}

$package = $null
if ([string]::IsNullOrWhiteSpace($PackagePath)) {
    $package = Get-LatestWinX64Package
    if ($package -eq $null) {
        throw "未找到 win-x64 包。请先运行: pwsh scripts\\package.ps1 -RuntimeIdentifiers win-x64"
    }
    $PackagePath = $package.FullName
}
else {
    if (!(Test-Path $PackagePath)) {
        throw "PackagePath 不存在: $PackagePath"
    }
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("JavManagerInstall_" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

try {
    Expand-Archive -Path $PackagePath -DestinationPath $tempRoot -Force

    $topDirs = Get-ChildItem -Path $tempRoot -Directory | Select-Object -First 1
    if ($topDirs -eq $null) {
        throw "安装包内容异常（缺少顶层目录）: $PackagePath"
    }

    $sourceDir = $topDirs.FullName
    $exePath = Join-Path $sourceDir "JavManager.exe"
    if (!(Test-Path $exePath)) {
        throw "安装包内容异常（未找到 JavManager.exe）: $PackagePath"
    }

    if (Test-Path $InstallDir) {
        Remove-Item -Recurse -Force $InstallDir
    }
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

    Copy-Item -Path (Join-Path $sourceDir "*") -Destination $InstallDir -Recurse -Force

    $cmdShim = Join-Path $InstallDir "javmanager.cmd"
    Set-Content -Path $cmdShim -Encoding ASCII -Value "@echo off`r`n\"%~dp0JavManager.exe\" %*`r`n"

    $startMenuDir = [Environment]::GetFolderPath("Programs")
    $shortcutPath = Join-Path $startMenuDir "JavManager.lnk"
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = (Join-Path $InstallDir "JavManager.exe")
    $shortcut.WorkingDirectory = $InstallDir
    $shortcut.Description = "JavManager"
    $shortcut.Save()

    if ($AddToPath.IsPresent) {
        $envKey = "HKCU:\\Environment"
        $current = (Get-ItemProperty -Path $envKey -Name Path -ErrorAction SilentlyContinue).Path
        if ([string]::IsNullOrWhiteSpace($current)) {
            $newPath = $InstallDir
        }
        else {
            $parts = $current.Split(';') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
            if ($parts -contains $InstallDir) {
                $newPath = $current
            }
            else {
                $newPath = "$current;$InstallDir"
            }
        }

        Set-ItemProperty -Path $envKey -Name Path -Value $newPath
        Write-Host "已写入用户 PATH（新终端/新会话后生效）: $InstallDir"
    }

    Write-Host "安装完成: $InstallDir"
    Write-Host "可运行: `"$InstallDir\\javmanager.cmd`" -- help"
}
finally {
    if (Test-Path $tempRoot) {
        Remove-Item -Recurse -Force $tempRoot
    }
}

