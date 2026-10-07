#!/usr/bin/env bash

set -euo pipefail

export APP_VARIANT=dev
export APP_PLATFORM=ios
export MOBILE_ENV_PROFILE=development

MOBILE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "${MOBILE_ROOT}/../.." && pwd)"
source "${PROJECT_ROOT}/scripts/terminal-progress.sh"
BUILD_STAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_ROOT="${MOBILE_ROOT}/dist"
ARCHIVE_PATH="${OUTPUT_ROOT}/ios-dev-${BUILD_STAMP}.xcarchive"
EXPORT_PATH="${OUTPUT_ROOT}/ios-dev-${BUILD_STAMP}"
EXPORT_OPTIONS_PATH="${MOBILE_ROOT}/scripts/ios-dev-export-options.plist"
LOG_PATH="${IOS_BUILD_LOG_PATH:-${OUTPUT_ROOT}/ios-dev-${BUILD_STAMP}.log}"

mkdir -p "${OUTPUT_ROOT}"

touch "${LOG_PATH}"

# Xcode는 전체 진행률을 제공하지 않으므로 완료가 확인된 빌드 구간만 퍼센트로 표시한다.
print_failure() {
  local step_label="$1"

  printf '\n✗ %s 실패\n' "${step_label}" >&2
  printf '%s\n' '--- 핵심 오류 ---' >&2

  local error_lines
  error_lines="$(grep -Ei '(^|[[:space:]])error:|fatal error|archive failed|export failed|command .* failed' "${LOG_PATH}" | tail -n 30 || true)"

  if [[ -n "${error_lines}" ]]; then
    printf '%s\n' "${error_lines}" >&2
  else
    tail -n 80 "${LOG_PATH}" >&2
  fi

  printf '%s\n' '-----------------' >&2
  printf '전체 로그: %s\n' "${LOG_PATH}" >&2
}

if ! terminal_progress_run \
  45 \
  90 \
  'iOS 앱 아카이브 생성' \
  "${LOG_PATH}" \
  node "${MOBILE_ROOT}/scripts/run-with-mobile-env.js" dev xcodebuild \
  -workspace "${MOBILE_ROOT}/ios/dailoT.xcworkspace" \
  -scheme dailoT \
  -configuration Release \
  -sdk iphoneos \
  -destination "generic/platform=iOS" \
  -archivePath "${ARCHIVE_PATH}" \
  -allowProvisioningUpdates \
  archive; then
  print_failure 'iOS 앱 아카이브 생성'
  exit 1
fi

if ! terminal_progress_run \
  92 \
  98 \
  'IPA 파일 내보내기' \
  "${LOG_PATH}" \
  node "${MOBILE_ROOT}/scripts/run-with-mobile-env.js" dev xcodebuild \
  -exportArchive \
  -archivePath "${ARCHIVE_PATH}" \
  -exportPath "${EXPORT_PATH}" \
  -exportOptionsPlist "${EXPORT_OPTIONS_PATH}" \
  -allowProvisioningUpdates; then
  print_failure 'IPA 파일 내보내기'
  exit 1
fi

IPA_PATH="$(find "${EXPORT_PATH}" -maxdepth 1 -type f -name '*.ipa' -print -quit)"
if [[ -z "${IPA_PATH}" ]]; then
  terminal_progress_newline
  echo "iOS IPA export failed: no IPA found in ${EXPORT_PATH}" >&2
  exit 1
fi

terminal_progress_finish 'iOS 개발 빌드 완료'
printf '아카이브: %s\n' "${ARCHIVE_PATH}"
printf 'IPA: %s\n' "${IPA_PATH}"
printf '빌드 로그: %s\n' "${LOG_PATH}"
