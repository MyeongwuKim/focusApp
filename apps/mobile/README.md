# Mobile App (`apps/mobile`)

Expo + React Native 기반 모바일 앱입니다.

## 1) 빠른 시작

```bash
# 루트에서
pnpm install

# 모바일 개발 서버 실행
pnpm -C apps/mobile start
```

## 2) 환경변수

```bash
EXPO_PUBLIC_API_ORIGIN=http://localhost:4000
EXPO_PUBLIC_APP_SCHEME=
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=
EXPO_PUBLIC_NAVER_CONSUMER_KEY=
EXPO_PUBLIC_NAVER_CONSUMER_SECRET=
EXPO_PUBLIC_NAVER_URL_SCHEME=
EXPO_PUBLIC_WEBUI_CHANNEL=dev
EXPO_PUBLIC_WEBUI_MANIFEST_URL=
EXPO_PUBLIC_FORCE_LAUNCH_OVERLAY=false
EXPO_PUBLIC_IOS_APP_STORE_URL=
EXPO_PUBLIC_ANDROID_PLAY_STORE_URL=
```

- `EXPO_PUBLIC_API_ORIGIN`: 모바일에서 호출할 API 서버 주소
- `EXPO_PUBLIC_APP_SCHEME`: 앱 자체 딥링크 스킴. 미설정 시 prod는 `mobile`, test는 `mobile-test` 사용
- `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY`: 카카오 네이티브 로그인 앱 키
- `EXPO_PUBLIC_NAVER_CONSUMER_KEY`: 네이버 네이티브 로그인 Client ID
- `EXPO_PUBLIC_NAVER_CONSUMER_SECRET`: 네이버 네이티브 로그인 Client Secret
- `EXPO_PUBLIC_NAVER_URL_SCHEME`: 네이버 로그인 URL 스킴
- `EXPO_PUBLIC_WEBUI_CHANNEL`: 웹UI 채널 선택값 (`dev`/`prod`/`none`, `none`은 원격 버전 체크 비활성화)
- `EXPO_PUBLIC_WEBUI_MANIFEST_URL`: 현재 환경에서 사용할 최신 manifest URL
- `EXPO_PUBLIC_FORCE_LAUNCH_OVERLAY`: `true`면 스플래시 애니메이션 오버레이 고정 표시
- `EXPO_PUBLIC_IOS_APP_STORE_URL`: 강제 업데이트 시 이동할 iOS App Store URL
- `EXPO_PUBLIC_ANDROID_PLAY_STORE_URL`: 강제 업데이트 시 이동할 Android Play Store URL

## 3) 주요 스크립트

```bash
pnpm -C apps/mobile start
pnpm -C apps/mobile hybrid
pnpm -C apps/mobile native:sync:test
pnpm -C apps/mobile android
pnpm -C apps/mobile ios
pnpm -C apps/mobile web
pnpm -C apps/mobile lint
```

## 4) 네이티브 설정 관리

모바일 앱은 prod와 test 네이티브 설정 기준을 분리해서 관리합니다.

- prod/test 앱 이름, 앱 스킴, iOS Bundle ID, Android Application ID는 `native.config.json` 기준으로 관리
- prod 사용자 표시 버전은 `app.json`의 `expo.version`을 기준으로 관리
- prod iOS `buildNumber`, Android `versionCode`는 EAS remote와 `production.autoIncrement`로 관리
- test 버전은 `native.config.json`의 `test.ios`, `test.android` 값을 기준으로 관리
- test 빌드 번호는 직접 관리하기 위해 `development.autoIncrement` 비활성화
- 웹UI가 요구하는 최소 네이티브 버전은 `native.config.json`의 `webUi.minimumNativeVersion` 기준으로 R2 manifest에 포함

```json
{
  "webUi": {
    "minimumNativeVersion": {
      "ios": "1.0.0",
      "android": "1.0.0"
    }
  },
  "test": {
    "appName": "타임스택 (T)",
    "appScheme": "mobile-test",
    "ios": {
      "bundleIdentifier": "com.myeongwu.focushybrid.t",
      "version": "1.0.0",
      "buildNumber": "3"
    },
    "android": {
      "package": "com.myeongwu.focushybrid.t",
      "version": "1.0.0",
      "versionCode": 1
    }
  }
}
```

Expo/EAS 빌드는 `app.config.ts`가 `native.config.json`을 읽어 variant별 설정을 반영합니다.

R2 웹UI 배포 workflow는 같은 파일의 `webUi.minimumNativeVersion`을 읽어 `manifest.json`에 포함합니다. 앱은 시작 시 manifest의 최소 네이티브 버전을 현재 앱 버전과 비교하고, 미달이면 웹 번들 적용을 막습니다.

Xcode와 Android Studio는 `native.config.json`을 직접 읽지 않기 때문에, 로컬 네이티브 프로젝트를 직접 열기 전에는 아래 명령으로 값을 동기화합니다.

```bash
pnpm -C apps/mobile native:sync:test
```

이 명령은 `native.config.json` 값을 읽어서 아래 파일에 반영합니다.

- `ios/app.xcodeproj/project.pbxproj`
- `ios/app/Info.plist`
- `android/app/build.gradle`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/res/values/strings.xml`

prod 기준으로 로컬 네이티브 프로젝트를 맞춰야 할 때는 아래 명령을 사용합니다.

```bash
pnpm -C apps/mobile native:sync:prod
```

기존 `native:version:sync:*` 명령도 호환용 alias로 유지합니다.

## 5) 테스트

현재 `apps/mobile`은 별도 테스트 러너 스크립트가 없습니다.
테스트를 추가할 경우 `package.json`에 `test` 스크립트를 먼저 정의해서 사용하면 됩니다.
