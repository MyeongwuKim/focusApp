import { createServiceFactory } from "../../../common/factory/create-service-factory.js";
import { DailyLogRepository } from "../daily-log.repository.js";
import { DailyLogService } from "../daily-log.service.js";

export const createDailyLogService = createServiceFactory(DailyLogRepository, DailyLogService);
