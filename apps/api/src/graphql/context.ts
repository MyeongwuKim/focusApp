import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../common/prisma.js";
import { env } from "../config/env.js";

export interface GraphQLContext {
  request: FastifyRequest;
  reply: FastifyReply;
  prisma: typeof prisma;
  userId: string | null;
}

function getBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  return authHeader?.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "")
    : null;
}

export async function buildContext(request: FastifyRequest, reply: FastifyReply): Promise<GraphQLContext> {
  const token = getBearerToken(request);
  let userId: string | null = null;
  const now = Date.now();

  if (token) {
    const session = await prisma.session.findUnique({
      where: { token },
      select: {
        userId: true,
        expiresAt: true,
      },
    });

    if (session && session.expiresAt.getTime() > now) {
      userId = session.userId;

      const refreshWindowMs = env.AUTH_SESSION_REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      const remainingMs = session.expiresAt.getTime() - now;

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
    } else if (session) {
      await prisma.session.delete({ where: { token } }).catch(() => null);
    }
  }

  return {
    request,
    reply,
    prisma,
    userId
  };
}
