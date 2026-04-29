import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../common/prisma.js";
import { captureServerError, resolveErrorCode } from "../../common/observability/sentry.js";
import { runNotificationBatch } from "./notification-batch.service.js";

const requestSchema = z.object({
  dryRun: z.boolean().optional(),
  force: z.boolean().optional(),
});

function isAuthorized(request: FastifyRequest) {
  if (!env.BATCH_API_SECRET) {
    return true;
  }

  const provided = request.headers["x-batch-secret"];
  if (!provided) {
    return false;
  }

  if (Array.isArray(provided)) {
    return provided.includes(env.BATCH_API_SECRET);
  }

  return provided === env.BATCH_API_SECRET;
}

function replyUnauthorized(reply: FastifyReply) {
  return reply.code(401).send({
    message: "배치 실행 권한이 없어요.",
  });
}

export async function registerNotificationBatchRoute(app: FastifyInstance) {
  app.post("/api/notifications/batch/run", async (request, reply) => {
    if (!isAuthorized(request)) {
      return replyUnauthorized(reply);
    }

    const parsed = requestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "요청 본문 형식이 올바르지 않아요.",
      });
    }

    try {
      const result = await runNotificationBatch({
        prisma,
        dryRun: parsed.data.dryRun ?? false,
        force: parsed.data.force ?? false,
        timezone: env.NOTIFICATION_BATCH_TIMEZONE,
        logger: request.log,
      });

      return reply.send(result);
    } catch (error) {
      request.log.error(error, "[notification-batch] run failed");
      captureServerError(error, {
        requestId: request.id,
        method: request.method,
        route: request.url.split("?")[0] ?? request.url,
        userId: null,
        statusCode: 500,
        errorCode: resolveErrorCode(error),
        requestInput: request.body,
      });
      return reply.code(500).send({
        message: "알림 배치 실행 중 오류가 발생했어요.",
      });
    }
  });
}
