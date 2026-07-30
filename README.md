# Focus Hybrid

Focus Hybrid는 일정, 할 일, 루틴, 집중 기록을 하나의 흐름으로 묶은 생산성 앱 `타임스택`의 모노레포입니다.

Web UI를 제품의 중심 화면으로 두고, 모바일 앱은 같은 Web UI를 WebView로 실행하면서 로그인, 알림, 위치, 날씨, iOS Live Activity처럼 기기 권한이 필요한 기능을 네이티브 브릿지로 연결합니다. API 서버는 인증, GraphQL 데이터 처리, 통계 코멘터리, 동기부여 메시지, 서버 푸시 알림 배치를 담당합니다.

화면은 Web UI에서 공통으로 만들고, 모바일에서 필요한 권한과 네이티브 기능은 브릿지로 연결했습니다. 덕분에 브라우저와 앱이 같은 사용자 흐름을 공유하면서도 로그인, 알림, 위치, Live Activity 같은 기능은 플랫폼에 맞게 처리할 수 있습니다.

## 문서와 앱 구성

| 문서 | 내용 |
| --- | --- |
| [API README](./apps/api/README.md) | Fastify, Apollo GraphQL, Prisma 기반 API 서버 실행과 환경변수 |
| [Web UI README](./apps/web-ui/README.md) | React, Vite 기반 Web UI 구조, API 연결, 브릿지 메시지 |
| [Mobile README](./apps/mobile/README.md) | Expo, React Native 기반 WebView 앱, 네이티브 설정, WebUI 업데이트 |

| 영역 | 경로 | 역할 |
| --- | --- | --- |
| API | `apps/api` | 인증, GraphQL API, Prisma 데이터 접근, 알림 배치, AI 코멘터리 |
| Web UI | `apps/web-ui` | 캘린더, 할 일, 루틴, 통계, 업적, 메모, 설정 화면 |
| Mobile | `apps/mobile` | WebView 앱 쉘, 네이티브 로그인, 알림, 위치, Live Activity, WebUI 업데이트 |
| Scripts | `scripts` | Web UI 임베드, R2 릴리즈 정리 자동화 |

## 프로젝트 배경

일반적인 할 일 앱은 해야 할 일을 적는 데서 끝나는 경우가 많습니다. 이 프로젝트는 할 일을 날짜별 기록, 루틴, 집중 시간, 휴식, 메모, 통계와 연결해 “오늘 무엇을 했고 다음에 무엇을 이어가야 하는지”를 남기는 쪽에 초점을 맞췄습니다.

처음부터 Web과 Mobile을 완전히 따로 만들면 화면 구현과 상태 관리가 중복됩니다. 반대로 WebView만 사용하면 네이티브 로그인, 푸시 알림, 위치 권한, Live Activity 같은 기능을 자연스럽게 다루기 어렵습니다. 그래서 Web UI를 공통 화면으로 사용하되, 기기 권한이 필요한 영역은 명시적인 브릿지 메시지로 분리하는 하이브리드 구조를 선택했습니다.

## 서비스 흐름

사용자가 보는 화면은 `apps/web-ui`에서 구현합니다. 브라우저에서는 Vite 개발 서버로 실행하고, 모바일 앱에서는 같은 Web UI 빌드 결과를 WebView에 로드합니다.

Web UI는 할 일, 루틴, 메모, 통계 데이터를 API 서버에 요청합니다. API 서버는 GraphQL을 통해 사용자 데이터를 처리하고, Prisma로 MongoDB에 접근합니다. 통계 코멘터리와 동기부여 메시지가 필요한 경우에는 OpenAI API를 호출합니다.

모바일 앱은 Web UI만으로 처리하기 어려운 기능을 맡습니다. 카카오, 네이버, Apple 네이티브 로그인, 알림 권한, 위치, 날씨, iOS Live Activity 같은 기능은 WebView 브릿지 메시지로 요청하고 응답을 받습니다.

Web UI 배포는 Cloudflare R2를 통해 관리합니다. 모바일 앱은 시작할 때 원격 manifest를 확인하고, 더 높은 WebUI 버전이 있으면 zip 번들을 내려받아 앱 내부의 active 번들로 교체합니다.

| 흐름 | 설명 |
| --- | --- |
| Web UI → API | GraphQL로 할 일, 루틴, 메모, 통계, 업적 데이터를 요청 |
| API → MongoDB | Prisma Client로 사용자별 데이터를 저장하고 조회 |
| API → OpenAI API | 통계 코멘터리와 동기부여 메시지 생성 |
| Web UI → Mobile | 브릿지 메시지로 네이티브 로그인, 알림, 위치, Live Activity 요청 |
| Mobile → Web UI | 네이티브 처리 결과와 앱/WebUI 버전 정보를 Web UI에 전달 |
| R2 → Mobile | 원격 WebUI manifest와 zip 번들을 기준으로 앱 내부 Web UI 업데이트 |

## 핵심 기능

| 기능 | 구현 내용 |
| --- | --- |
| 날짜별 할 일 | 일별 할 일 생성, 완료, 시작/정지, 집중 시간과 휴식 시간 기록 |
| 루틴 관리 | 루틴 템플릿 생성, 요일별 루틴 배정, 날짜별 할 일로 불러오기 |
| 할 일 컬렉션 | 컬렉션별 task 관리, 정렬, 보관, 즐겨찾기 |
| 메모 | 날짜와 연결된 메모 작성 및 보관 |
| 통계와 업적 | 완료 수, 집중 시간, streak, 업적 진행도와 달성 이력 계산 |
| AI 코멘터리 | 통계 데이터 기반 코멘터리와 오늘 할 일 상태 기반 동기부여 메시지 생성 |
| 알림 | 로컬 알림, Expo push token, 서버 배치 알림, 알림 설정 관리 |
| 네이티브 연동 | 카카오, 네이버, Apple 네이티브 로그인, 위치, 날씨, iOS Live Activity |
| WebUI 업데이트 | Cloudflare R2 manifest와 zip 번들 기반 모바일 Web UI 원격 업데이트 |

## 기술 스택과 선택 이유

| 영역 | 사용 기술 | 선택 이유 |
| --- | --- | --- |
| Monorepo | pnpm workspace | Web, Mobile, API를 한 저장소에서 관리하고 공통 스크립트로 실행 흐름을 맞추기 위함 |
| API | Fastify, Apollo Server, GraphQL, Prisma, MongoDB, Zod | 도메인별 resolver/service/repository 구조로 사용자별 데이터를 명확히 다루기 위함 |
| Web UI | React 19, Vite, TypeScript, React Router, TanStack Query, Zustand | 서버 상태와 클라이언트 상태를 분리하고 WebView에서도 같은 화면을 재사용하기 위함 |
| Mobile | Expo 54, React Native, Expo Router, React Native WebView, Expo Notifications, React Native Skia | Web UI를 앱 안에 싣고 네이티브 권한과 시각 효과를 연결하기 위함 |
| 품질 확인 | Vitest, Testing Library, Playwright, Storybook, ESLint | 서비스 로직, UI 상태, 핵심 사용자 흐름을 범위별로 확인하기 위함 |
| 배포/업데이트 | GitHub Actions, Cloudflare R2 | 네이티브 앱 배포 없이 Web UI 번들을 채널별로 갱신하기 위함 |

## 주요 구현 내용

### WebView 브릿지로 Web과 Native 책임 분리

Web UI는 `window.ReactNativeWebView.postMessage`로 네이티브 앱에 JSON 메시지를 보냅니다. 모바일 앱은 `routeWebViewBridgeMessage`에서 sync, notification, version, auth, focusLiveActivity, location handler 순서로 메시지를 라우팅합니다.

이 구조 덕분에 Web UI는 알림 권한 요청, 위치 snapshot, 네이티브 로그인, Live Activity 같은 기능을 직접 구현하지 않고 “요청 메시지”만 보냅니다. 브라우저에서 실행할 때는 브릿지가 없으므로 일부 기능은 Web API fallback을 사용합니다.

관련 코드:

- `apps/web-ui/src/utils/nativeBridge.ts`
- `apps/mobile/src/features/bridge/routeWebViewBridgeMessage.ts`
- `apps/mobile/src/features/bridge/handlers/*`

### 모바일 WebUI 원격 업데이트

모바일 앱은 빌드 시점의 Web UI를 `embeddedWebUiBundle.ts`에 base64 파일 목록으로 포함합니다. 앱 시작 시에는 이 내장 번들을 active 디렉터리에 준비하고, `EXPO_PUBLIC_WEBUI_MANIFEST_URL`이 있으면 R2의 `latest/manifest.json`을 확인합니다.

원격 manifest의 version이 현재 저장된 WebUI version보다 높으면 `web-ui.zip`을 staging 경로에 내려받아 압축을 풀고 active 번들로 교체합니다. manifest의 `minimumNativeVersion`이 현재 앱 버전보다 높으면 적용하지 않고 업데이트 안내 흐름으로 넘깁니다. 로컬 파일 실행에서 문제가 될 수 있는 `crossorigin` 속성 제거와 zip entry path 검증도 업데이트 과정에 포함되어 있습니다.

관련 코드:

- `scripts/sync-web-to-mobile.mjs`
- `apps/mobile/src/features/webui/webUiVersionWorker.ts`
- `.github/workflows/deploy-webui-dev-r2.yml`
- `.github/workflows/deploy-webui-prod-r2.yml`

### GraphQL 중심의 사용자 데이터 처리

API는 Fastify에 Apollo GraphQL을 붙이고, 인증이 필요한 `/graphql`, `/api/*` 요청을 Bearer token 기반 세션으로 보호합니다. 데이터 접근은 Prisma Client를 통해 처리하며, 사용자별 일일 기록, task collection, 루틴 템플릿, 알림 설정, push token, 업적 데이터를 도메인 모듈로 나눴습니다.

GraphQL schema는 모듈별 typeDefs와 resolvers를 병합하는 방식으로 구성되어 있어 기능이 늘어날 때 API 경계를 유지하기 쉽습니다.

관련 코드:

- `apps/api/src/app.ts`
- `apps/api/src/graphql/schema.ts`
- `apps/api/src/modules/*`
- `apps/api/prisma/schema.prisma`

### 알림 설정과 서버 배치

알림은 Web UI, Mobile, API가 나눠 처리합니다. Web UI는 사용자의 알림 설정과 권한 상태를 보여주고, 모바일 앱은 로컬 알림과 Expo push token을 네이티브 권한과 연결합니다. API는 알림 설정, push token 저장, 서버 배치 실행을 담당합니다.

서버 배치는 알림 허용 여부, 요일/시간대, 리마인드 간격, 신규 사용자 grace period, reminder lock을 확인한 뒤 대상자를 선별합니다. 수동 실행 endpoint는 `BATCH_API_SECRET`이 설정된 경우 별도 header로 보호됩니다.

관련 코드:

- `apps/api/src/modules/notification-settings/*`
- `apps/api/src/modules/push-device-token/*`
- `apps/api/src/modules/notification-batch/*`
- `apps/mobile/src/features/notifications/hooks/useRestNotificationBridge.ts`

### 통계, 업적, AI 코멘터리

Web UI는 완료 수, 집중 시간, rest time, streak, 기간별 차트를 계산해 보여줍니다. API는 업적 정의를 기준으로 누적 집중, 완료 수, 연속일, 주간 기록을 계산하고 진행도와 달성 이벤트를 저장합니다.

통계 코멘터리와 동기부여 메시지는 OpenAI API를 사용하되, 요청 payload를 Zod로 검증하고 응답 형식을 제한합니다. OpenAI API 키가 없거나 요청이 실패했을 때를 대비해 deterministic fallback 문장도 함께 둔 점이 특징입니다.

관련 코드:

- `apps/web-ui/src/features/stats/*`
- `apps/api/src/modules/achievement/achievement.resolver.ts`
- `apps/api/src/modules/stats/stats-commentary.route.ts`
- `apps/api/src/modules/motivation/motivation-message.route.ts`

## 기술적 의사결정

### Web UI를 공통 화면으로 두고 Native는 권한 영역에 집중

Web과 Mobile 화면을 따로 구현하면 기능이 늘어날수록 UI와 상태 관리가 중복됩니다. 이 프로젝트는 React Web UI를 화면의 단일 출처로 두고, Mobile은 WebView 앱 쉘과 네이티브 권한 처리에 집중시켰습니다.

대신 Web과 Native 사이의 암묵적인 의존을 줄이기 위해 브릿지 메시지 타입을 `REST_*` 형태로 명시했습니다. 요청에는 `requestId`를 포함할 수 있고, 모바일 응답은 custom event로 Web UI에 전달됩니다.

### 네이티브 배포 없이 Web UI를 갱신할 수 있는 구조

앱 화면 대부분이 Web UI에 있으므로 작은 화면 수정까지 네이티브 앱 심사를 거치면 배포 속도가 느려집니다. 그래서 Web UI 빌드 결과를 R2에 zip으로 올리고, 모바일 앱이 manifest를 보고 필요한 경우 active bundle을 교체하도록 만들었습니다.

다만 Web UI가 네이티브 기능과 맞물리기 때문에 아무 버전이나 적용할 수는 없습니다. manifest에 `minimumNativeVersion`을 포함해, 새 Web UI가 요구하는 네이티브 기능을 현재 앱이 감당할 수 있는지 먼저 확인합니다.

### 알림은 사용자 설정, 시스템 권한, 서버 시간을 함께 고려

알림은 켜져 있다고 바로 보내면 안 됩니다. 시스템 권한, 사용자 설정, 요일 모드, 활성 시간대, 리마인드 간격, 이미 예약된 다음 알림 시각을 함께 확인해야 합니다. 서버 배치에서는 이 조건을 모두 거친 뒤 push token 대상으로 발송하고, 중복 실행을 줄이기 위해 reminder lock을 사용합니다.

## 저장소 구조

```text
.
├── apps
│   ├── api
│   ├── mobile
│   └── web-ui
├── scripts
├── package.json
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

## 실행 방법

루트 `package.json`은 `pnpm@10.20.0`을 기준으로 합니다.

```bash
pnpm install
```

API 개발 서버를 실행합니다.

```bash
pnpm api:prisma:generate
pnpm api:dev
```

Web UI 개발 서버를 실행합니다.

```bash
pnpm web:dev
```

Mobile 개발 서버를 실행합니다.

```bash
pnpm mobile:start
```

Web UI를 빌드해 모바일 앱에 임베드한 뒤 실행할 때는 아래 명령을 사용합니다.

```bash
pnpm hybrid:start
```

## 환경변수

API 실행에는 최소 `DATABASE_URL`이 필요합니다. OpenAI 코멘터리, OAuth, 알림 배치, Sentry는 선택 환경변수로 분리되어 있습니다.

모바일 앱은 Expo config 단계에서 카카오와 네이버 네이티브 로그인 값을 검증합니다.

```bash
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=
EXPO_PUBLIC_NAVER_CONSUMER_KEY=
EXPO_PUBLIC_NAVER_CONSUMER_SECRET=
EXPO_PUBLIC_NAVER_URL_SCHEME=
```

자세한 환경변수는 앱별 README에 정리되어 있습니다.

## 검증

변경 범위에 따라 앱별 검증 명령을 선택합니다.

```bash
pnpm -C apps/api test
pnpm -C apps/api build
pnpm -C apps/web-ui test
pnpm -C apps/web-ui build
pnpm -C apps/web-ui lint
pnpm -C apps/web-ui e2e
pnpm -C apps/mobile lint
```

루트 `test` 스크립트는 통합 테스트가 아니라 placeholder이며 실행 시 실패하도록 되어 있습니다.
