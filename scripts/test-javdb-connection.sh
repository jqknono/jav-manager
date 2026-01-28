#!/bin/bash
# =============================================================================
# test-javdb-connection.sh - Test JavDB connection and diagnose Cloudflare issues
#                            测试 JavDB 连接并诊断 Cloudflare 问题
#
# Description:
#   Runs the built-in JavDB connection diagnostic (--test-curl) to verify
#   that the application can successfully connect to JavDB and bypass
#   Cloudflare protection.
#   运行内置的 JavDB 连接诊断 (--test-curl)，验证应用程序能否成功连接
#   JavDB 并绕过 Cloudflare 保护。
#
# Prerequisites:
#   - .NET SDK installed
#
# Usage:
#   ./test-javdb-connection.sh
# =============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "========================================="
echo "JavDB Connection Test (Internal)"
echo "========================================="
echo ""

if ! command -v dotnet &> /dev/null; then
    echo "dotnet is not installed or not in PATH."
    exit 1
fi

dotnet run --project "$ROOT_DIR/JavManager/JavManager.csproj" -- --test-curl
