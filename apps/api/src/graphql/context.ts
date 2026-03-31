import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../common/prisma.js";

export interface GraphQLContext {
  request: FastifyRequest;
  reply: FastifyReply;
  prisma: typeof prisma;
  userId: string | null;
}

export function buildContext(request: FastifyRequest, reply: FastifyReply): GraphQLContext {
  const authHeader = request.headers.authorization;
  const userIdFromHeader = authHeader?.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "")
    : null;

  return {
    request,
    reply,
    prisma,
    userId: userIdFromHeader
  };
}
