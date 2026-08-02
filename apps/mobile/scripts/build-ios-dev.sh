#!/usr/bin/env bash

set -euo pipefail

MOBILE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_STAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_ROOT="${MOBILE_ROOT}/dist"
ARCHIVE_PATH="${OUTPUT_ROOT}/ios-dev-${BUILD_STAMP}.xcarchive"
EXPORT_PATH="${OUTPUT_ROOT}/ios-dev-${BUILD_STAMP}"
EXPORT_OPTIONS_PATH="${MOBILE_ROOT}/scripts/ios-dev-export-options.plist"

mkdir -p "${OUTPUT_ROOT}"

xcodebuild \
  -workspace "${MOBILE_ROOT}/ios/T.xcworkspace" \
  -scheme T \
  -configuration Release \
  -sdk iphoneos \
  -destination "generic/platform=iOS" \
  -archivePath "${ARCHIVE_PATH}" \
  -allowProvisioningUpdates \
  archive

xcodebuild \
  -exportArchive \
  -archivePath "${ARCHIVE_PATH}" \
  -exportPath "${EXPORT_PATH}" \
  -exportOptionsPlist "${EXPORT_OPTIONS_PATH}" \
  -allowProvisioningUpdates

IPA_PATH="$(find "${EXPORT_PATH}" -maxdepth 1 -type f -name '*.ipa' -print -quit)"
if [[ -z "${IPA_PATH}" ]]; then
  echo "iOS IPA export failed: no IPA found in ${EXPORT_PATH}" >&2
  exit 1
fi

echo "iOS archive: ${ARCHIVE_PATH}"
echo "iOS IPA: ${IPA_PATH}"
