<#
.SYNOPSIS
    Install JavManager standalone executable on Windows.
    在 Windows 上安装 JavManager 独立可执行文件。

.DESCRIPTION
    Copies the JavManager.exe to a local directory, creates a Start Menu shortcut,
    and optionally adds the install directory to the user's PATH.
    将 JavManager.exe 复制到本地目录，创建开始菜单快捷方式，可选将安装目录添加到用户 PATH。

.PARAMETER ExePath
    Path to JavManager.exe. If not specified, uses the latest from artifacts/publish/win-x64/.
    JavManager.exe 路径。若未指定，则使用 artifacts/publish/win-x64/ 下的文件。

.PARAMETER InstallDir
    Installation directory. Defaults to %LOCALAPPDATA%\JavManager.
    安装目录。默认为 %LOCALAPPDATA%\JavManager。

.PARAMETER AddToPath
    If specified, adds the install directory to the user's PATH environment variable.
    若指定，则将安装目录添加到用户 PATH 环境变量。

.EXAMPLE
    .\install-windows.ps1
    .\install-windows.ps1 -ExePath "C:\Downloads\JavManager.exe" -AddToPath
#>

param(
    [string]$ExePath = "",
    [string]$InstallDir = "",
    [switch]$AddToPath
)

$ErrorActionPreference = "Stop"

function Get-PublishedExe {
    $publishDir = Join-Path $PSScriptRoot "..\artifacts\publish\win-x64"
    $exePath = Join-Path $publishDir "JavManager.exe"
    if (Test-Path $exePath) { return $exePath }
    return $null
}

if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    $InstallDir = Join-Path $env:LOCALAPPDATA "JavManager"
}

if ([string]::IsNullOrWhiteSpace($ExePath)) {
    $ExePath = Get-PublishedExe
    if ($ExePath -eq $null) {
        throw "未找到 JavManager.exe。请先运行: pwsh scripts\publish.ps1 -RuntimeIdentifiers @('win-x64')"
    }
}
else {
    if (!(Test-Path $ExePath)) {
        throw "ExePath 不存在: $ExePath"
    }
}

Write-Host "源文件: $ExePath"
Write-Host "安装目录: $InstallDir"

if (Test-Path $InstallDir) {
    Remove-Item -Recurse -Force $InstallDir
}
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Copy-Item -Path $ExePath -Destination (Join-Path $InstallDir "JavManager.exe") -Force

$cmdShim = Join-Path $InstallDir "javmanager.cmd"
Set-Content -Path $cmdShim -Encoding ASCII -Value "@echo off`r`n`"%~dp0JavManager.exe`" %*`r`n"

$startMenuDir = [Environment]::GetFolderPath("Programs")
$shortcutPath = Join-Path $startMenuDir "JavManager.lnk"
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = (Join-Path $InstallDir "JavManager.exe")
$shortcut.WorkingDirectory = $InstallDir
$shortcut.Description = "JavManager"
$shortcut.Save()

if ($AddToPath.IsPresent) {
    $envKey = "HKCU:\Environment"
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
Write-Host "可运行: `"$InstallDir\javmanager.cmd`" -- help"
