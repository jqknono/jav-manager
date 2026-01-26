#!/usr/bin/env bash
set -euo pipefail

PROJECT="${PROJECT:-JavManager/JavManager.csproj}"
CONFIGURATION="${CONFIGURATION:-Release}"
PUBLISH_ROOT="${PUBLISH_ROOT:-artifacts/publish}"
PACKAGE_ROOT="${PACKAGE_ROOT:-artifacts/packages}"
SELF_CONTAINED="${SELF_CONTAINED:-true}"
SINGLE_FILE="${SINGLE_FILE:-true}"
READY_TO_RUN="${READY_TO_RUN:-true}"
TRIMMED="${TRIMMED:-false}"

RIDS=(
  "win-x64"
)

VERSION="$(sed -n 's:.*<Version>\\(.*\\)</Version>.*:\\1:p' Directory.Build.props | head -n 1 || true)"
if [[ -z "${VERSION}" ]]; then VERSION="unknown"; fi

APP_NAME="JavManager"

echo "Project: ${PROJECT}"
echo "Configuration: ${CONFIGURATION}"
echo "Publish: ${PUBLISH_ROOT}"
echo "Packages: ${PACKAGE_ROOT}"
echo "RIDs: ${RIDS[*]}"
echo "Version: ${VERSION}"
echo "SelfContained=${SELF_CONTAINED} SingleFile=${SINGLE_FILE} ReadyToRun=${READY_TO_RUN} Trimmed=${TRIMMED}"

mkdir -p "${PUBLISH_ROOT}"
mkdir -p "${PACKAGE_ROOT}"

STAGING_ROOT="${PACKAGE_ROOT}/_staging"
rm -rf "${STAGING_ROOT}"
mkdir -p "${STAGING_ROOT}"

for rid in "${RIDS[@]}"; do
  out_dir="${PUBLISH_ROOT}/${rid}"
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

  package_name="${APP_NAME}-${VERSION}-${rid}"
  staging_dir="${STAGING_ROOT}/${package_name}"
  mkdir -p "${staging_dir}"

  cp -a "${out_dir}/." "${staging_dir}/"
  if [[ -f "README.md" ]]; then
    cp -a "README.md" "${staging_dir}/README.md"
  fi

  archive_path="${PACKAGE_ROOT}/${package_name}.tar.gz"
  rm -f "${archive_path}"

  tar -czf "${archive_path}" -C "${STAGING_ROOT}" "${package_name}"

  echo "Created: ${archive_path}"
done
