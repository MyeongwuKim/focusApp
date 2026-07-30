# API

`apps/api`는 Fastify, Apollo GraphQL, Prisma 기반 API 서버입니다. 사용자 인증, 할 일과 루틴 데이터, 통계, 업적, 알림 설정, 푸시 토큰, AI 코멘터리, 알림 배치를 담당합니다.

[루트 README](../../README.md)에는 전체 앱 구성과 공통 실행 흐름을 정리해 두었습니다.

## 역할

- Apollo GraphQL endpoint를 Fastify 서버에 연결합니다.
- 카카오, 네이버 Web OAuth 시작/콜백과 카카오, 네이버, Apple 네이티브 로그인 토큰 교환을 처리합니다.
- Bearer token 기반 세션을 생성, 갱신, 검증, 삭제합니다.
- Prisma Client로 MongoDB의 사용자별 할 일, 루틴, 일일 기록, 알림 설정, 업적 데이터를 다룹니다.
- OpenAI API를 사용해 통계 코멘터리와 동기부여 메시지를 생성합니다.
- Expo Push API를 사용하는 서버 알림 배치와 수동 실행 endpoint를 제공합니다.
- Sentry DSN이 설정된 경우 서버 오류와 GraphQL 오류를 수집합니다.

## 구조

```text
apps/api
├── prisma
│   └── schema.prisma
├── scripts
└── src
    ├── app.ts
    ├── server.ts
    ├── common
    ├── config
    ├── graphql
    └── modules
```

| 경로 | 설명 |
| --- | --- |
| `src/app.ts` | Fastify, Apollo, CORS, 인증 가드, 라우트를 구성합니다. |
| `src/server.ts` | 서버 listen과 알림 배치 scheduler 시작/종료를 처리합니다. |
| `src/config/env.ts` | API 환경변수를 로드하고 Zod로 검증합니다. |
| `src/graphql` | GraphQL schema, context, resolver 결합을 관리합니다. |
| `src/common` | Prisma, 세션, 오류 변환, Sentry 같은 공통 기능을 제공합니다. |
| `src/modules/*` | 도메인별 resolver, service, repository, route를 배치합니다. |
| `prisma/schema.prisma` | MongoDB Prisma 모델을 정의합니다. |

## 도메인 구성

| 모듈 | 담당 기능 |
| --- | --- |
| `auth` | OAuth, 네이티브 로그인, 로그아웃, 계정 삭제를 처리합니다. |
| `user` | 현재 사용자 조회와 사용자 기본 정보를 다룹니다. |
| `daily-log` | 날짜별 할 일, 메모, 집중/휴식 기록을 관리합니다. |
| `task-collection` | 할 일 컬렉션과 컬렉션 내부 task를 관리합니다. |
| `routine-template` | 루틴 템플릿과 요일별 루틴 배정을 관리합니다. |
| `notification-settings` | 사용자별 알림 설정과 리마인드 기준을 저장합니다. |
| `push-device-token` | Expo push token 등록과 비활성화를 처리합니다. |
| `achievement` | 업적 진행도와 달성 이력을 계산합니다. |
| `stats` | 통계 코멘터리 생성 REST route를 제공합니다. |
| `motivation` | 동기부여 메시지 생성 REST route를 제공합니다. |
| `notification-batch` | 서버 푸시 알림 배치와 수동 실행 route를 제공합니다. |

## 빠른 시작

루트 디렉터리 기준으로 실행합니다.

```bash
pnpm install
pnpm api:prisma:generate
pnpm api:dev
```

앱 디렉터리 기준으로는 아래 명령을 사용할 수 있습니다.

```bash
pnpm -C apps/api prisma:generate
pnpm -C apps/api dev
```

기본 서버 주소는 `http://localhost:4000`입니다. 서버는 `0.0.0.0`에 listen하므로 모바일 LAN 개발에서도 같은 API 서버를 사용할 수 있습니다.

## Endpoint

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `POST` | `/graphql` | 인증이 필요한 GraphQL API입니다. |
| `GET` | `/auth/kakao/start` | 카카오 Web OAuth를 시작합니다. |
| `GET` | `/auth/kakao/callback` | 카카오 Web OAuth callback을 처리합니다. |
| `GET` | `/auth/naver/start` | 네이버 Web OAuth를 시작합니다. |
| `GET` | `/auth/naver/callback` | 네이버 Web OAuth callback을 처리합니다. |
| `POST` | `/auth/kakao/native` | 카카오 네이티브 access token을 세션으로 교환합니다. |
| `POST` | `/auth/naver/native` | 네이버 네이티브 access token을 세션으로 교환합니다. |
| `POST` | `/auth/apple/native` | Apple identity token을 세션으로 교환합니다. |
| `POST` | `/auth/logout` | 현재 세션을 로그아웃합니다. |
| `POST` | `/auth/account/delete` | 현재 계정을 삭제합니다. |
| `POST` | `/api/stats/commentary` | 통계 코멘터리를 생성합니다. |
| `GET` | `/api/motivation/message` | 동기부여 메시지를 생성합니다. |
| `POST` | `/api/notifications/batch/run` | 알림 배치를 수동 실행합니다. |

`/graphql`과 `/api/*` 경로는 기본적으로 Bearer token 인증을 거칩니다. `/api/notifications/batch/run`은 인증 가드에서는 제외되지만, `BATCH_API_SECRET`이 설정되어 있으면 `x-batch-secret` 헤더로 보호합니다.

## 환경변수

`src/config/env.ts`는 `apps/api/.env`를 먼저 읽습니다. `USE_ENV_LOCAL=true`를 설정하면 `apps/api/.env.local`도 override 방식으로 읽습니다.

### 필수

| 변수 | 설명 |
| --- | --- |
| `DATABASE_URL` | Prisma가 사용할 MongoDB 연결 문자열입니다. |

### 선택

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` | `4000` | API 서버 포트입니다. |
| `WEB_UI_ORIGIN` | `http://localhost:5173` | 기본 Web UI origin입니다. |
| `CORS_ALLOWED_ORIGINS` | 빈 목록 | 콤마로 구분한 추가 CORS origin 목록입니다. |
| `CORS_ALLOW_NULL_ORIGIN` | `true` | `file://` WebView origin 허용 여부입니다. |
| `AUTH_SESSION_TTL_DAYS` | `30` | 세션 만료 기간입니다. |
| `AUTH_SESSION_REFRESH_WINDOW_DAYS` | `7` | 세션 만료 갱신 기준 기간입니다. |
| `OAUTH_STATE_SECRET` | `dev-oauth-state-secret` | OAuth state 서명용 secret입니다. |
| `OAUTH_NATIVE_REDIRECT_SCHEMES` | `mobile,mobile-test` | 네이티브 OAuth redirect 허용 scheme 목록입니다. |
| `KAKAO_CLIENT_ID` | 없음 | 카카오 REST API 키입니다. |
| `KAKAO_CLIENT_SECRET` | 없음 | 카카오 Client Secret입니다. |
| `KAKAO_REDIRECT_URI` | 없음 | 카카오 OAuth callback URI입니다. |
| `NAVER_CLIENT_ID` | 없음 | 네이버 Client ID입니다. |
| `NAVER_CLIENT_SECRET` | 없음 | 네이버 Client Secret입니다. |
| `NAVER_REDIRECT_URI` | 없음 | 네이버 OAuth callback URI입니다. |
| `APPLE_CLIENT_IDS` | `com.myeongwu.focushybrid,com.myeongwu.focushybrid.t` | Apple identity token audience 목록입니다. |
| `OPENAI_API_KEY` | 없음 | 통계 코멘터리와 동기부여 메시지 생성에 사용하는 API 키입니다. |
| `OPENAI_MODEL` | `gpt-4.1-mini` | OpenAI 요청에 사용할 모델 이름입니다. |
| `BATCH_API_SECRET` | 없음 | 알림 배치 수동 실행 endpoint 보호용 secret입니다. |
| `NOTIFICATION_BATCH_ENABLED` | `false` | 서버 알림 배치 scheduler 활성화 여부입니다. |
| `NOTIFICATION_BATCH_INTERVAL_SECONDS` | `60` | 알림 배치 실행 간격입니다. |
| `NOTIFICATION_BATCH_TIMEZONE` | `Asia/Seoul` | 알림 배치와 날짜 계산 기준 시간대입니다. |
| `EXPO_ACCESS_TOKEN` | 없음 | Expo Push API 호출에 사용하는 access token입니다. |
| `SENTRY_DSN` | 없음 | 서버 Sentry DSN입니다. |
| `SENTRY_TRACES_SAMPLE_RATE` | `0` | Sentry traces sample rate입니다. |

## 주요 스크립트

| 명령어 | 설명 |
| --- | --- |
| `pnpm -C apps/api dev` | `tsx watch src/server.ts`로 개발 서버를 실행합니다. |
| `pnpm -C apps/api hybrid` | 개발 서버를 실행하는 alias입니다. |
| `pnpm -C apps/api build` | `tsconfig.build.json` 기준 TypeScript 빌드를 실행합니다. |
| `pnpm -C apps/api start` | `dist/server.js`를 실행합니다. |
| `pnpm -C apps/api test` | Vitest를 run 모드로 실행합니다. |
| `pnpm -C apps/api test:watch` | Vitest watch 모드를 실행합니다. |
| `pnpm -C apps/api prisma:generate` | Prisma Client를 생성합니다. |
| `pnpm -C apps/api prisma:push` | Prisma schema를 데이터베이스에 반영합니다. |
| `pnpm -C apps/api seed:user-rich-data` | 로컬 개발용 사용자 데이터를 생성합니다. |

## 테스트

```bash
pnpm -C apps/api test
pnpm -C apps/api build
```

현재 테스트 파일은 알림 설정, 알림 배치, 일일 로그 서비스, 공통 사용자 검증 유틸을 중심으로 구성되어 있습니다.
