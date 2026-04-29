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

`apps/mobile/.env.local` 파일을 사용합니다.

```bash
EXPO_PUBLIC_API_ORIGIN=http://localhost:4000
EXPO_PUBLIC_WEATHER_RENDERER=legacy
```

- `EXPO_PUBLIC_API_ORIGIN` 미설정 시 앱이 자동으로 host를 추론해 API origin을 구성합니다.
- `EXPO_PUBLIC_WEATHER_RENDERER`는 `legacy` 또는 `skia`를 사용할 수 있습니다.

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

