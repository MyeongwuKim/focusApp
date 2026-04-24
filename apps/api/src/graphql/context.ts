import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../common/prisma.js";
import { getBearerToken, resolveUserIdFromSessionToken } from "../common/auth/session.js";

export interface GraphQLContext {
  request: FastifyRequest;
  reply: FastifyReply;
  prisma: typeof prisma;
  userId: string | null;
}

export async function buildContext(request: FastifyRequest, reply: FastifyReply): Promise<GraphQLContext> {
  const token = getBearerToken(request);
  const userId = token
    ? await resolveUserIdFromSessionToken(token, { refreshExpiresAt: true })
    : null;

  return {
    request,
    reply,
    prisma,
    userId
  };
}
