# 타임스택

`타임스택`은 Web UI를 Native의 WebView에서 실행하는 하이브리드 생산성 앱으로, Web UI와 Native, API를 한 저장소에서 관리하는 모노레포 구조의 프로젝트입니다.

## 프로젝트 배경

할 일 앱을 쓰다 보면 계획을 적고 완료 기록을 확인하는 기능만으로는 조금 아쉬웠습니다. 통계는 지난 기록을 돌아보는 데 도움이 되지만, 정작 할 일을 시작해야 할 때 앱을 열지 않으면 그대로 잊기 쉬웠습니다.

그래서 타임스택에는 날짜별 할 일과 루틴, 집중·휴식 기록을 모아보는 기능에 여러 알림을 더했습니다. 집중을 시작할 시간, 아직 끝내지 못한 일, 휴식이 끝난 시점 등을 다시 알려주어 필요한 순간에 앱을 확인할 수 있도록 만들었습니다.

## 핵심 기능

| 기능 | 구현 내용 |
| --- | --- |
| 날짜별 할 일 | 일별 할 일 생성, 완료, 시작/정지, 집중 시간과 휴식 시간 기록 |
| 루틴 관리 | 루틴 템플릿 생성, 요일별 루틴 배정, 날짜별 할 일로 불러오기 |
| 할 일 컬렉션 | 할 일을 컬렉션별로 관리하고 순서 변경, 보관, 즐겨찾기 |
| 메모 | 날짜와 연결된 메모 작성 및 보관 |
| 통계와 업적 | 완료 수, 집중 시간, 연속 기록, 업적 진행도와 달성 이력 계산 |
| AI 코멘터리 | 통계 데이터 기반 코멘터리와 오늘 할 일 상태 기반 동기부여 메시지 생성 |
| 알림 | 휴식 종료, 오늘 할 일 등록, 미완료 할 일을 설정한 시간과 주기에 맞춰 안내 |

## 서비스 구성

UI는 `apps/web-ui`에서 Vite, React, Tailwind CSS로 구현했습니다. Native는 이 Web UI를 WebView로 불러옵니다. 알림 권한, 위치, 네이티브 로그인, Live Activity처럼 기기 기능이 필요할 때는 웹에서 브릿지를 통해 Native에 요청하고 처리 결과를 받습니다.

할 일, 루틴, 메모, 업적 등의 데이터는 GraphQL API로 저장하고 조회합니다. API는 Prisma로 MongoDB에 접근하며, 통계 코멘터리와 동기부여 메시지는 별도의 REST 엔드포인트에서 OpenAI API를 호출해 생성합니다.

서버 푸시는 Cloud Scheduler가 5분마다 배치 API를 호출하는 방식으로 처리합니다. API가 발송 대상을 확인한 뒤 Expo Push API를 통해 알림을 보냅니다.

## 기술 스택과 선택 이유

| 영역 | 사용 기술 | 선택 이유 |
| --- | --- | --- |
| Monorepo | pnpm workspace | Web UI, Native, API를 한 저장소에서 관리하고 공통 스크립트로 실행 흐름을 맞추기 위함 |
| API | Fastify, Apollo Server, GraphQL, Prisma, MongoDB, Zod | 도메인별 resolver/service/repository 구조로 사용자별 데이터를 명확히 다루기 위함 |
| Web UI | React 19, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, Zustand | 서버 상태와 클라이언트 상태를 분리하고 WebView에서도 같은 UI를 재사용하기 위함 |
| Native | Expo 54, React Native, Expo Router, React Native WebView, Expo Notifications, React Native Skia | Web UI를 앱 안에 싣고 네이티브 권한과 시각 효과를 연결하기 위함 |
| 품질 확인 | Vitest, Testing Library, Playwright, Storybook, ESLint | 서비스 로직, UI 상태, 핵심 사용자 흐름을 범위별로 확인하기 위함 |
| 배포/업데이트 | GitHub Actions, Cloudflare R2, Cloud Build, Cloud Run | Web UI와 API 배포 경로를 나누고 변경 범위에 맞게 자동화하기 위함 |
| 알림 배치 | Cloud Scheduler, Expo Push API | 5분마다 배치 API를 호출하고 앱을 열지 않은 사용자에게 서버 푸시를 보내기 위함 |

## 주요 구현 내용

### 웹과 Native 연결

캘린더, 할 일, 통계 UI는 `apps/web-ui`에서 구현하고, Native에서는 해당 Web UI를 WebView로 불러옵니다. 알림 권한, 위치, 네이티브 로그인, Live Activity처럼 기기에서 처리해야 하는 기능은 Native가 담당합니다.

웹에서 네이티브 기능이 필요하면 기능 종류와 필요한 값을 JSON 메시지로 만들어 WebView 브릿지에 전달합니다. Native는 메시지의 `type`을 확인해 알맞은 기능을 실행하고 결과를 다시 웹으로 보냅니다. 예를 들어 웹에서 위치 권한을 요청하면 Native가 기기 권한을 확인한 뒤 현재 상태를 돌려주는 방식입니다.

브라우저에는 Native 브릿지가 없으므로 위치처럼 Web API로 대체할 수 있는 기능만 브라우저 방식으로 처리합니다. 네이티브 로그인처럼 대체할 수 없는 기능은 Native에서 실행할 때만 제공합니다.

관련 코드:

- `apps/web-ui/src/utils/nativeBridge.ts`
- `apps/mobile/src/features/bridge/routeWebViewBridgeMessage.ts`
- `apps/mobile/src/features/bridge/handlers/*`

### Web UI 자동 패치

Native에는 빌드 시점의 Web UI를 기본 번들로 포함합니다. 이후 Web UI만 수정한 경우에는 네이티브 앱을 다시 배포하지 않고 Cloudflare R2에 새 번들을 올립니다. `develop`과 `master` 브랜치의 관련 파일이 변경되면 GitHub Actions가 Web UI를 빌드하고 dev 또는 prod R2 버킷에 자동으로 업로드합니다.

Native가 시작되면 먼저 연결된 R2의 `native/latest.json`에서 현재 플랫폼 정책을 읽습니다. 강제 업데이트가 활성화되어 있고 설치된 앱 버전이 최소 버전보다 낮으면 Web UI 준비 전에 앱 업데이트를 안내합니다.

버전 확인을 통과하면 `latest/manifest.json`의 버전과 현재 설치된 Web UI 버전을 비교합니다. 새 버전이 있으면 `web-ui.zip`을 staging 경로에 내려받아 압축을 풀고, `index.html`과 파일 경로를 확인한 뒤 active 번들로 교체합니다.

Web UI에서 새 네이티브 기능을 사용하면 이전 앱에서는 실행할 수 없습니다. 이를 막기 위한 최소 앱 버전 정책은 Web UI manifest와 분리해 변경 시 Web UI 릴리즈 버전이 불필요하게 올라가지 않도록 했습니다. Web UI manifest 조회나 번들 설치에 실패한 경우에는 그대로 실행하지 않고 시작 오류를 표시합니다.

관련 코드:

- `scripts/sync-web-to-mobile.mjs`
- `apps/mobile/src/features/version/nativeAppVersionPolicy.ts`
- `apps/mobile/src/features/webui/webUiVersionWorker.ts`
- `.github/workflows/deploy-native-version-dev-r2.yml`
- `.github/workflows/deploy-native-version-prod-r2.yml`
- `.github/workflows/deploy-webui-dev-r2.yml`
- `.github/workflows/deploy-webui-prod-r2.yml`

### 로컬 알림과 서버 푸시 분리

알림은 필요한 시점과 앱 실행 여부에 따라 로컬 알림과 서버 푸시로 나눴습니다. 휴식 종료는 타이머를 시작한 기기에서 종료 시각을 바로 예약할 수 있어 Native의 로컬 알림으로 처리합니다. 반면 오늘 할 일이 비어 있거나 시작 전·중단 상태의 일이 남아 있으면 앱을 열지 않은 상태에서도 확인할 수 있도록 서버 푸시로 알립니다.

서버 푸시는 Cloud Scheduler가 5분마다 배치 API를 호출하는 방식으로 구현했습니다. 짧게 실행되는 작업이라 별도 worker를 상시 운영하는 것보다 비용 부담이 적은 Cloud Scheduler를 선택했습니다. 배치는 알림 권한, 사용자가 설정한 요일과 시간대, 리마인드 간격, 당일 할 일 상태를 확인해 발송 대상을 정합니다. 실행이 겹쳐도 같은 알림이 두 번 발송되지 않도록 잠금을 사용하고, 발송 후에는 다음 알림 시각을 저장합니다.

관련 코드:

- `apps/api/src/modules/notification-settings/*`
- `apps/api/src/modules/push-device-token/*`
- `apps/api/src/modules/notification-batch/*`
- `apps/mobile/src/features/notifications/hooks/useRestNotificationBridge.ts`

### 집중 타이머와 Live Activity 동기화

집중 중에는 앱을 계속 열어두지 않아도 현재 할 일과 경과 시간을 확인할 수 있도록 iOS Live Activity를 연결했습니다. Web UI에서 집중을 시작하거나 종료하면 할 일, 시작 시각, 누적 시간, 목표 시간을 Native에 보내고 ActivityKit 화면을 갱신합니다.

Live Activity의 버튼으로 집중을 일시정지하거나 다시 시작할 수도 있습니다. 이 동작은 공유된 인증 정보로 GraphQL API를 직접 호출하고, 성공하면 변경된 할 일 상태를 Native에서 Web UI로 전달합니다. Web UI는 전달받은 일일 기록으로 화면 상태를 다시 맞춘 뒤 처리 완료 응답을 보냅니다.

버튼이 여러 번 눌려 같은 요청이 겹치지 않도록 잠금을 사용합니다. API 호출에 실패하면 Live Activity를 이전 상태로 되돌려 화면과 서버 상태가 다르게 남지 않도록 했습니다.

관련 코드:

- `apps/mobile/plugins/focus-live-activity/FocusLiveActivityModule.swift`
- `apps/mobile/targets/focus-live-activity/_shared/FocusLiveActivityControl.swift`
- `apps/mobile/src/features/bridge/handlers/focusLiveActivityBridgeHandlers.ts`
- `apps/web-ui/src/features/todo/date-todos/hooks/useDateTodosTaskActions.tsx`
- `apps/web-ui/src/features/todo/date-todos/DateTodosRouteProvider.tsx`

### 통계와 업적 계산

Web UI에서는 날짜별 기록을 기준으로 완료·미완료 수, 집중·휴식 시간, 집중 재개 횟수와 기간별 통계를 계산합니다. 통계 코멘터리는 계산한 값을 API에 전달해 생성합니다. API는 요청 형식과 OpenAI 응답 구조를 검사하고, 일부 항목이 빠진 경우에는 같은 통계로 만든 기본 문장을 채웁니다. OpenAI 요청 자체가 실패하면 Web UI에 오류 상태를 표시합니다.

업적은 서버에서 한국 시간 기준으로 계산합니다. 집중 연속일은 하루 25분을 집중했거나, 15분 이상 집중하면서 할 일을 하나 이상 완료한 날을 기준으로 합니다. 주간 업적은 최근 7일이 아니라 월요일부터 오늘까지의 기록만 집계합니다.

주간 업적은 ISO 주차별로 달성 이벤트를 한 번만 만들고 이전 주 달성 기록과 이어지면 주간 연속 횟수를 늘립니다. 날짜 경계, 월요일 시작 주간 집계, 연말 ISO 주차 계산은 별도 유틸로 분리해 테스트했습니다.

업적 화면에서는 서버에서 계산한 값을 바탕으로 다음 목표, 현재 진행도, 주간 도전과 달성 히스토리를 보여줍니다.

관련 코드:

- `apps/web-ui/src/features/stats/*`
- `apps/web-ui/src/pages/AchievementsRoutePage.tsx`
- `apps/api/src/modules/achievement/achievement.utils.ts`
- `apps/api/src/modules/achievement/achievement.utils.test.ts`
- `apps/api/src/modules/achievement/achievement.resolver.ts`
- `apps/api/src/modules/stats/stats-commentary.route.ts`

## 배포와 운영

| 대상 | 실행 조건 | 진행 내용 |
| --- | --- | --- |
| Web UI 개발 채널 | `develop` 브랜치의 Web UI 관련 파일 변경 | GitHub Actions가 Web UI를 빌드하고 개발용 Cloudflare R2 버킷에 업로드합니다. |
| Web UI 운영 채널 | `master` 브랜치의 Web UI 관련 파일 변경 | GitHub Actions가 Web UI를 빌드하고 운영용 Cloudflare R2 버킷에 업로드합니다. |
| Native dev 최소 버전 정책 | `develop` 브랜치의 정책 파일 변경 | GitHub Actions가 `dev` 항목을 개발용 R2 버킷의 `native/latest.json`으로 갱신합니다. |
| Native prod 최소 버전 정책 | `master` 브랜치의 정책 파일 변경 | GitHub Actions가 `prod` 항목을 운영용 R2 버킷의 `native/latest.json`으로 갱신합니다. |
| API | Google Cloud의 Cloud Build 트리거 | `apps/api/Dockerfile`로 이미지를 만들어 Cloud Run에서 실행합니다. 트리거의 브랜치와 배포 조건은 저장소가 아닌 Google Cloud에서 관리합니다. |
| 서버 푸시 배치 | Cloud Scheduler 5분 주기 | 배치 엔드포인트를 호출해 오늘 할 일 등록과 미완료 할 일 리마인드 대상을 확인합니다. |
| Native | `pnpm native:prod` 수동 실행 | EAS production 환경변수와 프로필을 사용해 iOS 원격 빌드 후 App Store Connect에 자동 제출합니다. |

Web UI R2 배포 워크플로는 현재 manifest의 patch 버전을 올리고, 빌드 결과를 `web-ui.zip`으로 묶어 SHA-256이 포함된 새 manifest를 만듭니다. 버전별 경로와 `latest/manifest.json`을 함께 갱신한 뒤 최근 5개 릴리즈만 남깁니다. Native 최소 버전 정책은 별도 워크플로가 `native/latest.json`으로 배포합니다.

관련 파일:

- `.github/workflows/deploy-webui-dev-r2.yml`
- `.github/workflows/deploy-webui-prod-r2.yml`
- `.github/workflows/deploy-native-version-dev-r2.yml`
- `.github/workflows/deploy-native-version-prod-r2.yml`
- `scripts/prune-r2-webui-releases.mjs`
- `apps/api/Dockerfile`

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

앱별 구조, 실행 명령어와 환경변수는 각 README에 정리되어 있습니다.

| 문서 | 내용 |
| --- | --- |
| [API README](./apps/api/README.md) | Fastify, Apollo GraphQL, Prisma 기반 API 서버 실행과 환경변수 |
| [Web UI README](./apps/web-ui/README.md) | React, Vite 기반 Web UI 구조, API 연결, 브릿지 메시지 |
| [Native README](./apps/mobile/README.md) | Expo, React Native 기반 WebView 앱, 네이티브 설정, Web UI 자동 패치 |

## 실행 방법

루트 `package.json`은 `pnpm@10.20.0`을 기준으로 합니다.

```bash
pnpm install
```

| 목적 | 명령어 |
| --- | --- |
| Prisma Client 생성 | `pnpm api:prisma:generate` |
| API 개발 서버 실행 | `pnpm api:dev` |
| Web UI 개발 서버 실행 | `pnpm web:dev` |
| 설치된 Dev Client용 Metro 실행 | `pnpm native:start` |
| 실행 중인 네이티브 앱에 Web UI 재빌드·반영 | `pnpm native:sync:web` |
| iOS 시뮬레이터 테스트 | `pnpm native:ios:local` |
| 연결된 iPhone과 Metro 테스트 | `pnpm native:ios:device` |
| Xcode archive 및 수동 TestFlight 테스트 준비 | `pnpm native:ios:dev` |
| Expo EAS production 빌드 및 제출 | `pnpm native:prod` |

iOS 검증은 `native:ios:local → native:ios:device → native:ios:dev → native:prod` 순서로 진행합니다. 단계별 `EXPO_PUBLIC_API_ORIGIN` 설정과 실행 조건은 [Native README](./apps/mobile/README.md)에 정리되어 있습니다.

## 환경변수

API 실행에는 최소 `DATABASE_URL`이 필요합니다. OpenAI 코멘터리, OAuth, 알림 배치, Sentry는 선택 환경변수로 분리되어 있습니다.

Native는 Expo config 단계에서 카카오와 네이버 네이티브 로그인 값을 검증합니다.

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
