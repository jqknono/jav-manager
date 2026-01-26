#!/usr/bin/env bash
set -euo pipefail

PROJECT="${PROJECT:-JavManager/JavManager.csproj}"
CONFIGURATION="${CONFIGURATION:-Release}"
OUTPUT_ROOT="${OUTPUT_ROOT:-artifacts/publish}"
SELF_CONTAINED="${SELF_CONTAINED:-true}"
SINGLE_FILE="${SINGLE_FILE:-true}"
READY_TO_RUN="${READY_TO_RUN:-true}"
TRIMMED="${TRIMMED:-false}"

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
echo "SelfContained=${SELF_CONTAINED} SingleFile=${SINGLE_FILE} ReadyToRun=${READY_TO_RUN} Trimmed=${TRIMMED}"

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
    -p:IncludeNativeLibrariesForSelfExtract=true \
    -p:IncludeAllContentForSelfExtract=true \
    -p:EnableCompressionInSingleFile=true \
    -p:PublishReadyToRun="${READY_TO_RUN}" \
    -p:PublishTrimmed="${TRIMMED}" \
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

