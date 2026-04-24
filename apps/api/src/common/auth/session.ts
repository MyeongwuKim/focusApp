import type { FastifyRequest } from "fastify";
import { prisma } from "../prisma.js";
import { env } from "../../config/env.js";

export function getBearerToken(request: Pick<FastifyRequest, "headers">): string | null {
  const authHeader = request.headers.authorization;
  return authHeader?.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "")
    : null;
}

type ResolveSessionOptions = {
  refreshExpiresAt?: boolean;
  now?: number;
};

export async function resolveUserIdFromSessionToken(
  token: string,
  options: ResolveSessionOptions = {}
): Promise<string | null> {
  const now = options.now ?? Date.now();
  const session = await prisma.session.findUnique({
    where: { token },
    select: {
      userId: true,
      expiresAt: true,
    },
  });

  if (!session) {
    return null;
  }

  const expiresAtMs = session.expiresAt.getTime();
  if (expiresAtMs <= now) {
    await prisma.session.delete({ where: { token } }).catch(() => null);
    return null;
  }

  const shouldRefreshExpiresAt = options.refreshExpiresAt ?? true;
  if (shouldRefreshExpiresAt) {
    const refreshWindowMs = env.AUTH_SESSION_REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const remainingMs = expiresAtMs - now;

    if (remainingMs <= refreshWindowMs) {
      const nextExpiresAt = new Date(now + env.AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
      await prisma.session
        .update({
          where: { token },
          data: {
            expiresAt: nextExpiresAt,
          },
        })
        .catch(() => null);
    }
  }

  return session.userId;
}
