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

로컬 테스트 시 아래 변수만 사용합니다.

```bash
PORT=4000
DATABASE_URL=...
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
KAKAO_REDIRECT_URI=
WEB_UI_ORIGIN=http://localhost:5173
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
NAVER_REDIRECT_URI=
NOTIFICATION_BATCH_ENABLED=false
NOTIFICATION_BATCH_INTERVAL_SECONDS=60
NOTIFICATION_BATCH_TIMEZONE=Asia/Seoul
BATCH_API_SECRET=
SENTRY_DSN=
```

- `PORT`: API 서버 포트
- `DATABASE_URL`: Prisma 연결 MongoDB 주소
- `OPENAI_API_KEY`: OpenAI API 키
- `OPENAI_MODEL`: OpenAI 모델 이름
- `KAKAO_CLIENT_ID`: 카카오 REST API 키
- `KAKAO_CLIENT_SECRET`: 카카오 Client Secret
- `KAKAO_REDIRECT_URI`: 카카오 콜백 URI
- `WEB_UI_ORIGIN`: 웹 앱 기준 주소
- `NAVER_CLIENT_ID`: 네이버 Client ID
- `NAVER_CLIENT_SECRET`: 네이버 Client Secret
- `NAVER_REDIRECT_URI`: 네이버 콜백 URI
- `NOTIFICATION_BATCH_ENABLED`: 배치 알림 기능 활성화 여부
- `NOTIFICATION_BATCH_INTERVAL_SECONDS`: 배치 실행 간격(초)
- `NOTIFICATION_BATCH_TIMEZONE`: 배치 시간대
- `BATCH_API_SECRET`: 배치 실행 보호용 시크릿 헤더 값
- `SENTRY_DSN`: 서버 Sentry DSN

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
