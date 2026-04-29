import { describe, expect, it, vi } from "vitest";
import type { NotificationSettingsRepository } from "./notification-settings.repository.js";
import { NotificationSettingsService } from "./notification-settings.service.js";

function createService() {
  const repository = {
    upsertDefaults: vi.fn(),
    updateByUserId: vi.fn(async (_userId: string, input: Record<string, unknown>) => input),
  } as unknown as NotificationSettingsRepository;
  const service = new NotificationSettingsService(repository);
  return { service, repository };
}

describe("NotificationSettingsService", () => {
  it("유효한 입력값을 정규화해서 저장한다", async () => {
    const { service, repository } = createService();

    await service.updateNotificationSettings({
      userId: "user-1",
      intervalMinutes: 30,
      activeStartTime: " 09:00 ",
      activeEndTime: " 18:30 ",
      dayMode: " weekday ",
      tone: " balanced ",
      systemPermission: " granted ",
      lastFocusReminderSentAt: "2026-04-29T00:00:00.000Z",
      lastEmptyTodoReminderDate: " 2026-04-29 ",
    });

    expect(repository.updateByUserId).toHaveBeenCalledWith("user-1", {
      intervalMinutes: 30,
      activeStartTime: "09:00",
      activeEndTime: "18:30",
      dayMode: "weekday",
      tone: "balanced",
      systemPermission: "granted",
      lastFocusReminderSentAt: new Date("2026-04-29T00:00:00.000Z"),
      lastEmptyTodoReminderDate: "2026-04-29",
    });
  });

  it("허용되지 않은 intervalMinutes 입력 시 에러를 던진다", async () => {
    const { service, repository } = createService();

    await expect(
      service.updateNotificationSettings({
        userId: "user-1",
        intervalMinutes: 15,
      })
    ).rejects.toThrow("NOTIFICATION_INTERVAL_INVALID");
    expect(repository.updateByUserId).not.toHaveBeenCalled();
  });

  it("유효하지 않은 시각 포맷 입력 시 에러를 던진다", async () => {
    const { service, repository } = createService();

    await expect(
      service.updateNotificationSettings({
        userId: "user-1",
        activeStartTime: "9:00",
      })
    ).rejects.toThrow("NOTIFICATION_ACTIVE_TIME_INVALID");
    expect(repository.updateByUserId).not.toHaveBeenCalled();
  });
});
