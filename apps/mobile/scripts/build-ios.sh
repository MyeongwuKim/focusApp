#!/usr/bin/env bash

set -euo pipefail

# 선택한 환경 파일을 Xcode archive·export 작업까지 전달하며 두 환경 모두 Release로 빌드한다.
BUILD_VARIANT="${1:-dev}"
case "${BUILD_VARIANT}" in
  dev)
    export MOBILE_ENV_PROFILE=development
    BUILD_LABEL='개발'
    ;;
  prod)
    export MOBILE_ENV_PROFILE=prod
    BUILD_LABEL='프로덕션'
    ;;
  *)
    printf '지원하지 않는 iOS 빌드 환경: %s (dev 또는 prod 사용)\n' "${BUILD_VARIANT}" >&2
    exit 1
    ;;
esac
export APP_VARIANT="${BUILD_VARIANT}"
export APP_PLATFORM=ios

MOBILE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "${MOBILE_ROOT}/../.." && pwd)"
# 네이티브 동기화에서 선택한 환경의 프로젝트·스킴 이름을 그대로 사용한다.
IOS_PROJECT_NAME="$(node -e 'const config = require(process.argv[1]); console.log(config[process.argv[2] === "prod" ? "prod" : "test"].projectName);' "${MOBILE_ROOT}/native.config.json" "${BUILD_VARIANT}")"
source "${PROJECT_ROOT}/scripts/terminal-progress.sh"
BUILD_STAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_ROOT="${MOBILE_ROOT}/dist"
ARCHIVE_PATH="${OUTPUT_ROOT}/ios-${BUILD_VARIANT}-${BUILD_STAMP}.xcarchive"
EXPORT_PATH="${OUTPUT_ROOT}/ios-${BUILD_VARIANT}-${BUILD_STAMP}"
# dev와 동일한 기기 설치용 IPA를 내보낸다. App Store 제출은 별도의 :expo 명령에서 수행한다.
EXPORT_OPTIONS_PATH="${MOBILE_ROOT}/scripts/ios-local-export-options.plist"
LOG_PATH="${IOS_BUILD_LOG_PATH:-${OUTPUT_ROOT}/ios-${BUILD_VARIANT}-${BUILD_STAMP}.log}"

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
  node "${MOBILE_ROOT}/scripts/run-with-mobile-env.js" "${BUILD_VARIANT}" xcodebuild \
  -workspace "${MOBILE_ROOT}/ios/${IOS_PROJECT_NAME}.xcworkspace" \
  -scheme "${IOS_PROJECT_NAME}" \
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
  node "${MOBILE_ROOT}/scripts/run-with-mobile-env.js" "${BUILD_VARIANT}" xcodebuild \
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

terminal_progress_finish "iOS ${BUILD_LABEL} 빌드 완료"
printf '아카이브: %s\n' "${ARCHIVE_PATH}"
printf 'IPA: %s\n' "${IPA_PATH}"
printf '빌드 로그: %s\n' "${LOG_PATH}"
