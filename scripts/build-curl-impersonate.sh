#!/usr/bin/env bash
# =============================================================================
# build-curl-impersonate.sh
#
# Build and vendor libcurl-impersonate for supported RIDs.
#
# - Linux/macOS: build from source (git submodule) and copy shared library (.so/.dylib)
#
# Usage:
#   bash scripts/build-curl-impersonate.sh <rid>
#
# Examples:
#   bash scripts/build-curl-impersonate.sh linux-x64
#   bash scripts/build-curl-impersonate.sh osx-arm64
# =============================================================================
set -euo pipefail

RID="${1:-${RID:-}}"
if [[ -z "${RID}" ]]; then
  echo "Usage: $(basename "$0") <rid>" >&2
  exit 2
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${CURL_IMPERSONATE_SRC_DIR:-"${ROOT_DIR}/third_party/curl-impersonate"}"
DEST_ROOT="${CURL_IMPERSONATE_DEST_ROOT:-"${ROOT_DIR}/JavManager/native/curl-impersonate"}"

if [[ ! -f "${SRC_DIR}/configure" ]]; then
  echo "curl-impersonate submodule not found at: ${SRC_DIR}" >&2
  echo "Run: git submodule update --init --recursive" >&2
  exit 1
fi

download_cacert() {
  local dest_dir="$1"
  curl -fsSL -o "${dest_dir}/cacert.pem" "https://curl.se/ca/cacert.pem"
}

build_from_source_native() {
  local rid="$1"

  local os arch expected_os expected_arch
  os="$(uname -s)"
  arch="$(uname -m)"

  expected_os=""
  expected_arch=""

  case "${rid}" in
    linux-x64)
      expected_os="Linux"
      expected_arch="x86_64"
      ;;
    linux-arm64)
      expected_os="Linux"
      expected_arch="aarch64"
      if [[ "${arch}" == "arm64" ]]; then
        arch="aarch64"
      fi
      ;;
    osx-x64)
      expected_os="Darwin"
      expected_arch="x86_64"
      ;;
    osx-arm64)
      expected_os="Darwin"
      expected_arch="arm64"
      ;;
    *)
      echo "Unsupported RID for native build: ${rid}" >&2
      exit 2
      ;;
  esac

  if [[ "${os}" != "${expected_os}" ]]; then
    echo "Host OS mismatch. RID=${rid} requires ${expected_os} but uname -s=${os}" >&2
    exit 1
  fi

  if [[ "${arch}" != "${expected_arch}" ]]; then
    echo "Host architecture mismatch. RID=${rid} requires ${expected_arch} but uname -m=${arch}" >&2
    exit 1
  fi

  local tmp_base build_dir install_dir
  tmp_base="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
  build_dir="$(mktemp -d "${tmp_base%/}/curl-impersonate-build-${rid}-XXXXXX")"
  install_dir="${build_dir}/install"
  mkdir -p "${install_dir}"

  cleanup() { rm -rf "${build_dir}" || true; }
  trap cleanup EXIT

  local make_cmd jobs
  make_cmd="make"
  if [[ "${os}" == "Darwin" ]] && command -v gmake >/dev/null 2>&1; then
    make_cmd="gmake"
  fi

  jobs="1"
  if command -v nproc >/dev/null 2>&1; then
    jobs="$(nproc)"
  elif [[ "${os}" == "Darwin" ]]; then
    jobs="$(sysctl -n hw.ncpu 2>/dev/null || echo "1")"
  fi

  local configure_args
  configure_args=( "--prefix=${install_dir}" )
  if [[ "${os}" == "Linux" ]]; then
    configure_args+=(
      "--with-ca-path=/etc/ssl/certs"
      "--with-ca-bundle=/etc/ssl/certs/ca-certificates.crt"
    )
  fi

  pushd "${build_dir}" >/dev/null
  "${SRC_DIR}/configure" "${configure_args[@]}"
  "${make_cmd}" -j "${jobs}" build
  "${make_cmd}" install
  popd >/dev/null

  local dest_dir
  dest_dir="${DEST_ROOT}/${rid}"
  rm -rf "${dest_dir}"
  mkdir -p "${dest_dir}"

  if [[ "${os}" == "Linux" ]]; then
    local src_lib
    src_lib="${install_dir}/lib/libcurl-impersonate.so"
    if [[ ! -e "${src_lib}" ]]; then
      echo "Expected shared library not found: ${src_lib}" >&2
      exit 1
    fi
    cp -L "${src_lib}" "${dest_dir}/libcurl-impersonate.so"
  else
    local src_lib
    src_lib="${install_dir}/lib/libcurl-impersonate.dylib"
    if [[ ! -e "${src_lib}" ]]; then
      local candidates
      candidates=( "${install_dir}/lib/libcurl-impersonate"*.dylib )
      if [[ "${#candidates[@]}" -eq 0 ]] || [[ ! -e "${candidates[0]}" ]]; then
        echo "Expected shared library not found under: ${install_dir}/lib" >&2
        exit 1
      fi
      src_lib="${candidates[0]}"
    fi
    cp -L "${src_lib}" "${dest_dir}/libcurl-impersonate.dylib"
  fi

  download_cacert "${dest_dir}"
  echo "Vendored -> ${dest_dir}"
}

case "${RID}" in
  linux-*|osx-*)
    build_from_source_native "${RID}"
    ;;
  *)
    echo "Unsupported RID: ${RID}" >&2
    exit 2
    ;;
esac

