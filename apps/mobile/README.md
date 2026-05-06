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
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=
EXPO_PUBLIC_NAVER_CONSUMER_KEY=
EXPO_PUBLIC_NAVER_CONSUMER_SECRET=
EXPO_PUBLIC_NAVER_URL_SCHEME=
```

- `EXPO_PUBLIC_API_ORIGIN`: 모바일에서 호출할 API 서버 주소
- `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY`: 카카오 네이티브 로그인 앱 키
- `EXPO_PUBLIC_NAVER_CONSUMER_KEY`: 네이버 네이티브 로그인 Client ID
- `EXPO_PUBLIC_NAVER_CONSUMER_SECRET`: 네이버 네이티브 로그인 Client Secret
- `EXPO_PUBLIC_NAVER_URL_SCHEME`: 네이버 로그인 URL 스킴

## 3) 주요 스크립트

```bash
pnpm -C apps/mobile start
pnpm -C apps/mobile hybrid
pnpm -C apps/mobile android
pnpm -C apps/mobile ios
pnpm -C apps/mobile web
pnpm -C apps/mobile lint
```

## 4) 테스트

현재 `apps/mobile`은 별도 테스트 러너 스크립트가 없습니다.
테스트를 추가할 경우 `package.json`에 `test` 스크립트를 먼저 정의해서 사용하면 됩니다.
