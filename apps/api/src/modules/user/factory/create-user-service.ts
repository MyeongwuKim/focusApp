import { createServiceFactory } from "../../../common/factory/create-service-factory.js";
import { UserRepository } from "../user.repository.js";
import { UserService } from "../user.service.js";

export const createUserService = createServiceFactory(UserRepository, UserService);
