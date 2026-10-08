export type PageHelpGuide = {
  title: string;
  description: string;
  highlights: string[];
};

function normalizePathname(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

const guideByPath: Record<string, PageHelpGuide> = {
  "/calendar": {
    title: "달력 안내",
    description: "날짜별 할일 흐름을 한 화면에서 확인하고 빠르게 이동할 수 있어요.",
    highlights: [
      "날짜를 누르면 하단 오늘할일 보드에서 상세 항목 확인 가능",
      "좌우 스와이프로 월 이동 가능",
      "날짜를 길게 눌러 범위 선택 후 통계 화면 이동 가능",
    ],
  },
  "/tasks": {
    title: "할일 관리 안내",
    description: "할일과 컬렉션을 정리하고 순서를 재배치할 수 있어요.",
    highlights: [
      "할일 길게 눌러 드래그로 순서 변경 가능",
      "할일을 컬렉션 영역으로 드롭해 컬렉션 이동 가능",
      "컬렉션도 드래그로 정렬 순서 변경 가능",
    ],
  },
  "/tasks/stats": {
    title: "할일 통계 안내",
    description:
      "선택한 할일의 집중 기록을 요약과 추이로 나눠 보고, 전체 집중시간에서 차지한 비율과 기간별 변화를 비교할 수 있어요.",
    highlights: [
      "요약 탭에서 최근 7일·30일·1년 집중시간 확인 가능",
      "기간별 전체 집중시간에서 이 할일이 차지한 비율 비교 가능",
      "추이 탭에서 기간을 선택해 집중시간과 재개 횟수, 일·월별 흐름 확인 가능",
    ],
  },
  "/date-tasks": {
    title: "오늘할일 안내",
    description: "하루 단위로 할일을 실행하고 정렬하며 진행 상태를 관리할 수 있어요.",
    highlights: [
      "새 할 일 쓰기를 누르면 키보드로 입력하고 바로 추가 가능",
      "왼쪽 원형 표시를 누르면 집중 시작, 다시 누르면 일시정지하거나 재개 가능",
      "할 일 글자를 누르면 시작시간·목표시간·알림·삭제 옵션 확인 가능",
      "오른쪽 여백에 V를 그리면 완료, 가로로 한 번 그으면 삭제 가능",
      "항목을 길게 눌러 드래그로 순서 변경 가능",
      "좌우 스와이프로 이전 날짜와 다음 날짜 이동 가능",
    ],
  },
  "/date-tasks/add": {
    title: "할일 가져오기 안내",
    description: "등록된 할일 라이브러리에서 오늘 할일로 빠르게 가져올 수 있어요.",
    highlights: [
      "카테고리로 필터링해 원하는 할일 탐색 가능",
      "즐겨찾기 토글로 자주 쓰는 항목 관리 가능",
      "선택한 항목을 한 번에 추가 가능",
    ],
  },
  "/date-tasks/memo": {
    title: "메모 안내",
    description: "해당 날짜의 기록을 메모로 남기고 수정할 수 있어요.",
    highlights: [
      "날짜별 회고와 체크 포인트 기록 가능",
      "내용 수정 시 자동 저장 반영",
      "스와이프 닫기로 보드 화면 복귀 가능",
    ],
  },
  "/date-tasks/routines": {
    title: "묶음 불러오기 안내",
    description: "저장한 할 일 묶음을 고르고 현재 날짜에 한 번에 추가할 수 있어요.",
    highlights: [
      "편집 모드에서 항목 드래그로 순서 변경 가능",
      "편집 모드에서 항목 삭제 후 묶음 변경 저장 가능",
      "선택한 묶음을 현재 날짜 할 일에 반영 가능",
    ],
  },
  "/date-tasks/routines/new": {
    title: "묶음 만들기 안내",
    description: "자주 함께 쓰는 할 일을 하나의 묶음으로 저장해 빠르게 불러올 수 있어요.",
    highlights: [
      "목록에서 할 일을 선택해 묶음 구성 가능",
      "선택한 할일을 길게 눌러 드래그로 순서 변경 가능",
      "각 항목의 시작 시간 설정 후 묶음으로 저장 가능",
    ],
  },
  "/stats": {
    title: "통계 안내",
    description: "기록 기반으로 오늘 지표와 기간별 흐름을 확인할 수 있어요.",
    highlights: [
      "기간 필터로 조회 범위 빠르게 전환 가능",
      "오늘 한 일/집중 분/휴식 분 지표 확인 가능",
      "회고 카드로 기간 내 잘한 날과 흐트러진 날 확인 가능",
      "작업당 평균 재개 횟수와 평균 집중 구간 확인 가능",
      "일별·월별 평균 집중 구간 변화 확인 가능",
    ],
  },
  "/settings": {
    title: "설정 안내",
    description: "앱 사용 환경을 취향에 맞게 조정할 수 있어요.",
    highlights: [
      "날씨/알림 옵션 상태 확인 및 변경 가능",
      "권한 상태 점검 후 필요한 기능 활성화 가능",
      "계정과 로그인 정보 확인 가능",
    ],
  },
  "/settings/weather": {
    title: "날씨 설정 안내",
    description: "날씨 카드 표시와 연출 스타일을 조정할 수 있어요.",
    highlights: [
      "날씨 표시 켜기/끄기 전환 가능",
      "표시 분위기와 연출 강도 조정 가능",
      "현재 기기 상태와 동기화 여부 확인 가능",
    ],
  },
  "/routine": {
    title: "요일별 묶음 안내",
    description: "요일마다 자동 적용할 할 일 묶음을 미리 지정할 수 있어요.",
    highlights: [
      "요일별로 서로 다른 할 일 묶음 지정 가능",
      "할당 안 함 선택으로 특정 요일 제외 가능",
      "저장 후 자동 적용 대상 요일 사전 확인 가능",
    ],
  },
  "/routine/create": {
    title: "묶음 만들기 안내",
    description: "기존 할 일을 선택해 자주 쓰는 묶음을 만들 수 있어요.",
    highlights: [
      "컬렉션 필터로 원하는 할일 빠르게 선택 가능",
      "선택 항목 드래그로 묶음 순서 조정 가능",
      "시작시간 지정 후 템플릿으로 저장 가능",
    ],
  },
  "/routine/edit": {
    title: "묶음 수정 안내",
    description: "저장한 할 일 묶음의 구성과 이름을 현재 흐름에 맞게 조정할 수 있어요.",
    highlights: [
      "선택된 묶음 항목 유지 상태에서 수정 시작 가능",
      "항목 추가/제외 및 순서 재배치 가능",
      "시간 설정 변경 후 템플릿에 즉시 반영 가능",
    ],
  },
  "/settings/notifications": {
    title: "알림 설정 안내",
    description: "알림 권한과 발송 동작을 점검하고 관리할 수 있어요.",
    highlights: [
      "시스템 권한 상태 확인 가능",
      "알림 수신 설정과 기기 등록 상태 점검 가능",
      "문제 발생 시 재동기화로 복구 가능",
    ],
  },
  "/settings/account": {
    title: "계정 안내",
    description: "계정 관리와 데이터 삭제를 진행할 수 있어요.",
    highlights: [
      "계정 삭제 시 데이터가 함께 삭제됨",
      "삭제 요청 전 안내 문구 확인 가능",
      "삭제 후에는 로그인 화면으로 이동",
    ],
  },
};

export function getPageHelpGuide(pathname: string): PageHelpGuide | null {
  const normalizedPath = normalizePathname(pathname);
  if (normalizedPath.startsWith("/routine/edit/")) {
    return guideByPath["/routine/edit"] ?? null;
  }
  return guideByPath[normalizedPath] ?? null;
}
