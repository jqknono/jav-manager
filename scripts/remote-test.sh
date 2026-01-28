#!/bin/bash
# =============================================================================
# remote-test.sh - Test JavManager on remote Windows/macOS machines via SSH
#                  通过 SSH 在远程 Windows/macOS 机器上测试 JavManager
#
# Description:
#   Connects to remote Windows and macOS machines via SSH to test system info,
#   curl availability, curl-impersonate installation, and JavDB connectivity.
#   Requires .env.dev file with SSH credentials (see .env.example).
#   通过 SSH 连接到远程 Windows 和 macOS 机器，测试系统信息、curl 可用性、
#   curl-impersonate 安装情况以及 JavDB 连接性。需要 .env.dev 文件包含
#   SSH 凭据（参见 .env.example）。
#
# Prerequisites:
#   - sshpass (for password-based SSH, optional)
#   - .env.dev file with JAVMANAGER_TEST_WINDOWS_SSH, JAVMANAGER_TEST_WINDOWS_PASS,
#     JAVMANAGER_TEST_MACOS_SSH, JAVMANAGER_TEST_MACOS_PASS
#
# Usage:
#   ./remote-test.sh              # Test both Windows and macOS
#   ./remote-test.sh windows      # Test Windows only
#   ./remote-test.sh macos        # Test macOS only
# =============================================================================

set -e

# Load test-only secrets from .env.dev (gitignored)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${JAVMANAGER_ENV_DEV_FILE:-$ROOT_DIR/.env.dev}"

if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
else
    echo "Missing $ENV_FILE"
    echo "Create it by copying $ROOT_DIR/.env.example to $ROOT_DIR/.env.dev and filling in values."
    exit 1
fi

WINDOWS_HOST="${JAVMANAGER_TEST_WINDOWS_SSH:-}"
WINDOWS_PASS="${JAVMANAGER_TEST_WINDOWS_PASS:-}"
MACOS_HOST="${JAVMANAGER_TEST_MACOS_SSH:-}"
MACOS_PASS="${JAVMANAGER_TEST_MACOS_PASS:-}"

if [ -z "$WINDOWS_HOST" ] || [ -z "$WINDOWS_PASS" ] || [ -z "$MACOS_HOST" ] || [ -z "$MACOS_PASS" ]; then
    echo "Missing required variables in $ENV_FILE:"
    echo "  JAVMANAGER_TEST_WINDOWS_SSH"
    echo "  JAVMANAGER_TEST_WINDOWS_PASS"
    echo "  JAVMANAGER_TEST_MACOS_SSH"
    echo "  JAVMANAGER_TEST_MACOS_PASS"
    exit 1
fi

# Test commands to run on remote
TEST_COMMANDS='
echo "=== System Info ===" && \
uname -a && \
echo "" && \
echo "=== Checking curl ===" && \
which curl && curl --version | head -1 && \
echo "" && \
echo "=== Checking curl-impersonate ===" && \
(which curl-impersonate-chrome 2>/dev/null || which curl_chrome116 2>/dev/null || echo "Not installed") && \
echo "" && \
echo "=== Testing JavDB connection ===" && \
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" --max-time 10 \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
  "https://javdb.com" 2>/dev/null || echo "Connection failed"
'

test_windows() {
    echo "========================================="
    echo "Testing Windows Remote (${WINDOWS_HOST})"
    echo "========================================="
    echo ""
    
    if command -v sshpass &> /dev/null; then
        sshpass -p "${WINDOWS_PASS}" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "${WINDOWS_HOST}" "${TEST_COMMANDS}" || echo "SSH connection failed"
    else
        echo "sshpass not installed. Manual SSH required:"
        echo "  ssh ${WINDOWS_HOST}"
        echo "  (password is stored in .env.dev)"
    fi
}

test_macos() {
    echo "========================================="
    echo "Testing macOS Remote (${MACOS_HOST})"
    echo "========================================="
    echo ""
    
    if command -v sshpass &> /dev/null; then
        sshpass -p "${MACOS_PASS}" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "${MACOS_HOST}" "${TEST_COMMANDS}" || echo "SSH connection failed"
    else
        echo "sshpass not installed. Manual SSH required:"
        echo "  ssh ${MACOS_HOST}"
        echo "  (password is stored in .env.dev)"
    fi
}

case "${1:-all}" in
    windows)
        test_windows
        ;;
    macos)
        test_macos
        ;;
    all)
        test_windows
        echo ""
        test_macos
        ;;
    *)
        echo "Usage: $0 [windows|macos|all]"
        exit 1
        ;;
esac
