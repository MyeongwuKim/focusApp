import { env } from "./config/env.js";
import { createApp } from "./app.js";
import {
  startNotificationBatchScheduler,
  stopNotificationBatchScheduler,
} from "./modules/notification-batch/notification-batch.scheduler.js";

const app = await createApp();

try {
  await app.listen({
    port: env.PORT,
    host: "0.0.0.0"
  });
  startNotificationBatchScheduler(app.log);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

const shutdown = async () => {
  stopNotificationBatchScheduler();
  await app.close();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
