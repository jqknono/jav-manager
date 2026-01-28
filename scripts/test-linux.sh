#!/usr/bin/env bash
# =============================================================================
# test-linux.sh - Run JavManager unit tests on Linux
#                 在 Linux 上运行 JavManager 单元测试
#
# Description:
#   Executes the xUnit test suite for JavManager on Linux. Optionally runs
#   the JavDB connection diagnostic after tests complete.
#   在 Linux 上执行 JavManager 的 xUnit 测试套件。可选在测试完成后
#   运行 JavDB 连接诊断。
#
# Options:
#   --with-javdb    Also run JavDB connection diagnostic after tests
#                   测试后同时运行 JavDB 连接诊断
#   -h, --help      Show usage information
#
# Prerequisites:
#   - .NET SDK installed
#
# Usage:
#   ./test-linux.sh
#   ./test-linux.sh --with-javdb
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WITH_JAVDB=false

usage() {
  echo "Usage: $0 [--with-javdb]"
}

for arg in "$@"; do
  case "${arg}" in
    --with-javdb)
      WITH_JAVDB=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: ${arg}" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! command -v dotnet >/dev/null 2>&1; then
  echo "dotnet is not installed or not in PATH." >&2
  exit 1
fi

echo "========================================="
echo "JavManager Tests (Linux)"
echo "========================================="
echo "Repo: ${ROOT_DIR}"
echo ""

dotnet test "${ROOT_DIR}/JavManager.Tests/JavManager.Tests.csproj"

if [[ "${WITH_JAVDB}" == "true" ]]; then
  echo ""
  echo "-----------------------------------------"
  echo "JavDB Connection Diagnostic (optional)"
  echo "-----------------------------------------"
  set +e
  dotnet run --project "${ROOT_DIR}/JavManager/JavManager.csproj" -- --test-curl
  exit_code=$?
  set -e
  if [[ ${exit_code} -ne 0 ]]; then
    echo ""
    echo "JavDB diagnostic failed (exit ${exit_code}). Unit tests already ran successfully."
  fi
fi

