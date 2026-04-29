# Web UI (`apps/web-ui`)

React + Vite 기반 웹 클라이언트입니다.

## 1) 빠른 시작

```bash
# 루트에서
pnpm install

# 웹 개발 서버 실행
pnpm -C apps/web-ui dev
```

- 기본 주소: `http://localhost:5173`

## 2) 환경변수

`apps/web-ui/.env` 또는 `apps/web-ui/.env.local` 파일을 사용합니다.

```bash
VITE_API_ORIGIN=http://localhost:4000
VITE_SENTRY_DSN=
```

- `VITE_API_ORIGIN`이 없으면 현재 origin 기준 상대 경로(`/graphql`)를 사용합니다.
- Sentry를 쓰지 않으면 `VITE_SENTRY_DSN`은 비워도 됩니다.

## 3) 주요 스크립트

```bash
pnpm -C apps/web-ui dev
pnpm -C apps/web-ui hybrid
pnpm -C apps/web-ui build
pnpm -C apps/web-ui preview
pnpm -C apps/web-ui lint
```

## 4) 테스트

단위/컴포넌트 테스트(Vitest):

```bash
pnpm -C apps/web-ui test
pnpm -C apps/web-ui test:watch
pnpm -C apps/web-ui test:coverage
```

E2E 테스트(Playwright):

```bash
pnpm -C apps/web-ui e2e:install
pnpm -C apps/web-ui e2e
pnpm -C apps/web-ui e2e:ui
pnpm -C apps/web-ui e2e:headed
```

