# Web UI

`apps/web-ui`는 React, Vite 기반 웹 클라이언트입니다. 브라우저에서 직접 실행할 수 있고, 모바일 앱에서는 같은 빌드 결과물을 WebView에 로드해 하이브리드 화면으로 사용합니다.

[루트 README](../../README.md)에는 전체 앱 구성과 공통 실행 흐름을 정리해 두었습니다.

## 역할

- 캘린더, 날짜별 할 일, 할 일 관리, 루틴, 통계, 업적, 메모, 설정 화면을 제공합니다.
- GraphQL API 호출과 TanStack Query 기반 서버 상태 캐시를 관리합니다.
- OAuth 로그인 시작, callback 처리, 네이티브 로그인 요청을 연결합니다.
- Zustand로 인증, 테마, 토스트, 확인 모달, 액션 시트, 날씨 설정 같은 클라이언트 상태를 관리합니다.
- 모바일 WebView 브릿지 메시지를 송수신해 알림, 위치, 날씨, Live Activity, 앱 버전 정보를 연결합니다.
- Storybook, Vitest, Playwright 기반 UI 검증 환경을 제공합니다.

## 구조

```text
apps/web-ui
├── e2e
├── public
├── src
│   ├── api
│   ├── auth
│   ├── components
│   ├── config
│   ├── features
│   ├── graphql
│   ├── hooks
│   ├── pages
│   ├── providers
│   ├── queries
│   ├── routes
│   ├── stores
│   └── utils
├── codegen.yml
├── playwright.config.ts
├── vite.config.ts
└── vitest.config.ts
```

| 경로 | 설명 |
| --- | --- |
| `src/pages` | 라우트 단위 화면 컴포넌트를 배치합니다. |
| `src/features` | 기능별 컴포넌트, 훅, 상태, 유틸을 묶습니다. |
| `src/api` | REST와 GraphQL API 호출 함수를 관리합니다. |
| `src/queries` | TanStack Query key와 mutation/query 연동 로직을 관리합니다. |
| `src/stores` | Zustand 기반 클라이언트 상태를 관리합니다. |
| `src/graphql` | GraphQL operation과 generated 타입을 보관합니다. |
| `src/utils/nativeBridge.ts` | Mobile WebView 브릿지 요청과 fallback 처리를 제공합니다. |
| `src/utils/notifications.ts` | 브라우저/네이티브 알림 요청을 연결합니다. |
| `e2e` | Playwright E2E 시나리오를 보관합니다. |

## 화면 구성

| 화면 | 역할 |
| --- | --- |
| 캘린더 | 월간 날짜별 할 일 preview와 날짜 선택 흐름을 제공합니다. |
| 날짜별 할 일 | 일별 할 일, 휴식, 집중 타이머, 루틴 불러오기, 메모 연결을 담당합니다. |
| 할 일 관리 | 컬렉션과 task를 생성, 수정, 정렬, 보관합니다. |
| 루틴 관리 | 루틴 템플릿과 요일별 배정을 관리합니다. |
| 통계 | 집중 시간, 완료 수, streak, AI 코멘터리를 보여줍니다. |
| 업적 | 업적 진행도와 달성 이력을 보여줍니다. |
| 메모 | 날짜와 연결된 메모 작성 및 보관 흐름을 제공합니다. |
| 설정 | 계정, 알림, 날씨, 테마 설정을 관리합니다. |

## 빠른 시작

루트 디렉터리 기준으로 실행합니다.

```bash
pnpm install
pnpm web:dev
```

앱 디렉터리 기준으로는 아래 명령을 사용할 수 있습니다.

```bash
pnpm -C apps/web-ui dev
```

기본 개발 서버 주소는 `http://localhost:5173`입니다.

## API 연결

GraphQL endpoint는 `src/api/graphqlEndpoint.ts`에서 결정합니다.

1. `VITE_API_ORIGIN`이 있으면 해당 origin을 사용합니다.
2. 모바일 WebView가 `window.__HYBRID_API_ORIGIN__`을 주입하면 그 값을 사용합니다.
3. `file://` 환경에서는 `http://localhost:4000`을 사용합니다.
4. 위 값이 모두 없으면 같은 origin의 `/graphql`을 사용합니다.

Vite 개발 서버는 `/graphql`, `/api`, `/daily-log`, `/daily-logs` 요청을 `http://127.0.0.1:4000`으로 proxy합니다. `/auth` 요청도 callback route를 제외하고 API 서버로 전달합니다.

## 환경변수

| 변수 | 설명 |
| --- | --- |
| `VITE_API_ORIGIN` | Web UI가 직접 호출할 API 서버 origin입니다. |
| `VITE_SENTRY_DSN` | 웹 Sentry DSN입니다. |

예시는 아래와 같습니다.

```bash
VITE_API_ORIGIN=http://localhost:4000
VITE_SENTRY_DSN=
```

## 모바일 브릿지

Web UI는 `window.ReactNativeWebView.postMessage`가 있는 환경에서 JSON 문자열을 모바일 앱으로 보냅니다. 브라우저에서 실행할 때는 브릿지가 없으므로 위치 권한 등 일부 기능은 Web API fallback을 사용합니다.

브릿지 메시지는 `type`, 선택적인 `requestId`, 선택적인 `payload`로 구성합니다.

```json
{
  "type": "REST_LOCATION_PERMISSION_REQUEST",
  "requestId": "location-request-...",
  "payload": {}
}
```

주요 요청은 다음과 같습니다.

| 메시지 | 역할 |
| --- | --- |
| `REST_AUTH_*_LOGIN_REQUEST` | 카카오, 네이버, Apple 네이티브 로그인을 요청합니다. |
| `REST_AUTH_*_UNLINK_REQUEST` | 네이티브 SDK 계정 연결 해제를 요청합니다. |
| `REST_NOTIFICATION_PERMISSION_*` | 알림 권한 상태 조회와 권한 요청을 처리합니다. |
| `REST_NOTIFICATION_SCHEDULE`, `REST_NOTIFICATION_CANCEL` | 로컬 알림 예약과 취소를 요청합니다. |
| `REST_PUSH_TOKEN_REQUEST` | Expo push token snapshot을 요청합니다. |
| `REST_LOCATION_*` | 위치 권한과 좌표 snapshot을 요청합니다. |
| `REST_WEATHER_SETTINGS_SYNC`, `REST_WEATHER_SNAPSHOT_REQUEST` | 날씨 설정 동기화와 네이티브 날씨 snapshot 요청을 처리합니다. |
| `REST_AUTH_STATE_SYNC`, `REST_TODO_VIEW_SYNC` | 인증 상태와 오늘 할 일 화면 상태를 네이티브 앱에 동기화합니다. |
| `REST_FOCUS_LIVE_ACTIVITY_*` | iOS Live Activity 시작, 갱신, 종료를 요청합니다. |
| `REST_APP_VERSION_INFO_REQUEST` | 앱 버전과 WebUI 버전 정보를 요청합니다. |

모바일 앱이 보내는 응답은 `focus-hybrid-native-bridge` custom event로 Web UI에 전달됩니다.

## GraphQL 타입 생성

`codegen.yml`은 API의 `schema.ts`, `*.resolver.ts` 파일과 Web UI의 `*.graphql`, `*.gql`, `*.ts`, `*.tsx` operation 문서를 읽어 `src/graphql/generated.ts`를 생성합니다.

```bash
pnpm -C apps/web-ui graphql:codegen
```

API schema나 operation이 바뀐 뒤 타입 오류가 생기면 위 명령으로 generated 파일을 갱신합니다.

## 모바일 임베드

모바일 앱에 Web UI 빌드 결과를 임베드할 때는 루트에서 아래 명령을 실행합니다.

```bash
pnpm hybrid:prepare
```

이 명령은 `pnpm web:build` 후 `scripts/sync-web-to-mobile.mjs`를 실행합니다. 결과로 `apps/mobile/web-dist`가 갱신되고, `apps/mobile/src/features/webui/embeddedWebUiBundle.ts`에 빌드 파일의 base64 목록이 생성됩니다.

## 주요 스크립트

| 명령어 | 설명 |
| --- | --- |
| `pnpm -C apps/web-ui dev` | Vite 개발 서버를 실행합니다. |
| `pnpm -C apps/web-ui hybrid` | LAN 접근을 위해 `0.0.0.0` host로 Vite 개발 서버를 실행합니다. |
| `pnpm -C apps/web-ui build` | TypeScript 빌드 후 Vite 프로덕션 빌드를 실행합니다. |
| `pnpm -C apps/web-ui preview` | 빌드 결과를 로컬에서 미리 봅니다. |
| `pnpm -C apps/web-ui lint` | ESLint를 실행합니다. |
| `pnpm -C apps/web-ui storybook` | Storybook 개발 서버를 실행합니다. |
| `pnpm -C apps/web-ui storybook:build` | Storybook 정적 빌드를 생성합니다. |
| `pnpm -C apps/web-ui graphql:codegen` | GraphQL 타입을 생성합니다. |
| `pnpm -C apps/web-ui graphql:codegen:watch` | GraphQL 타입 생성을 watch 모드로 실행합니다. |

## 테스트

단위/컴포넌트 테스트는 Vitest를 사용합니다.

```bash
pnpm -C apps/web-ui test
pnpm -C apps/web-ui test:watch
pnpm -C apps/web-ui test:coverage
```

E2E 테스트는 Playwright를 사용합니다.

```bash
pnpm -C apps/web-ui e2e:install
pnpm -C apps/web-ui e2e
pnpm -C apps/web-ui e2e:headed
pnpm -C apps/web-ui e2e:ui
```

Playwright 설정은 `http://127.0.0.1:4173`에서 Vite 서버를 띄워 Chromium 프로젝트로 테스트합니다.
