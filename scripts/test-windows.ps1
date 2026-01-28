<#
.SYNOPSIS
    Run JavManager unit tests on Windows.
    在 Windows 上运行 JavManager 单元测试。

.DESCRIPTION
    Executes the xUnit test suite for JavManager on Windows. Optionally runs
    the JavDB connection diagnostic after tests complete.
    在 Windows 上执行 JavManager 的 xUnit 测试套件。可选在测试完成后
    运行 JavDB 连接诊断。

.PARAMETER WithJavDb
    If specified, also runs the JavDB connection diagnostic (--test-curl) after tests.
    若指定，则在测试后同时运行 JavDB 连接诊断 (--test-curl)。

.EXAMPLE
    .\test-windows.ps1
    .\test-windows.ps1 -WithJavDb
#>

param(
    [switch]$WithJavDb
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$testProject = Join-Path $repoRoot "JavManager.Tests\JavManager.Tests.csproj"
$appProject = Join-Path $repoRoot "JavManager\JavManager.csproj"

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Host "dotnet is not installed or not in PATH."
    exit 1
}

Write-Host "========================================="
Write-Host "JavManager Tests (Windows)"
Write-Host "========================================="
Write-Host "Repo: $repoRoot"
Write-Host ""

dotnet test $testProject
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($WithJavDb) {
    Write-Host ""
    Write-Host "-----------------------------------------"
    Write-Host "JavDB Connection Diagnostic (optional)"
    Write-Host "-----------------------------------------"

    dotnet run --project $appProject -- --test-curl
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "JavDB diagnostic failed (exit $LASTEXITCODE). Unit tests already ran successfully."
    }
}

