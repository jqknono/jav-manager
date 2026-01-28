#!/usr/bin/env bash
# =============================================================================
# publish.sh - Publish JavManager for multiple platforms
#              为多个平台发布 JavManager 独立单文件可执行程序
#
# Description:
#   Builds JavManager for each specified runtime identifier (RID) with strict
#   validation: each output must contain exactly one executable file.
#   Outputs to artifacts/publish/<rid>/.
#   为每个指定的运行时标识符 (RID) 构建 JavManager，严格验证：
#   每个输出必须仅包含一个可执行文件。输出到 artifacts/publish/<rid>/。
#
# Environment Variables:
#   PROJECT        - Project file path (default: JavManager/JavManager.csproj)
#   CONFIGURATION  - Build configuration (default: Release)
#   OUTPUT_ROOT    - Output directory (default: artifacts/publish)
#   SELF_CONTAINED - Self-contained build (default: true)
#   SINGLE_FILE    - Single file output (default: true)
#   READY_TO_RUN   - Ready to run compilation (default: false)
#   TRIMMED        - Enable trimming (default: false)
#
# Usage:
#   ./publish.sh
# =============================================================================
set -euo pipefail

PROJECT="${PROJECT:-JavManager/JavManager.csproj}"
CONFIGURATION="${CONFIGURATION:-Release}"
OUTPUT_ROOT="${OUTPUT_ROOT:-artifacts/publish}"
SELF_CONTAINED="${SELF_CONTAINED:-true}"
SINGLE_FILE="${SINGLE_FILE:-true}"
READY_TO_RUN="${READY_TO_RUN:-false}"
TRIMMED="${TRIMMED:-false}"

if [[ "${SELF_CONTAINED}" != "true" && "${TRIMMED}" == "true" ]]; then
  echo "PublishTrimmed requires self-contained output; disabling TRIMMED for framework-dependent publish."
  TRIMMED="false"
fi

INCLUDE_NATIVE_LIBS="true"
if [[ "${SELF_CONTAINED}" == "true" ]]; then
  ENABLE_COMPRESSION="true"
  STRICT_SINGLE_FILE="true"
else
  ENABLE_COMPRESSION="false"
  STRICT_SINGLE_FILE="false"
fi

RIDS=(
  "win-x64"
  "linux-x64"
  "linux-arm64"
  "osx-x64"
  "osx-arm64"
)

echo "Project: ${PROJECT}"
echo "Configuration: ${CONFIGURATION}"
echo "Output: ${OUTPUT_ROOT}"
echo "RIDs: ${RIDS[*]}"
echo "SelfContained=${SELF_CONTAINED} SingleFile=${SINGLE_FILE} ReadyToRun=${READY_TO_RUN} Trimmed=${TRIMMED} StrictSingleFile=${STRICT_SINGLE_FILE}"

mkdir -p "${OUTPUT_ROOT}"

for rid in "${RIDS[@]}"; do
  out_dir="${OUTPUT_ROOT}/${rid}"
  rm -rf "${out_dir}"
  mkdir -p "${out_dir}"

  echo ""
  echo "Publishing ${rid} -> ${out_dir}"

  dotnet publish "${PROJECT}" \
    -c "${CONFIGURATION}" \
    -r "${rid}" \
    --output "${out_dir}" \
    --self-contained "${SELF_CONTAINED}" \
    -p:PublishSingleFile="${SINGLE_FILE}" \
    -p:IncludeNativeLibrariesForSelfExtract="${INCLUDE_NATIVE_LIBS}" \
    -p:IncludeAllContentForSelfExtract=true \
    -p:EnableCompressionInSingleFile="${ENABLE_COMPRESSION}" \
    -p:PublishReadyToRun="${READY_TO_RUN}" \
    -p:PublishTrimmed="${TRIMMED}" \
    -p:StrictSingleFileReleasePublish="${STRICT_SINGLE_FILE}" \
    -p:DebugType=None

  if [[ "${rid}" == win-* ]]; then
    expected="JavManager.exe"
  else
    expected="JavManager"
  fi

  shopt -s nullglob
  files=("${out_dir}"/*)
  real_files=()
  for f in "${files[@]}"; do
    if [[ -f "${f}" ]]; then
      real_files+=("${f}")
    fi
  done

  if (( ${#real_files[@]} != 1 )); then
    echo "STRICT MODE: publish output must contain exactly 1 file. RID=${rid}; Found ${#real_files[@]} files." >&2
    ls -la "${out_dir}" >&2
    exit 1
  fi

  if [[ "$(basename "${real_files[0]}")" != "${expected}" ]]; then
    echo "STRICT MODE: publish output must contain only ${expected}, but got $(basename "${real_files[0]}"). RID=${rid}" >&2
    ls -la "${out_dir}" >&2
    exit 1
  fi
done

