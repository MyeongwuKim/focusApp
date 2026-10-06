#!/usr/bin/env bash

set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_ROOT="${PROJECT_ROOT}/apps/mobile"
BUILD_STAMP="$(date +%Y%m%d-%H%M%S)"
LOG_ROOT="${MOBILE_ROOT}/dist/logs"
LOG_PATH="${LOG_ROOT}/ios-dev-${BUILD_STAMP}.log"

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

run_quiet_step() {
  local start_percent="$1"
  local end_percent="$2"
  local step_label="$3"
  shift 3

  printf '[%3d%%] %s...\n' "${start_percent}" "${step_label}"

  if ! "$@" >> "${LOG_PATH}" 2>&1; then
    print_failure "${step_label}"
    exit 1
  fi

  printf '[%3d%%] %s 완료\n' "${end_percent}" "${step_label}"
}

printf '[  0%%] iOS 개발 빌드 시작\n'

run_quiet_step 5 10 '네이티브 설정 동기화 중' \
  env APP_PLATFORM=ios pnpm -C "${MOBILE_ROOT}" native:sync:dev -- --yes

run_quiet_step 15 30 '웹 화면 빌드 중' \
  pnpm -C "${PROJECT_ROOT}/apps/web-ui" build

run_quiet_step 35 40 '웹 화면을 앱에 반영하는 중' \
  node "${PROJECT_ROOT}/scripts/sync-web-to-mobile.mjs"

IOS_BUILD_LOG_PATH="${LOG_PATH}" pnpm -C "${MOBILE_ROOT}" ios:dev
