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
    description: "선택한 할일의 수행 기록과 흐름을 기간별로 확인할 수 있어요.",
    highlights: [
      "기간 프리셋으로 최근 성과 빠르게 비교 가능",
      "완료율과 집중 시간 지표 확인 가능",
      "일자별 변화 추이를 차트로 확인 가능",
    ],
  },
  "/date-tasks": {
    title: "오늘할일 안내",
    description: "하루 단위로 할일을 실행하고 정렬하며 진행 상태를 관리할 수 있어요.",
    highlights: [
      "카드 길게 눌러 드래그로 순서 변경 가능",
      "좌우 스와이프로 이전 날짜와 다음 날짜 이동 가능",
      "빠른 액션으로 할일 추가와 루틴 불러오기 진입 가능",
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
    title: "루틴 불러오기 안내",
    description: "편집 모드에서 루틴 항목을 정리한 뒤 저장하고 오늘 할일에 반영할 수 있어요.",
    highlights: [
      "편집 모드에서 항목 드래그로 순서 변경 가능",
      "편집 모드에서 항목 삭제 후 루틴 변경 저장 가능",
      "저장 후 선택한 루틴을 현재 날짜 할일에 반영 가능",
    ],
  },
  "/date-tasks/routines/new": {
    title: "루틴 만들기 안내",
    description: "자주 쓰는 할일 묶음을 루틴으로 저장해 반복 작업을 빠르게 시작할 수 있어요.",
    highlights: [
      "목록에서 할일을 선택해 루틴 구성 가능",
      "선택한 할일을 길게 눌러 드래그로 순서 변경 가능",
      "각 항목의 시작 시간 설정 후 루틴으로 저장 가능",
    ],
  },
  "/stats": {
    title: "통계 안내",
    description: "기간별 생산성 지표를 요약해서 확인할 수 있어요.",
    highlights: [
      "기간 필터로 조회 범위 빠르게 전환 가능",
      "완료율과 집중 시간 추이 확인 가능",
      "일자별 상세 데이터로 원인 분석 가능",
    ],
  },
  "/settings": {
    title: "설정 안내",
    description: "앱 사용 환경을 취향에 맞게 조정할 수 있어요.",
    highlights: [
      "테마와 화면 표현 방식 변경 가능",
      "날씨/알림 옵션 상태 확인 및 변경 가능",
      "권한 상태 점검 후 필요한 기능 활성화 가능",
    ],
  },
  "/settings/theme": {
    title: "테마 설정 안내",
    description: "앱의 색상과 분위기를 상황에 맞게 바꿀 수 있어요.",
    highlights: [
      "원하는 테마 즉시 적용 가능",
      "배경 대비와 가독성 기준으로 선택 가능",
      "변경 결과를 전체 화면에서 바로 확인 가능",
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
  "/settings/notifications": {
    title: "알림 설정 안내",
    description: "알림 권한과 발송 동작을 점검하고 관리할 수 있어요.",
    highlights: [
      "시스템 권한 상태 확인 가능",
      "알림 수신 설정과 기기 등록 상태 점검 가능",
      "문제 발생 시 재동기화로 복구 가능",
    ],
  },
};

export function getPageHelpGuide(pathname: string): PageHelpGuide | null {
  const normalizedPath = normalizePathname(pathname);
  return guideByPath[normalizedPath] ?? null;
}
