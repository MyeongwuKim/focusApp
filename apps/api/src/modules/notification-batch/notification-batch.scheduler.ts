import type { FastifyBaseLogger } from "fastify";
import { prisma } from "../../common/prisma.js";
import { env } from "../../config/env.js";
import { runNotificationBatch } from "./notification-batch.service.js";

let timer: NodeJS.Timeout | null = null;

export function startNotificationBatchScheduler(logger: FastifyBaseLogger) {
  if (!env.NOTIFICATION_BATCH_ENABLED) {
    logger.info("[notification-batch] scheduler disabled");
    return;
  }

  const intervalMs = Math.max(10, env.NOTIFICATION_BATCH_INTERVAL_SECONDS) * 1000;

  const run = async () => {
    try {
      await runNotificationBatch({
        prisma,
        timezone: env.NOTIFICATION_BATCH_TIMEZONE,
        dryRun: false,
        logger,
      });
    } catch (error) {
      logger.error(error, "[notification-batch] scheduled run failed");
    }
  };

  void run();
  timer = setInterval(() => {
    void run();
  }, intervalMs);

  logger.info(
    {
      intervalSeconds: Math.max(10, env.NOTIFICATION_BATCH_INTERVAL_SECONDS),
      timezone: env.NOTIFICATION_BATCH_TIMEZONE,
    },
    "[notification-batch] scheduler started"
  );
}

export function stopNotificationBatchScheduler() {
  if (!timer) {
    return;
  }
  clearInterval(timer);
  timer = null;
}
