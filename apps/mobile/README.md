# Mobile

`apps/mobile`은 Expo, React Native 기반 모바일 앱입니다. Web UI를 WebView로 실행하고, 네이티브 로그인, 알림, 위치, 날씨, iOS Live Activity, WebUI 버전 업데이트를 담당합니다.

[루트 README](../../README.md)에는 전체 앱 구성과 공통 실행 흐름을 정리해 두었습니다.

## 역할

- Web UI 임베드 번들을 WebView에 로드합니다.
- Cloudflare R2 원격 manifest를 확인해 WebUI 번들을 업데이트합니다.
- 카카오, 네이버, Apple 네이티브 로그인을 Web UI와 API에 연결합니다.
- 알림 권한 확인, 로컬 알림 예약/취소, Expo Push Token 조회를 처리합니다.
- 위치 권한과 날씨 snapshot을 Web UI에 제공합니다.
- iOS Live Activity 시작, 갱신, 종료, control event ack를 처리합니다.
- test/prod 네이티브 설정과 로컬 네이티브 프로젝트 동기화 스크립트를 관리합니다.

## 구조

```text
apps/mobile
├── app
├── assets
├── components
├── constants
├── hooks
├── plugins
├── scripts
├── src
│   └── features
│       ├── bridge
│       ├── notifications
│       ├── permissions
│       ├── version
│       ├── weather
│       └── webui
├── targets
├── app.config.ts
├── app.json
├── eas.json
└── native.config.json
```

| 경로 | 설명 |
| --- | --- |
| `app/index.tsx` | WebView 앱 진입점과 네이티브 기능 연결을 담당합니다. |
| `src/features/bridge` | WebView 브릿지 메시지 라우팅과 핸들러를 관리합니다. |
| `src/features/webui` | 임베드 번들, 원격 manifest, bundle 교체 worker를 관리합니다. |
| `src/features/notifications` | 로컬 알림과 푸시 토큰 브릿지 hook을 제공합니다. |
| `src/features/weather` | 네이티브 날씨 레이어와 Skia 기반 날씨 효과를 제공합니다. |
| `src/features/version` | 네이티브 앱 업데이트 필요 모달을 제공합니다. |
| `plugins/focus-live-activity` | iOS Live Activity target 연결용 Expo config plugin입니다. |
| `targets/focus-live-activity` | iOS Live Activity widget target 소스입니다. |
| `scripts/sync-native-config.js` | variant별 네이티브 프로젝트 설정을 동기화합니다. |

## 빠른 시작

먼저 모바일 환경변수를 준비합니다. Expo config가 카카오와 네이버 네이티브 로그인 값을 필수로 검증하므로, 아래 필수 값이 없으면 앱 설정 단계에서 오류가 발생합니다.

```bash
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=
EXPO_PUBLIC_NAVER_CONSUMER_KEY=
EXPO_PUBLIC_NAVER_CONSUMER_SECRET=
EXPO_PUBLIC_NAVER_URL_SCHEME=
```

루트 디렉터리 기준으로 실행합니다.

```bash
pnpm install
pnpm mobile:start
```

앱 디렉터리 기준으로는 아래 명령을 사용할 수 있습니다.

```bash
pnpm -C apps/mobile start
```

LAN/dev-client 기준 실행은 아래 명령을 사용합니다.

```bash
pnpm mobile:start:lan
```

Web UI를 빌드해 앱에 임베드한 뒤 실행할 때는 아래 명령을 사용합니다.

```bash
pnpm hybrid:start
```

## 환경변수 로드 방식

`app.config.ts`는 앱 루트 기준으로 아래 파일을 순서대로 읽습니다.

1. `.env`
2. `.env.local`
3. `APP_VARIANT`에 맞는 variant env
4. variant env의 `.local` 파일

`APP_VARIANT` 기본값은 `test`입니다. `prod` 또는 `production`에서는 `.env.production`, `.env.prod`를 읽고, `test`에서는 `.env.test`를 읽습니다. variant env와 variant local env는 기존 값보다 우선합니다.

## 환경변수

### 필수

| 변수 | 설명 |
| --- | --- |
| `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY` | 카카오 네이티브 로그인 앱 키입니다. |
| `EXPO_PUBLIC_NAVER_CONSUMER_KEY` | 네이버 네이티브 로그인 Client ID입니다. |
| `EXPO_PUBLIC_NAVER_CONSUMER_SECRET` | 네이버 네이티브 로그인 Client Secret입니다. |
| `EXPO_PUBLIC_NAVER_URL_SCHEME` | 네이버 로그인 URL scheme입니다. |

### 선택

| 변수 | 설명 |
| --- | --- |
| `APP_VARIANT` | 네이티브 설정 variant입니다. 기본값은 `test`이며 production 빌드는 `prod`를 사용합니다. |
| `EXPO_PUBLIC_API_ORIGIN` | 모바일 WebView에서 사용할 API 서버 origin입니다. |
| `EXPO_PUBLIC_API_BASE_URL` | `EXPO_PUBLIC_API_ORIGIN`이 없을 때 사용하는 legacy fallback입니다. |
| `EXPO_PUBLIC_APP_SCHEME` | 앱 딥링크 scheme입니다. 없으면 variant 설정을 사용합니다. |
| `EXPO_PUBLIC_NAVER_APP_NAME` | 네이버 로그인에 전달할 앱 이름입니다. |
| `EXPO_PUBLIC_NAVER_DISABLE_APP_AUTH_IOS` | iOS에서 네이버 앱 인증을 비활성화할지 결정합니다. |
| `EXPO_PUBLIC_WEBUI_CHANNEL` | WebUI 업데이트 채널입니다. `dev`, `prod`, `none`을 사용할 수 있습니다. |
| `EXPO_PUBLIC_WEBUI_MANIFEST_URL` | 원격 WebUI `latest/manifest.json` URL입니다. |
| `EXPO_PUBLIC_IOS_APP_STORE_URL` | 강제 업데이트 안내에서 이동할 iOS App Store URL입니다. |
| `EXPO_PUBLIC_ANDROID_PLAY_STORE_URL` | 강제 업데이트 안내에서 이동할 Android Play Store URL입니다. |
| `EXPO_PUBLIC_WEATHER_RENDERER` | 날씨 레이어 renderer를 `legacy` 또는 `skia`로 override합니다. |

`EXPO_PUBLIC_` 값은 앱 JS 번들에 빌드 시점에 포함됩니다. EAS 환경변수를 바꿔도 기존 설치 앱에 바로 반영되지 않으므로 새 빌드가 필요합니다.

## API origin 결정

모바일 앱은 WebView에 주입할 API origin을 다음 순서로 결정합니다.

1. `EXPO_PUBLIC_API_ORIGIN`
2. `EXPO_PUBLIC_API_BASE_URL`
3. Expo dev server host가 LAN 주소이면 `http://<host>:4000`
4. `http://localhost:4000`

값 끝의 `/graphql`은 제거하고 origin만 사용합니다. Web UI는 주입된 값을 `window.__HYBRID_API_ORIGIN__`으로 받아 GraphQL endpoint를 구성합니다.

## 네이티브 설정

`native.config.json`은 test/prod 네이티브 설정과 WebUI 최소 네이티브 버전을 관리합니다.

| 항목 | 기준 |
| --- | --- |
| prod 앱 이름, scheme, bundle id, package | `native.config.json`의 `prod` 값입니다. |
| test 앱 이름, scheme, bundle id, package | `native.config.json`의 `test` 값입니다. |
| prod 사용자 표시 버전 | `app.json`의 `expo.version`을 사용합니다. |
| prod iOS buildNumber, Android versionCode | EAS remote와 `production.autoIncrement`를 사용합니다. |
| test 버전과 build number | `native.config.json`의 `test.ios`, `test.android` 값을 사용합니다. |
| WebUI 최소 네이티브 버전 | `native.config.json`의 `webUi.minimumNativeVersion`을 사용합니다. |

로컬 Xcode 또는 Android Studio 프로젝트를 열기 전에 variant 기준으로 설정을 동기화합니다.

```bash
pnpm -C apps/mobile native:sync:test
pnpm -C apps/mobile native:sync:prod
```

호환용 alias인 `native:version:sync`, `native:version:sync:test`, `native:version:sync:prod`도 유지되어 있습니다.

## WebUI 번들 업데이트

앱은 시작 시 내장 WebUI 번들을 active 디렉터리에 준비합니다. `EXPO_PUBLIC_WEBUI_CHANNEL`이 `none`이 아니고 `EXPO_PUBLIC_WEBUI_MANIFEST_URL`이 있으면 원격 manifest를 조회합니다.

원격 manifest 버전이 현재 저장된 버전보다 높으면 `web-ui.zip`을 staging 경로에 내려받아 압축 해제합니다. 압축 안에 `index.html`이 있는지 확인한 뒤 active 번들로 교체하고, `crossorigin` 속성은 로컬 파일 실행에 맞게 제거합니다.

manifest의 `minimumNativeVersion`이 현재 앱 버전보다 높으면 번들을 적용하지 않고 업데이트 안내를 표시합니다. 원격 manifest 조회나 bundle 설치에 실패하면 시작 오류 alert를 띄웁니다. 채널이 `none`이거나 manifest URL이 없으면 내장 번들을 기준으로 실행합니다.

WebUI 버전과 앱 버전은 서로 다르게 관리합니다.

| 값 | 기준 |
| --- | --- |
| 앱 버전 | `app.json`의 `expo.version` 또는 test variant의 `native.config.json` 버전입니다. |
| WebUI 버전 | R2 `latest/manifest.json`의 `version`입니다. |
| 최소 네이티브 버전 | R2 manifest의 `minimumNativeVersion`입니다. |

## 브릿지 메시지

Web UI와 Mobile은 WebView bridge를 통해 JSON 문자열을 주고받습니다. Mobile 쪽 라우터는 `src/features/bridge/routeWebViewBridgeMessage.ts`에서 sync, notification, version, auth, focusLiveActivity, location handler 순서로 메시지를 처리합니다.

기본 메시지 형식은 아래와 같습니다.

```json
{
  "type": "REST_AUTH_KAKAO_LOGIN_REQUEST",
  "requestId": "optional-request-id",
  "payload": {}
}
```

| 영역 | Web UI 요청 | Mobile 응답 또는 처리 |
| --- | --- | --- |
| 인증 | `REST_AUTH_*_LOGIN_REQUEST`, `REST_AUTH_*_UNLINK_REQUEST` | `REST_AUTH_*_LOGIN_RESULT`, `REST_AUTH_*_UNLINK_RESULT`를 반환합니다. |
| 알림 | `REST_NOTIFICATION_PERMISSION_*`, `REST_NOTIFICATION_SCHEDULE`, `REST_NOTIFICATION_CANCEL`, `REST_PUSH_TOKEN_REQUEST` | 권한 snapshot, push token, 로컬 알림 예약/취소를 처리합니다. |
| 위치 | `REST_LOCATION_PERMISSION_*`, `REST_LOCATION_COORDINATES_REQUEST` | 위치 권한과 좌표 snapshot을 반환합니다. |
| 동기화 | `REST_AUTH_STATE_SYNC`, `REST_TODO_VIEW_SYNC`, `REST_WEATHER_SETTINGS_SYNC` | 네이티브 상태와 날씨 레이어 설정에 반영합니다. |
| 버전 | `REST_APP_VERSION_INFO_REQUEST` | 앱 버전, WebUI 버전, 채널 정보를 반환합니다. |
| Live Activity | `REST_FOCUS_LIVE_ACTIVITY_*` | iOS Live Activity를 시작, 갱신, 종료하거나 control event ack를 처리합니다. |

## EAS 빌드

`eas.json`은 profile별로 `APP_VARIANT`를 설정합니다.

| profile | distribution | environment | APP_VARIANT |
| --- | --- | --- | --- |
| `development` | `store` | `development` | `test` |
| `preview` | `internal` | `preview` | `test` |
| `production` | 기본값 | `production` | `prod` |

production 빌드가 prod R2 manifest를 읽으려면 EAS production env에 아래 값이 포함되어야 합니다.

```bash
EXPO_PUBLIC_WEBUI_CHANNEL=prod
EXPO_PUBLIC_WEBUI_MANIFEST_URL=https://<prod-r2-public-base-url>/latest/manifest.json
```

## 주요 스크립트

| 명령어 | 설명 |
| --- | --- |
| `pnpm -C apps/mobile start` | Expo 개발 서버를 실행합니다. |
| `pnpm -C apps/mobile hybrid` | dev-client, LAN, 8081 기준 Expo 서버를 실행합니다. |
| `pnpm -C apps/mobile android` | Android 네이티브 앱을 실행합니다. |
| `pnpm -C apps/mobile ios` | iOS 네이티브 앱을 실행합니다. |
| `pnpm -C apps/mobile web` | Expo web 실행을 시작합니다. |
| `pnpm -C apps/mobile lint` | Expo lint를 실행합니다. |
| `pnpm -C apps/mobile native:sync` | 기본 variant 기준으로 네이티브 설정을 동기화합니다. |
| `pnpm -C apps/mobile native:sync:test` | test variant 네이티브 설정을 동기화합니다. |
| `pnpm -C apps/mobile native:sync:prod` | prod variant 네이티브 설정을 동기화합니다. |
| `pnpm -C apps/mobile reset-project` | Expo 기본 프로젝트 reset 스크립트를 실행합니다. |

## 테스트

현재 `apps/mobile`에는 별도 테스트 스크립트가 없습니다. 정적 확인은 lint를 사용합니다.

```bash
pnpm -C apps/mobile lint
```
