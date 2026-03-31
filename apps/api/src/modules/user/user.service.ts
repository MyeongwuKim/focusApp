import type { User } from "@prisma/client";
import { UserRepository, type CreateUserInput } from "./user.repository.js";

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async getMe(userId: string | null): Promise<User | null> {
    if (!userId) {
      return null;
    }

    return this.userRepository.findById(userId);
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }

    return this.userRepository.create(input);
  }
}
