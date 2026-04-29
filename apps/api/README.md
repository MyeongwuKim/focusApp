# API 서버 (`apps/api`)

Fastify + Apollo GraphQL + Prisma 기반 API 서버입니다.

## 1) 빠른 시작

```bash
# 루트에서
pnpm install

# Prisma Client 생성
pnpm -C apps/api prisma:generate

# 개발 서버 실행
pnpm -C apps/api dev
```

- 기본 주소: `http://localhost:4000`
- GraphQL: `http://localhost:4000/graphql`
- Health: `http://localhost:4000/healthz`

## 2) 환경변수

`apps/api/.env` 파일을 직접 생성해서 사용합니다.

필수:

```bash
DATABASE_URL=...
```

자주 쓰는 항목:

```bash
PORT=4000
WEB_UI_ORIGIN=http://localhost:5173
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0
```

소셜 로그인 사용 시:

```bash
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
KAKAO_REDIRECT_URI=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
NAVER_REDIRECT_URI=
```

배치 기능 사용 시:

```bash
NOTIFICATION_BATCH_ENABLED=false
NOTIFICATION_BATCH_INTERVAL_SECONDS=60
NOTIFICATION_BATCH_TIMEZONE=Asia/Seoul
BATCH_API_SECRET=
EXPO_ACCESS_TOKEN=
```

## 3) 주요 스크립트

```bash
pnpm -C apps/api dev           # 로컬 개발 실행
pnpm -C apps/api hybrid        # 하이브리드(LAN) 개발 실행
pnpm -C apps/api build         # 빌드
pnpm -C apps/api start         # 빌드 산출물 실행
pnpm -C apps/api prisma:push   # 스키마 DB 반영
pnpm -C apps/api seed:user-rich-data
```

## 4) 테스트

```bash
pnpm -C apps/api test
pnpm -C apps/api test:watch
```

