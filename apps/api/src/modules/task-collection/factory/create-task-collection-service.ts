import { createServiceFactory } from "../../../common/factory/create-service-factory.js";
import { TaskCollecitonRepository } from "../task-collection.repository.js";
import { TaskCollectionService } from "../task-collection.service.js";

export const createTaskCollectionService = createServiceFactory(
  TaskCollecitonRepository,
  TaskCollectionService
);
