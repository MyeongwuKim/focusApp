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
```

설치된 Dev Client에서 Metro만 다시 실행할 때는 아래 명령을 사용합니다.

```bash
pnpm native:start
```

실행 중인 앱에 Web UI 변경사항을 다시 빌드해 반영할 때는 아래 명령을 사용합니다.

```bash
pnpm native:sync:web
```

## iOS 테스트 및 배포 순서

네이티브 변경은 아래 순서로 확인합니다.

| 순서 | 명령어 | 확인 환경 | API origin |
| --- | --- | --- | --- |
| 1 | `pnpm native:ios:local` | iOS 시뮬레이터 | Mac에서 실행 중인 로컬 API 주소 |
| 2 | `pnpm native:ios:device` | 현재 연결된 iPhone과 Metro | iPhone에서 접근할 수 있는 Mac의 로컬 API 주소 |
| 3 | `pnpm native:ios:dev` | 로컬 Xcode archive와 수동 TestFlight 업로드 | Cloud Run API 주소 |
| 4 | `pnpm native:prod` | Expo EAS production 원격 빌드 및 App Store Connect 자동 제출 | EAS production 환경변수 |

로컬 테스트용 값은 커밋되지 않는 `apps/mobile/.env.test.local`에 두는 것을 권장합니다. `EXPO_PUBLIC_API_ORIGIN`에는 `/graphql`을 붙이지 않고 API origin만 입력합니다.

### 1. 시뮬레이터 테스트: `native:ios:local`

iOS 시뮬레이터에서 test variant를 먼저 확인합니다. 시뮬레이터는 Mac의 `localhost`에 접근할 수 있으므로 `EXPO_PUBLIC_API_ORIGIN`을 로컬 API 주소로 설정합니다.

```bash
# apps/mobile/.env.test.local
EXPO_PUBLIC_API_ORIGIN=http://localhost:4000
```

API 서버를 실행한 뒤 시뮬레이터를 시작합니다.

```bash
pnpm api:dev
pnpm native:ios:local
```

`native:ios:local`은 Web UI를 빌드해 앱에 임베드하고, test 네이티브 설정을 동기화한 뒤 iOS 시뮬레이터와 Metro를 실행합니다.

### 2. 연결된 iPhone 테스트: `native:ios:device`

현재 Mac에 연결된 iPhone에서 Dev Client와 Metro를 사용해 테스트할 때 실행합니다. 실제 iPhone에서 `localhost`는 iPhone 자신을 가리키므로, `EXPO_PUBLIC_API_ORIGIN`에는 iPhone에서 접근 가능한 Mac의 LAN 주소를 입력합니다.

```bash
# apps/mobile/.env.test.local
EXPO_PUBLIC_API_ORIGIN=http://<Mac의-LAN-IP>:4000
```

```bash
pnpm api:dev
pnpm native:ios:device
```

명령을 실행하면 Expo 기기 선택 화면에서 연결된 iPhone을 고르고, test 앱을 빌드·설치한 뒤 Metro에 연결합니다. iPhone과 Mac은 같은 네트워크를 사용해야 하며, 로컬 API 포트에 접근할 수 있어야 합니다. 앱이 이미 설치되어 있다면 `pnpm native:start`로 Metro만 다시 실행할 수 있습니다.

Web UI만 수정한 경우에는 Metro가 실행 중인 상태에서 `pnpm native:sync:web`을 실행하면 Web UI 재빌드 후 연결된 앱을 재시작합니다.

### 3. Xcode archive 및 수동 TestFlight 테스트: `native:ios:dev`

Xcode 프로젝트를 기준으로 archive를 만들고 직접 TestFlight에 올려 확인할 때 사용합니다. 로컬 API가 아닌 Cloud Run에 배포된 API 주소를 넣고 빌드합니다.

```bash
# apps/mobile/.env.test.local
EXPO_PUBLIC_API_ORIGIN=https://<Cloud-Run-API-도메인>
```

```bash
pnpm native:ios:dev
```

이 명령은 Web UI 임베드와 test 네이티브 설정 동기화 후 `apps/mobile/ios/T.xcworkspace`를 사용해 Xcode archive와 IPA를 생성합니다. archive는 `apps/mobile/dist/ios-dev-<빌드 시각>.xcarchive`, IPA는 `apps/mobile/dist/ios-dev-<빌드 시각>/`에 생성됩니다.

Expo/EAS에는 업로드하지 않으므로 TestFlight 배포는 생성된 archive를 Xcode Organizer에서 열어 App Store Connect에 직접 업로드합니다.

### 4. Expo production 빌드 및 제출: `native:prod`

최종 production 배포 단계에서는 프로젝트를 Expo EAS에 업로드하고 production profile로 원격 빌드를 진행한 뒤 App Store Connect로 자동 제출합니다.

```bash
pnpm native:prod
```

`eas.json`의 `production` profile이 `APP_VARIANT=prod`와 EAS의 `production` environment를 사용합니다. `EXPO_PUBLIC_API_ORIGIN`을 포함한 production 값은 Expo에 설정된 환경변수에서 읽으므로 로컬 `.env`를 production 값으로 바꿀 필요가 없습니다.

`native:prod`는 기존 `native:ios:prod`의 별칭입니다. `ios:prod` 스크립트가 `production` 제출 프로필과 `ascAppId`를 사용해 원격 빌드 완료 후 App Store Connect/TestFlight 제출까지 이어서 실행합니다. App Store 심사 제출과 공개 출시는 App Store Connect에서 별도로 진행합니다.

## 환경변수 로드 방식

`app.config.ts`는 앱 루트 기준으로 아래 파일을 순서대로 읽습니다.

1. `.env`
2. `.env.local`
3. `APP_VARIANT`에 맞는 variant env
4. variant env의 `.local` 파일

`APP_VARIANT` 기본값은 `test`입니다. `prod` 또는 `production`에서는 `.env.production`, `.env.prod`를 읽고, `dev` 또는 `test`에서는 `.env.test`를 읽습니다. `dev`에서는 `.env.dev`가 있으면 추가로 읽습니다. variant env와 variant local env는 기존 값보다 우선합니다.

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
| `EXPO_PUBLIC_MINIMUM_APP_VERSION_URL` | R2의 `native/latest.json` URL입니다. 없으면 WebUI manifest URL에서 자동으로 계산합니다. |
| `EXPO_PUBLIC_IOS_APP_STORE_URL` | 버전 정책에 `storeUrl`이 없을 때 사용할 iOS App Store URL입니다. |
| `EXPO_PUBLIC_ANDROID_PLAY_STORE_URL` | 버전 정책에 `storeUrl`이 없을 때 사용할 Android Play Store URL입니다. |
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

`app-version.json`은 dev/prod 앱 버전의 단일 기준입니다. `dev` 버전은 test 네이티브 variant에, `prod` 버전은 prod 네이티브 variant에 적용합니다. iOS와 Android 버전을 따로 지정할 수 있으며, 빌드 명령이 선택한 플랫폼 버전을 Expo 설정과 네이티브 프로젝트에 반영합니다.

`minimum-app-version.json`은 dev/prod 환경별 iOS·Android 최소 앱 버전 정책을 한곳에서 관리합니다. 각 플랫폼은 `enabled`, `minimumVersion`, `storeUrl`을 가지며, `enabled`가 `true`일 때만 강제 업데이트를 적용합니다. `develop`에서는 `dev` 항목만 개발용 R2로, `master`에서는 `prod` 항목만 운영용 R2의 `native/latest.json`으로 업로드됩니다. 이전 앱이 기존 경로를 계속 조회하므로 동일한 정책을 `native/minimum-app-version.json`에도 함께 업로드합니다. develop에서 prod 항목을 수정해도 운영용 R2에는 반영되지 않으며 해당 변경이 master에 병합된 뒤 배포됩니다.

`native.config.json`은 test/prod Xcode·Android 내부 프로젝트명, 앱 표시 이름, 앱 식별자와 빌드 번호 설정을 관리합니다. dev iOS 프로젝트는 Xcode에서 `timestackT`로 표시되지만 기기 홈 화면에서는 기존대로 `타임스택 (T)`를 사용합니다.

네이티브 빌드 명령을 실행하면 Web UI 빌드나 네이티브 설정 변경 전에 환경, 플랫폼, 앱 버전을 확인합니다. `y` 또는 `yes`를 입력해야 계속 진행하며, 그 외 입력은 전체 명령을 중단합니다.

```text
[native-sync] dev iOS 1.0.0 패키지를 생성할까요? (y/N)
```

CI처럼 대화형 입력을 사용할 수 없는 환경에서는 동기화 명령에 `--yes`를 전달합니다.

```bash
pnpm -C apps/mobile native:sync:prod -- --yes
```

| 항목 | 기준 |
| --- | --- |
| dev/test 내부 프로젝트명 | `native.config.json`의 `test.projectName`을 사용합니다. |
| prod 내부 프로젝트명 | `native.config.json`의 `prod.projectName`을 사용합니다. |
| prod 앱 이름, scheme, bundle id, package | `native.config.json`의 `prod` 값입니다. |
| test 앱 이름, scheme, bundle id, package | `native.config.json`의 `test` 값입니다. |
| dev/test 사용자 표시 버전 | `app-version.json`의 `dev.ios`, `dev.android`를 사용합니다. |
| prod 사용자 표시 버전 | `app-version.json`의 `prod.ios`, `prod.android`를 사용합니다. |
| prod iOS buildNumber, Android versionCode | EAS remote와 `production.autoIncrement`를 사용합니다. |
| test buildNumber, versionCode | `native.config.json`의 `test.ios`, `test.android` 값을 사용합니다. |
| dev 최소 앱 버전 정책 | `minimum-app-version.json`의 `dev` 설정을 사용합니다. |
| prod 최소 앱 버전 정책 | `minimum-app-version.json`의 `prod` 설정을 사용합니다. |

로컬 Xcode 또는 Android Studio 프로젝트를 열기 전에 variant 기준으로 설정을 동기화합니다.

```bash
pnpm -C apps/mobile native:sync:dev
pnpm -C apps/mobile native:sync:prod
```

## WebUI 번들 업데이트

앱은 진행 표시를 띄우기 전에 연결된 R2의 `native/latest.json`을 조회합니다. 현재 플랫폼의 `enabled`가 `true`이고 설치된 앱 버전이 `minimumVersion`보다 낮으면 업데이트 안내를 표시하며, 버튼은 해당 정책의 `storeUrl`로 이동합니다. 정책 조회에 실패하거나 `enabled`가 `false`이면 WebUI 준비를 계속합니다.

버전 확인을 통과하면 내장 WebUI 번들을 active 디렉터리에 준비합니다. `EXPO_PUBLIC_WEBUI_CHANNEL`이 `none`이 아니고 `EXPO_PUBLIC_WEBUI_MANIFEST_URL`이 있으면 원격 manifest를 조회합니다.

원격 manifest 버전이 현재 저장된 버전보다 높으면 `web-ui.zip`을 staging 경로에 내려받아 압축 해제합니다. 압축 안에 `index.html`이 있는지 확인한 뒤 active 번들로 교체하고, `crossorigin` 속성은 로컬 파일 실행에 맞게 제거합니다.

원격 manifest 조회나 bundle 설치에 실패하면 시작 오류 alert를 띄웁니다. 채널이 `none`이거나 manifest URL이 없으면 내장 번들을 기준으로 실행합니다.

실행 중인 Metro 앱에 Web UI 변경사항을 반영할 때는 저장소 루트에서 `pnpm native:sync:web`을 실행합니다. 웹 빌드와 임베드 번들 생성이 끝나면 연결된 iOS·Android 앱 프로세스를 재시작해 최신 Metro 번들과 WebView 파일을 자동으로 적용합니다.

WebUI 버전과 앱 버전은 서로 다르게 관리합니다.

| 값 | 기준 |
| --- | --- |
| 앱 버전 | `app-version.json`의 dev/prod 플랫폼별 버전입니다. |
| WebUI 버전 | R2 `latest/manifest.json`의 `version`입니다. |
| 최소 앱 버전 | 현재 환경 R2 `native/latest.json`의 플랫폼별 `minimumVersion`입니다. |

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

## 알림 처리

로컬 알림과 서버 푸시는 용도에 따라 나눠 처리합니다.

| 알림 | 처리 위치 | 동작 |
| --- | --- | --- |
| 휴식 종료 | Native | 휴식 시작 시 기기에 로컬 알림을 예약하고, 휴식을 취소하거나 끝내면 예약 상태를 정리합니다. |
| 집중 시작 | API | Cloud Scheduler가 실행한 서버 배치가 오늘 할 일이 비어 있는 사용자를 확인해 Expo Push API로 알림을 보냅니다. |
| 미완료 할 일 | API | 서버 배치가 아직 완료하지 않은 할 일과 사용자 설정을 확인해 Expo Push API로 알림을 보냅니다. |

Native는 알림 권한을 확인하고 Expo push token을 API에 등록합니다. 운영 환경에서는 Cloud Scheduler가 5분마다 `POST /api/notifications/batch/run`을 호출합니다. 배치가 실행되는 간격과 사용자가 설정한 리마인드 간격은 다르며, 실제 발송은 저장된 `nextReminderAt`이 지난 경우에만 진행됩니다.

관련 코드는 다음 위치에 있습니다.

- `src/features/notifications/hooks/useRestNotificationBridge.ts`: 로컬 알림과 push token 브릿지
- `../api/src/modules/notification-batch`: 서버 푸시 발송 대상 계산과 Expo Push API 호출
- `../api/src/modules/notification-settings`: 사용자별 알림 설정과 다음 발송 시각 저장

## EAS 빌드

`eas.json`은 Expo 원격 빌드에 사용하는 production profile만 관리합니다.

| profile | distribution | environment | APP_VARIANT |
| --- | --- | --- | --- |
| `production` | 기본값 | `production` | `prod` |

production 빌드가 prod R2 manifest를 읽으려면 EAS production env에 아래 값이 포함되어야 합니다.

```bash
EXPO_PUBLIC_API_ORIGIN=https://<Cloud-Run-API-도메인>
EXPO_PUBLIC_WEBUI_CHANNEL=prod
EXPO_PUBLIC_WEBUI_MANIFEST_URL=https://<prod-r2-public-base-url>/latest/manifest.json
EXPO_PUBLIC_MINIMUM_APP_VERSION_URL=https://<prod-r2-public-base-url>/native/latest.json
```

위 값은 Expo EAS의 `production` environment에서 관리합니다. `native:prod` 실행 전 로컬 환경변수 파일을 수정할 필요는 없습니다.

## 주요 스크립트

| 명령어 | 설명 |
| --- | --- |
| `pnpm -C apps/mobile start` | Expo 개발 서버를 실행합니다. |
| `pnpm -C apps/mobile android` | Android 네이티브 앱을 실행합니다. |
| `pnpm native:start` | 설치된 Dev Client가 연결할 Metro를 LAN 모드로 실행합니다. |
| `pnpm native:sync:web` | Web UI를 다시 빌드하고 연결된 iOS·Android 앱을 재시작해 Metro 앱에 자동 반영합니다. |
| `pnpm native:ios:local` | iOS 시뮬레이터에서 test 앱과 Metro를 실행합니다. |
| `pnpm native:ios:device` | 연결된 iPhone에 test 앱을 빌드·설치하고 Metro에 연결합니다. |
| `pnpm native:ios:dev` | Xcode 프로젝트로 archive와 IPA를 생성해 수동 TestFlight 테스트를 준비합니다. |
| `pnpm native:prod` | EAS production 환경변수로 원격 iOS 빌드 후 App Store Connect에 자동 제출합니다. |
| `pnpm native:ios:prod` | `native:prod`와 같은 production 빌드 및 자동 제출을 실행합니다. |
| `pnpm native:android:local` | Android 로컬 기기 또는 에뮬레이터에서 test 앱을 실행합니다. |
| `pnpm -C apps/mobile web` | Expo web 실행을 시작합니다. |
| `pnpm -C apps/mobile lint` | Expo lint를 실행합니다. |
| `pnpm -C apps/mobile native:sync:dev` | `app-version.json`의 dev 버전과 test variant 네이티브 설정을 동기화합니다. |
| `pnpm -C apps/mobile native:sync:test` | 기존 test 명령 호환용이며 dev 버전을 동기화합니다. |
| `pnpm -C apps/mobile native:sync:prod` | prod variant 네이티브 설정을 동기화합니다. |

## 검증

현재 `apps/mobile`에는 별도 단위 테스트 스크립트가 없습니다. 정적 확인 후 iOS 환경을 `local → device → dev → prod` 순서로 검증합니다.

```bash
pnpm -C apps/mobile lint
pnpm native:ios:local
pnpm native:ios:device
pnpm native:ios:dev
pnpm native:prod
```
