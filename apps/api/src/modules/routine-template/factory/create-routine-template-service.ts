import { createServiceFactory } from "../../../common/factory/create-service-factory.js";
import { RoutineTemplateRepository } from "../routine-template.repository.js";
import { RoutineTemplateService } from "../routine-template.service.js";

export const createRoutineTemplateService = createServiceFactory(
  RoutineTemplateRepository,
  RoutineTemplateService
);
