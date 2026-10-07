#!/usr/bin/env bash

TERMINAL_PROGRESS_WIDTH=28
TERMINAL_PROGRESS_FRAMES=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')

terminal_progress_is_interactive() {
  [[ -t 1 && "${TERM:-dumb}" != "dumb" ]]
}

# 전체 빌드에서 실제로 완료된 단계 비율만 채우며, 실행 중이면 남은 영역의 표시를 움직인다.
# 대화형 터미널이 아니면 제어 문자를 사용하지 않아 CI 로그도 읽을 수 있게 유지한다.
terminal_progress_render() {
  local percent="$1"
  local label="$2"
  local active_frame="${3:-}"
  local filled_width=$((percent * TERMINAL_PROGRESS_WIDTH / 100))
  local empty_width=$((TERMINAL_PROGRESS_WIDTH - filled_width))
  local filled_bar=""
  local empty_bar=""

  printf -v filled_bar '%*s' "${filled_width}" ''
  printf -v empty_bar '%*s' "${empty_width}" ''
  filled_bar="${filled_bar// /█}"
  empty_bar="${empty_bar// /░}"

  if [[ -n "${active_frame}" ]] && ((empty_width > 0)); then
    local active_position=$((active_frame % empty_width))
    local active_prefix=""
    local active_suffix=""
    printf -v active_prefix '%*s' "${active_position}" ''
    printf -v active_suffix '%*s' "$((empty_width - active_position - 1))" ''
    empty_bar="${active_prefix// /░}▓${active_suffix// /░}"
  fi

  if terminal_progress_is_interactive; then
    printf '\r\033[2K%s%s %3d%%  %s' "${filled_bar}" "${empty_bar}" "${percent}" "${label}"
  else
    printf '%s%s %3d%%  %s\n' "${filled_bar}" "${empty_bar}" "${percent}" "${label}"
  fi
}

terminal_progress_newline() {
  if terminal_progress_is_interactive; then
    printf '\n'
  fi
}

# 명령 출력은 로그 파일에 저장하고, 실행 중에는 같은 줄에서 진행 바와 스피너만 갱신한다.
terminal_progress_run() {
  local start_percent="$1"
  local end_percent="$2"
  local label="$3"
  local log_path="$4"
  shift 4

  local command_exit_code=0
  if terminal_progress_is_interactive; then
    "$@" >> "${log_path}" 2>&1 &
    local command_pid=$!
    local frame_index=0

    while kill -0 "${command_pid}" 2>/dev/null; do
      terminal_progress_render \
        "${start_percent}" \
        "${label} ${TERMINAL_PROGRESS_FRAMES[frame_index % ${#TERMINAL_PROGRESS_FRAMES[@]}]}" \
        "${frame_index}"
      frame_index=$((frame_index + 1))
      sleep 0.25
    done

    if wait "${command_pid}"; then
      command_exit_code=0
    else
      command_exit_code=$?
    fi
  else
    terminal_progress_render "${start_percent}" "${label}..."
    if "$@" >> "${log_path}" 2>&1; then
      command_exit_code=0
    else
      command_exit_code=$?
    fi
  fi

  if ((command_exit_code != 0)); then
    terminal_progress_newline
    return "${command_exit_code}"
  fi

  terminal_progress_render "${end_percent}" "${label} 완료"
}

terminal_progress_finish() {
  terminal_progress_render 100 "$1"
  terminal_progress_newline
}
