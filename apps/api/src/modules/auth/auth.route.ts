import { createHmac, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../common/prisma.js";
import { env } from "../../config/env.js";

type OAuthProvider = "kakao" | "naver";

interface ProviderProfile {
  providerUserId: string;
  email: string | null;
  name: string | null;
}

interface OAuthStatePayload {
  provider: OAuthProvider;
  redirectTo: string;
  issuedAt: number;
  nonce: string;
}

interface OAuthStartQuery {
  redirectTo?: string;
}

interface OAuthCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
}

const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

function toBase64Url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signOAuthState(payload: OAuthStatePayload): string {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", env.OAUTH_STATE_SECRET)
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifyOAuthState(rawState: string, expectedProvider: OAuthProvider): OAuthStatePayload {
  const [encodedPayload, signature] = rawState.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("INVALID_OAUTH_STATE");
  }

  const expectedSignature = createHmac("sha256", env.OAUTH_STATE_SECRET)
    .update(encodedPayload)
    .digest("base64url");

  if (signature !== expectedSignature) {
    throw new Error("INVALID_OAUTH_STATE");
  }

  const parsed = JSON.parse(fromBase64Url(encodedPayload)) as OAuthStatePayload;

  if (parsed.provider !== expectedProvider) {
    throw new Error("INVALID_OAUTH_STATE");
  }

  if (Date.now() - parsed.issuedAt > OAUTH_STATE_MAX_AGE_MS) {
    throw new Error("EXPIRED_OAUTH_STATE");
  }

  return parsed;
}

function resolveRedirectTo(rawRedirectTo: unknown): string {
  if (typeof rawRedirectTo !== "string" || !rawRedirectTo.trim()) {
    return `${env.WEB_UI_ORIGIN}/auth/callback`;
  }

  const parsed = rawRedirectTo.startsWith("/")
    ? new URL(rawRedirectTo, env.WEB_UI_ORIGIN)
    : new URL(rawRedirectTo);

  if (parsed.protocol === "file:" || parsed.protocol === "mobile:") {
    return parsed.toString();
  }

  if (parsed.origin !== env.WEB_UI_ORIGIN) {
    throw new Error("INVALID_REDIRECT_TO");
  }

  return parsed.toString();
}

function readQueryValue(rawValue: unknown): string | undefined {
  if (typeof rawValue === "string") {
    return rawValue;
  }

  if (Array.isArray(rawValue)) {
    const firstValue = rawValue[0];
    return typeof firstValue === "string" ? firstValue : undefined;
  }

  return undefined;
}

function parseOAuthStartQuery(query: unknown): OAuthStartQuery {
  if (!query || typeof query !== "object") {
    return {};
  }

  const asRecord = query as Record<string, unknown>;
  return {
    redirectTo: readQueryValue(asRecord.redirectTo),
  };
}

function parseOAuthCallbackQuery(query: unknown): OAuthCallbackQuery {
  if (!query || typeof query !== "object") {
    return {};
  }

  const asRecord = query as Record<string, unknown>;
  return {
    code: readQueryValue(asRecord.code),
    state: readQueryValue(asRecord.state),
    error: readQueryValue(asRecord.error),
  };
}

function appendErrorToRedirect(redirectTo: string, code: string): string {
  const url = new URL(redirectTo);
  url.searchParams.set("error", code);
  return url.toString();
}

function buildSyntheticEmail(provider: OAuthProvider, providerUserId: string): string {
  return `${provider}-${providerUserId}@oauth.local`;
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const json = (await response.json()) as T | { error?: unknown };

  if (!response.ok) {
    throw new Error(`OAUTH_HTTP_${response.status}`);
  }

  return json as T;
}

function getKakaoConfig() {
  if (!env.KAKAO_CLIENT_ID || !env.KAKAO_REDIRECT_URI) {
    throw new Error("KAKAO_OAUTH_NOT_CONFIGURED");
  }

  return {
    clientId: env.KAKAO_CLIENT_ID,
    clientSecret: env.KAKAO_CLIENT_SECRET,
    redirectUri: env.KAKAO_REDIRECT_URI,
  };
}

function getNaverConfig() {
  if (!env.NAVER_CLIENT_ID || !env.NAVER_CLIENT_SECRET || !env.NAVER_REDIRECT_URI) {
    throw new Error("NAVER_OAUTH_NOT_CONFIGURED");
  }

  return {
    clientId: env.NAVER_CLIENT_ID,
    clientSecret: env.NAVER_CLIENT_SECRET,
    redirectUri: env.NAVER_REDIRECT_URI,
  };
}

async function fetchKakaoProfile(code: string): Promise<ProviderProfile> {
  const config = getKakaoConfig();

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code,
  });

  if (config.clientSecret) {
    tokenBody.set("client_secret", config.clientSecret);
  }

  const tokenResponse = await fetchJson<{ access_token: string }>("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });

  const profile = await fetchJson<{
    id: number;
    kakao_account?: {
      email?: string;
      profile?: {
        nickname?: string;
      };
    };
  }>("https://kapi.kakao.com/v2/user/me", {
    headers: {
      Authorization: `Bearer ${tokenResponse.access_token}`,
    },
  });

  return {
    providerUserId: String(profile.id),
    email: profile.kakao_account?.email ?? null,
    name: profile.kakao_account?.profile?.nickname ?? null,
  };
}

async function fetchNaverProfile(code: string, state: string): Promise<ProviderProfile> {
  const config = getNaverConfig();

  const tokenUrl = new URL("https://nid.naver.com/oauth2.0/token");
  tokenUrl.searchParams.set("grant_type", "authorization_code");
  tokenUrl.searchParams.set("client_id", config.clientId);
  tokenUrl.searchParams.set("client_secret", config.clientSecret);
  tokenUrl.searchParams.set("code", code);
  tokenUrl.searchParams.set("state", state);

  const tokenResponse = await fetchJson<{ access_token: string }>(tokenUrl.toString(), {
    method: "GET",
  });

  const profile = await fetchJson<{
    response?: {
      id?: string;
      email?: string;
      name?: string;
      nickname?: string;
    };
  }>("https://openapi.naver.com/v1/nid/me", {
    headers: {
      Authorization: `Bearer ${tokenResponse.access_token}`,
    },
  });

  const response = profile.response;
  if (!response?.id) {
    throw new Error("NAVER_PROFILE_MISSING_ID");
  }

  return {
    providerUserId: response.id,
    email: response.email ?? null,
    name: response.name ?? response.nickname ?? null,
  };
}

async function signInWithProvider(
  provider: OAuthProvider,
  profile: ProviderProfile
): Promise<{ sessionToken: string; userId: string }> {
  if (!profile.providerUserId) {
    throw new Error("OAUTH_PROFILE_MISSING_ID");
  }

  const user = await prisma.$transaction(async (tx) => {
    const existingAccount = await tx.account.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: profile.providerUserId,
        },
      },
      include: {
        user: true,
      },
    });

    if (existingAccount) {
      const shouldUpdateName = !!profile.name && profile.name !== existingAccount.user.name;
      const shouldUpdateEmail =
        !!profile.email &&
        profile.email !== existingAccount.user.email &&
        !existingAccount.user.email.endsWith("@oauth.local");

      if (shouldUpdateName || shouldUpdateEmail) {
        const updateData: {
          name?: string;
          email?: string;
        } = {};

        if (shouldUpdateName && profile.name) {
          updateData.name = profile.name;
        }

        if (shouldUpdateEmail && profile.email) {
          updateData.email = profile.email;
        }

        return tx.user.update({
          where: { id: existingAccount.user.id },
          data: updateData,
        });
      }

      return existingAccount.user;
    }

    const requestedEmail = profile.email?.trim() ?? "";
    const requestedEmailOwner = requestedEmail
      ? await tx.user.findUnique({
          where: {
            email: requestedEmail,
          },
          select: {
            id: true,
          },
        })
      : null;

    const targetUser = await tx.user.create({
      data: {
        email: requestedEmail && !requestedEmailOwner
          ? requestedEmail
          : buildSyntheticEmail(provider, profile.providerUserId),
        name: profile.name,
      },
    });

    await tx.account.create({
      data: {
        provider,
        providerUserId: profile.providerUserId,
        userId: targetUser.id,
      },
    });

    return targetUser;
  });

  const sessionToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + env.AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      token: sessionToken,
      userId: user.id,
      expiresAt,
    },
  });

  return {
    sessionToken,
    userId: user.id,
  };
}

function registerProviderStartRoute(app: FastifyInstance, provider: OAuthProvider) {
  app.get(`/auth/${provider}/start`, async (request, reply) => {
    try {
      const query = parseOAuthStartQuery(request.query);
      const redirectTo = resolveRedirectTo(query.redirectTo);
      const state = signOAuthState({
        provider,
        redirectTo,
        issuedAt: Date.now(),
        nonce: randomBytes(12).toString("base64url"),
      });

      if (provider === "kakao") {
        const config = getKakaoConfig();
        const authUrl = new URL("https://kauth.kakao.com/oauth/authorize");
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("client_id", config.clientId);
        authUrl.searchParams.set("redirect_uri", config.redirectUri);
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("prompt", "login");
        authUrl.searchParams.set("scope", "profile_nickname account_email");
        return reply.redirect(authUrl.toString());
      }

      const config = getNaverConfig();
      const authUrl = new URL("https://nid.naver.com/oauth2.0/authorize");
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("client_id", config.clientId);
      authUrl.searchParams.set("redirect_uri", config.redirectUri);
      authUrl.searchParams.set("state", state);
      return reply.redirect(authUrl.toString());
    } catch (error) {
      request.log.error({ error }, `[auth] ${provider} start failed`);
      return reply.code(500).send({ message: "OAuth 시작 중 오류가 발생했어요." });
    }
  });
}

function registerProviderCallbackRoute(app: FastifyInstance, provider: OAuthProvider) {
  app.get(`/auth/${provider}/callback`, async (request, reply) => {
    const query = parseOAuthCallbackQuery(request.query);

    const fallbackRedirectTo = `${env.WEB_UI_ORIGIN}/auth/callback`;

    try {
      if (query.error) {
        return reply.redirect(appendErrorToRedirect(fallbackRedirectTo, query.error));
      }

      if (!query.code || !query.state) {
        return reply.redirect(appendErrorToRedirect(fallbackRedirectTo, "missing_code_or_state"));
      }

      const parsedState = verifyOAuthState(query.state, provider);

      const profile =
        provider === "kakao"
          ? await fetchKakaoProfile(query.code)
          : await fetchNaverProfile(query.code, query.state);

      const authResult = await signInWithProvider(provider, profile);
      const redirectUrl = new URL(parsedState.redirectTo);

      if (redirectUrl.protocol === "file:") {
        const hash = redirectUrl.hash.startsWith("#") ? redirectUrl.hash.slice(1) : redirectUrl.hash;
        const [rawHashPath, rawHashQuery] = hash.split("?");
        const nextHashPath = rawHashPath && rawHashPath.length > 0 ? rawHashPath : "/auth/callback";
        const nextHashParams = new URLSearchParams(rawHashQuery ?? "");
        nextHashParams.set("token", authResult.sessionToken);
        nextHashParams.set("userId", authResult.userId);
        redirectUrl.hash = `${nextHashPath}?${nextHashParams.toString()}`;
      } else {
        redirectUrl.searchParams.set("token", authResult.sessionToken);
        redirectUrl.searchParams.set("userId", authResult.userId);
      }

      return reply.redirect(redirectUrl.toString());
    } catch (error) {
      request.log.error({ error }, `[auth] ${provider} callback failed`);
      return reply.redirect(appendErrorToRedirect(fallbackRedirectTo, "oauth_callback_failed"));
    }
  });
}

export async function registerAuthRoute(app: FastifyInstance) {
  app.post("/auth/logout", async (request, reply) => {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;

    if (token) {
      await prisma.session.deleteMany({
        where: { token },
      });
    }

    return reply.send({ ok: true });
  });

  registerProviderStartRoute(app, "kakao");
  registerProviderCallbackRoute(app, "kakao");

  registerProviderStartRoute(app, "naver");
  registerProviderCallbackRoute(app, "naver");
}
