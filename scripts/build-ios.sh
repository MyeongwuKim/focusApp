#!/usr/bin/env bash

set -uo pipefail

# dev·prod 로컬 빌드는 local·device의 base 프로필을 상속하지 않고 각각의 환경을 선택한다.
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

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_ROOT="${PROJECT_ROOT}/apps/mobile"
source "${PROJECT_ROOT}/scripts/terminal-progress.sh"
BUILD_STAMP="$(date +%Y%m%d-%H%M%S)"
LOG_ROOT="${MOBILE_ROOT}/dist/logs"
LOG_PATH="${LOG_ROOT}/ios-${BUILD_VARIANT}-${BUILD_STAMP}.log"

# 질문은 출력이 로그로 향하거나 백그라운드 작업이 시작되기 전에 실제 터미널에서 받는다.
# 거절하면 설정·웹 빌드·아카이브 생성 단계까지 진행하지 않는다.
env APP_PLATFORM=ios node "${MOBILE_ROOT}/scripts/sync-native-config.js" "${BUILD_VARIANT}" --confirm-only || exit "$?"

mkdir -p "${LOG_ROOT}"
: > "${LOG_PATH}"

# 평소에는 단계만 표시하고, 실패한 경우에만 원인 후보와 전체 로그 위치를 노출한다.
print_failure() {
  local step_label="$1"

  printf '\n✗ %s 실패\n' "${step_label}" >&2
  printf '%s\n' '--- 핵심 오류 ---' >&2

  local error_lines
  error_lines="$(grep -Ei '(^|[[:space:]])error:|fatal error|archive failed|export failed|command .* failed|ERR_PNPM|ELIFECYCLE' "${LOG_PATH}" | tail -n 30 || true)"

  if [[ -n "${error_lines}" ]]; then
    printf '%s\n' "${error_lines}" >&2
  else
    tail -n 80 "${LOG_PATH}" >&2
  fi

  printf '%s\n' '-----------------' >&2
  printf '전체 로그: %s\n' "${LOG_PATH}" >&2
}

# 네이티브 설정·웹 빌드·웹 임베드를 순서대로 실행하며 실패한 단계에서 후속 빌드를 중단한다.
run_build_step() {
  local start_percent="$1"
  local end_percent="$2"
  local step_label="$3"
  shift 3

  if ! terminal_progress_run \
    "${start_percent}" \
    "${end_percent}" \
    "${step_label}" \
    "${LOG_PATH}" \
    "$@"; then
    print_failure "${step_label}"
    exit 1
  fi
}

terminal_progress_render 0 "iOS ${BUILD_LABEL} 빌드 준비 중"

run_build_step 5 10 '네이티브 설정 동기화' \
  env APP_PLATFORM=ios pnpm -C "${MOBILE_ROOT}" "native:sync:${BUILD_VARIANT}" -- --yes

run_build_step 15 30 '웹 화면 빌드' \
  pnpm -C "${PROJECT_ROOT}/apps/web-ui" build

run_build_step 35 40 '웹 화면 앱 반영' \
  node "${PROJECT_ROOT}/scripts/sync-web-to-mobile.mjs"

IOS_BUILD_LOG_PATH="${LOG_PATH}" bash "${MOBILE_ROOT}/scripts/build-ios.sh" "${BUILD_VARIANT}"
