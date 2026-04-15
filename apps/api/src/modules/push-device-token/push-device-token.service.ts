import { PushDeviceTokenRepository } from "./push-device-token.repository.js";

interface RegisterPushDeviceTokenInput {
  userId: string;
  pushToken: string;
  platform: string;
}

interface DeactivatePushDeviceTokenInput {
  userId: string;
  pushToken: string;
}

export class PushDeviceTokenService {
  constructor(private readonly repository: PushDeviceTokenRepository) {}

  registerPushDeviceToken(input: RegisterPushDeviceTokenInput) {
    const pushToken = input.pushToken.trim();
    if (!pushToken) {
      throw new Error("PUSH_TOKEN_REQUIRED");
    }

    if (!isExpoPushToken(pushToken)) {
      throw new Error("PUSH_TOKEN_INVALID");
    }

    const platform = normalizePlatform(input.platform);

    return this.repository
      .deactivateOtherTokensByUserId(input.userId, pushToken)
      .then(() =>
        this.repository.registerToken({
          userId: input.userId,
          pushToken,
          platform,
        })
      );
  }

  deactivatePushDeviceToken(input: DeactivatePushDeviceTokenInput) {
    const pushToken = input.pushToken.trim();
    if (!pushToken) {
      throw new Error("PUSH_TOKEN_REQUIRED");
    }

    return this.repository.deactivateToken(input.userId, pushToken);
  }
}

function normalizePlatform(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "ios" || normalized === "android") {
    return normalized;
  }
  return "unknown";
}

function isExpoPushToken(value: string) {
  return /^ExponentPushToken\[[^\]]+\]$/.test(value) || /^ExpoPushToken\[[^\]]+\]$/.test(value);
}
