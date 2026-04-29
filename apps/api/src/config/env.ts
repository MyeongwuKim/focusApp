import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const envFileDir = path.dirname(fileURLToPath(import.meta.url));
const apiRootDir = path.resolve(envFileDir, "../../");
const shouldLoadEnvLocal = process.env.USE_ENV_LOCAL !== "false";

dotenv.config({ path: path.join(apiRootDir, ".env") });
if (shouldLoadEnvLocal) {
  dotenv.config({ path: path.join(apiRootDir, ".env.local"), override: true });
}

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  WEB_UI_ORIGIN: z.url().default("http://localhost:5173"),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((origin) => origin.trim())
            .filter((origin) => origin.length > 0)
        : []
    ),
  CORS_ALLOW_NULL_ORIGIN: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  AUTH_SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  AUTH_SESSION_REFRESH_WINDOW_DAYS: z.coerce.number().int().positive().default(7),
  OAUTH_STATE_SECRET: z.string().min(1).default("dev-oauth-state-secret"),
  KAKAO_CLIENT_ID: z.string().min(1).optional(),
  KAKAO_CLIENT_SECRET: z.string().min(1).optional(),
  KAKAO_REDIRECT_URI: z.url().optional(),
  NAVER_CLIENT_ID: z.string().min(1).optional(),
  NAVER_CLIENT_SECRET: z.string().min(1).optional(),
  NAVER_REDIRECT_URI: z.url().optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  BATCH_API_SECRET: z.string().min(1).optional(),
  NOTIFICATION_BATCH_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  NOTIFICATION_BATCH_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),
  NOTIFICATION_BATCH_TIMEZONE: z.string().min(1).default("Asia/Seoul"),
  EXPO_ACCESS_TOKEN: z.string().min(1).optional(),
  SENTRY_DSN: z.url().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
