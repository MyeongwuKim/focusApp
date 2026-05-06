# Focus Hybrid (1인개발)

> React + Fastify + Expo 기반 하이브리드 Todo/Calendar 프로젝트

## 📚 App README

- [API README](./apps/api/README.md)
- [Web UI README](./apps/web-ui/README.md)
- [Mobile README](./apps/mobile/README.md)

## 📌 Overview

- 일 단위 할일, 루틴, 휴식, 집중시간을 한 흐름에서 관리하는 하이브리드 생산성 앱
- 날짜별 할일 완료율과 집중/이탈/휴식 시간을 통계 화면에서 확인하는 구조
- OAuth(카카오/네이버) 로그인 기반으로 사용자 세션과 개인 데이터 분리
- 웹(`apps/web-ui`), API(`apps/api`), 모바일(`apps/mobile`)을 한 저장소에서 운영하는 모노레포 구조
- 웹 UI를 모바일 WebView에 임베드해 동일한 사용자 흐름을 앱과 웹에서 공통으로 사용
- API는 GraphQL(Apollo) + Prisma를 중심으로 인증/할일/통계/설정 데이터를 제공
- OAuth 흐름 안정화, WebView 내비게이션 제어, E2E 테스트 도입으로 운영 안정성 강화

### Web (`apps/web-ui`)

- React + Vite 기반 화면 구성
- 캘린더/할일/통계/설정 라우트와 오버레이 전환 구조 구현
- OAuth 로그인 화면과 콜백 처리 흐름 구현
- TanStack Query 기반 데이터 요청/캐시 처리 적용
- Zustand 기반 인증/테마/토스트/앱 상태 전역 관리 적용
- GraphQL Codegen 기반 쿼리/뮤테이션 타입 자동 생성(`src/graphql/generated.ts`)
- Vitest + Testing Library 단위/통합 테스트 구성
- Playwright 기반 인증 플로우 E2E 시나리오 구성

### Zustand 활용 방식 (`apps/web-ui`)

- 서버 상태와 UI 상태를 분리해 관리
- 서버 상태(API 응답/캐시)는 TanStack Query로 관리
- 클라이언트 UI 상태(모달/토스트/선택값/테마/인증)는 Zustand로 관리
- `persist` 미들웨어로 인증 토큰(`focus-web-auth`)과 테마(`focus-web-theme`)를 로컬 저장소에 유지
- `confirm`/`actionSheet`/`toast`를 스토어 큐 기반으로 구현해 전역에서 일관된 UX 제공
- 캘린더 기준일, 뷰 월, 태스크 관리 선택 상태를 스토어로 분리해 라우트 간 상태 공유

### Mobile (`apps/mobile`)

- Expo + React Native 기반 앱 쉘 구성
- WebView를 통해 web-ui 번들을 임베드해 하이브리드 화면 제공
- 앱 권한(알림/위치)과 네이티브 이벤트를 웹 레이어와 연동
- 휴식 타이머 종료 알림은 네이티브 로컬 알림으로 예약해 백그라운드/오프라인 상황에서도 즉시 복귀 유도
- WebView 브릿지로 로컬 알림 예약/취소/탭 이동과 Expo Push 토큰 조회를 연동
- 내부 `file://` 라우팅과 외부 링크 이동을 구분한 내비게이션 제스처 제어
- 앱 백그라운드/복귀 시점 이탈시간을 추적하고 WebView로 복구 이벤트 전달
- LAN 동기화/번들 임베드 스크립트와 연계한 실행 흐름 정리

### API (`apps/api`)

- Fastify 서버 위에 Apollo GraphQL 엔드포인트 구성
- Prisma를 통해 데이터 모델 접근과 CRUD 흐름 구성
- OAuth 시작/콜백 기반 인증 라우트와 세션 처리 구현
- CORS/환경변수/헬스체크를 포함한 실행 환경 구성
- 통계 코멘터리, 알림, 일일 로그 등 도메인 API를 GraphQL로 제공
- Expo Push 배치로 집중 시작/미완료 작업/할일 시작시간 리마인더 발송

## 🚀 Key Improvements

### 1) 캐시 업데이트 전략 고도화 (로딩 체감 + 데이터 일관성)

- 문제: 월/일/통계 화면이 같은 데이터를 참조해도 캐시 반영 타이밍이 어긋나면 화면별 데이터가 달라 보이는 이슈
- 적용:
  - `setQueryData`, `setQueriesData`, `invalidateQueries`를 조합한 캐시 동기화 전략 적용
  - 일별 상세/월별 목록/통계 상세 캐시를 mutation 시점에 함께 반영
  - 낙관적 업데이트와 서버 응답 반영을 분리해 UI 반응성과 정합성 동시 확보
- 효과:
  - 액션 직후 화면 체감 반응 속도 개선
  - 화면 간 데이터 불일치 구간 축소

### 2) 네비게이션 공통화 + 스와이프 전환 구조 정리

- 문제: 스와이프 뒤로가기 시 리다이렉트/중복 진입이 겹치면 화면 재진입처럼 보이는 전환 이슈 발생
- 적용:
  - `AppNavigationProvider`로 라우팅 액션(`goPage`, `navigateTo`, `goBack`) 공통화
  - `useSwipeCore`/`useEdgeSwipeClose` 훅으로 스와이프 인식과 닫힘 전환 로직 분리
  - 히스토리 인덱스 기반 오버레이 스택 추적과 중복 내비게이션 가드 적용
  - Mobile WebView에서 내부 `file://`와 외부 URL 내비게이션 제스처를 분기 제어
- 효과:
  - 스와이프 뒤로가기 전환 안정성 강화
  - 제스처 관련 회귀 지점 감소

### 3) 로딩 체감 개선 (불필요 refetch/렌더링 축소)

- 문제: 통계/월간 데이터 화면에서 불필요 재요청이 많아지면 로딩 지연과 스크롤 체감 저하 발생
- 적용:
  - Query 기본 옵션(`staleTime`, `refetchOnWindowFocus`) 조정
  - 통계 훅에서 월간/일간 조회 옵션 분리 및 `useMemo` 기반 파생 계산 캐싱
  - 오버레이·라우트 책임 분리로 렌더링 범위 축소
- 효과:
  - 재진입 시 불필요 네트워크 요청 감소
  - 데이터 화면 초기 체감 속도 개선

### 4) OAuth/인증 플로우 안정화 + E2E 검증

- 문제: OAuth 시작/콜백 구간은 브라우저 히스토리와 플랫폼별 진입 차이로 오류 재현이 어려운 구간
- 적용:
  - API에 history-safe redirect 응답 추가
  - Web 로그인/콜백 흐름 정리
  - Playwright E2E로 인증 핵심 시나리오 3개 자동 검증
- 효과:
  - 인증 플로우 회귀 확인 자동화
  - 릴리스 전 검증 루틴 표준화

### 5) 네이티브-웹 브릿지 기반 이탈시간(편차) 복구

- 문제: 할일 진행 중 앱이 백그라운드로 내려가거나 비정상 종료되면 실제 이탈시간이 누락될 수 있는 이슈
- 적용:
  - 네이티브에서 `AppState` 변화 시점(`backgroundEnteredAtMs`)을 세션 스토리지에 기록
  - 복귀(active) 또는 콜드스타트 재실행 시 `elapsedSeconds`를 계산해 WebView 커스텀 이벤트로 전달
  - Web 레이어에서 `addTodoDeviationToDailyLog`로 편차 시간을 일일 로그/통계 캐시에 즉시 반영
- 효과:
  - 앱 전환/중단 상황에서도 집중시간 통계 정확도 유지
  - 네이티브와 웹 간 세션 연속성 강화

### 6) 알림 전략 분리 (휴식 종료 로컬 + 리마인더 푸시 배치)

- 문제: 휴식 종료는 사용자가 방금 시작한 짧은 타이머라 서버 배치 주기에 의존하면 지연이 생기고, 네트워크 상태에 따라 복귀 타이밍이 흔들릴 수 있음
- 적용:
  - 휴식 종료 알림은 `apps/mobile`에서 디바이스 로컬 알림으로 즉시 예약/취소 처리
  - 알림 탭 시 `targetPath` 기반으로 캘린더/해당 날짜 시트로 복귀 라우팅 처리
  - 반복 리마인더는 API 배치에서 Expo Push로 발송(집중 시작/미완료 작업/할일 시작시간)
- 효과:
  - 휴식 종료 시점 알림 정확도 유지
  - 실시간성 알림과 서버 주기성 알림 역할 분리

## 🛠 Technology Stack

- **Monorepo:** pnpm workspace
- **Web:** React 19, Vite, TypeScript, TanStack Query, Zustand
- **API:** Fastify, Apollo GraphQL, Prisma
- **Mobile:** Expo, React Native, React Native WebView
- **Testing:** Vitest, Testing Library, Playwright

## ✅ Test & Quality

기준일: **2026-04-27**

- Web UI 단위/통합 테스트: **2 files / 14 tests 통과**
- Web UI E2E(Playwright): **3 scenarios 통과**
- API 타입 빌드: `pnpm -C apps/api build` 통과
- Web UI 프로덕션 빌드: `pnpm -C apps/web-ui build` 통과
- Mobile lint: 에러 없이 통과(경고 5건)

## ⚙️ Setup & Usage

루트(`focus-hybrid`) 기준:

```bash
# 1) install
pnpm install

# 2) API dev
pnpm api:dev

# 3) Web dev
pnpm web:dev

# 4) Mobile dev
pnpm mobile:start

# Hybrid run (web build + embed sync + mobile start)
pnpm hybrid:start
```

### Web UI 테스트 실행 (`apps/web-ui` 기준)

```bash
# unit/integration
pnpm test
pnpm test:watch
pnpm test:coverage

# e2e (최초 1회)
pnpm e2e:install

# e2e run
pnpm e2e
pnpm e2e:headed
pnpm e2e:ui
```

### GraphQL 타입 생성 (`apps/web-ui` 기준)

```bash
# 1회 생성
pnpm graphql:codegen

# watch 모드
pnpm graphql:codegen:watch
```

동작 방식:
- `apps/api/src/graphql/schema.ts`와 resolver를 기준으로 스키마 로드
- `apps/web-ui/src/**/*.{ts,tsx,graphql,gql}` 문서 스캔
- 결과 타입을 `apps/web-ui/src/graphql/generated.ts`로 생성

## 🧩 Project Structure

```txt
focus-hybrid/
├─ apps/
│  ├─ web-ui/    # React + Vite client
│  ├─ api/       # Fastify + GraphQL API
│  └─ mobile/    # Expo app
├─ scripts/      # LAN sync, web-to-mobile sync
├─ package.json
└─ pnpm-workspace.yaml
```

## 🔐 Environment

- API는 `apps/api/.env` + `apps/api/.env.local`을 사용
- Mobile은 `apps/mobile/.env.local`을 사용

## 🧾 Recent Optimization Log

- **2026.04.27**
  - Web UI Playwright E2E 환경 추가
  - 인증 플로우 E2E 3개 시나리오 추가
  - OAuth 시작 리다이렉트 응답 안정화 반영
  - Mobile WebView 외부 내비게이션 제스처 분기 반영
