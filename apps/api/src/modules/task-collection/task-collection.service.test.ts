import { describe, expect, it, vi } from "vitest";
import { TaskCollecitonRepository } from "./task-collection.repository.js";
import { TaskCollectionService } from "./task-collection.service.js";

type Candidate = {
  id: string;
  userId: string;
  normalizedText: string;
  displayText: string;
  countedDateKeys: string[];
  countStartedAt: Date | null;
  snoozedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function createSuggestionRepository() {
  let candidate: Candidate | null = null;
  const repository = {
    findTasksForTitleCheck: vi.fn(async () => []),
    findTaskSuggestionCandidate: vi.fn(async () => candidate),
    findTaskSuggestionCandidateById: vi.fn(async () => candidate),
    saveTaskSuggestionCandidate: vi.fn(async (input: Omit<Candidate, "id" | "createdAt" | "updatedAt">) => {
      candidate = {
        id: candidate?.id ?? "suggestion-1",
        ...input,
        createdAt: candidate?.createdAt ?? new Date("2026-09-30T00:00:00.000Z"),
        updatedAt: new Date("2026-09-30T00:00:00.000Z"),
      };
      return candidate;
    }),
    deleteTaskSuggestionCandidate: vi.fn(async () => ({ count: candidate ? 1 : 0 })),
  };

  return {
    repository: repository as unknown as TaskCollecitonRepository,
    getCandidate: () => candidate,
  };
}

describe("TaskCollectionService 반복 문구 저장 제안", () => {
  it("같은 날 입력은 한 번만 세고 30일 안에 서로 다른 3일 사용하면 저장을 제안한다", async () => {
    const { repository } = createSuggestionRepository();
    const service = new TaskCollectionService(repository, () => new Date("2026-09-30T03:00:00.000Z"));

    const first = await service.recordTaskSuggestionUsage({
      userId: "user-1",
      content: "운동 30분",
      usageDateKey: "2026-09-28",
    });
    const duplicateDate = await service.recordTaskSuggestionUsage({
      userId: "user-1",
      content: " 운동   30분 ",
      usageDateKey: "2026-09-28",
    });
    const second = await service.recordTaskSuggestionUsage({
      userId: "user-1",
      content: "운동 30분",
      usageDateKey: "2026-09-29",
    });
    const third = await service.recordTaskSuggestionUsage({
      userId: "user-1",
      content: "운동 30분",
      usageDateKey: "2026-09-30",
    });

    expect(first).toMatchObject({ count: 1, shouldSuggest: false });
    expect(duplicateDate).toMatchObject({ count: 1, shouldSuggest: false });
    expect(second).toMatchObject({ count: 2, shouldSuggest: false });
    expect(third).toMatchObject({ count: 3, shouldSuggest: true });
  });

  it("거절하면 저장용 횟수를 비우고 14일 동안 새 입력을 집계하지 않는다", async () => {
    const { repository, getCandidate } = createSuggestionRepository();
    let now = new Date("2026-09-30T03:00:00.000Z");
    const service = new TaskCollectionService(repository, () => now);

    await service.recordTaskSuggestionUsage({ userId: "user-1", content: "물 마시기", usageDateKey: "2026-09-28" });
    await service.recordTaskSuggestionUsage({ userId: "user-1", content: "물 마시기", usageDateKey: "2026-09-29" });
    const eligible = await service.recordTaskSuggestionUsage({
      userId: "user-1",
      content: "물 마시기",
      usageDateKey: "2026-09-30",
    });
    await service.dismissTaskSuggestion({ userId: "user-1", suggestionId: eligible.suggestionId! });

    now = new Date("2026-10-10T03:00:00.000Z");
    const snoozed = await service.recordTaskSuggestionUsage({
      userId: "user-1",
      content: "물 마시기",
      usageDateKey: "2026-10-10",
    });
    expect(snoozed).toMatchObject({ count: 0, shouldSuggest: false });
    expect(getCandidate()?.countedDateKeys).toEqual([]);

    now = new Date("2026-10-15T03:00:00.000Z");
    const restarted = await service.recordTaskSuggestionUsage({
      userId: "user-1",
      content: "물 마시기",
      usageDateKey: "2026-10-15",
    });
    expect(restarted).toMatchObject({ count: 1, shouldSuggest: false });
  });

  it("첫 집계 후 30일이 지나면 이전 횟수를 버리고 현재 사용일부터 다시 센다", async () => {
    const { repository } = createSuggestionRepository();
    let now = new Date("2026-09-01T03:00:00.000Z");
    const service = new TaskCollectionService(repository, () => now);

    await service.recordTaskSuggestionUsage({ userId: "user-1", content: "영양제", usageDateKey: "2026-09-01" });
    now = new Date("2026-10-01T03:00:00.000Z");
    const restarted = await service.recordTaskSuggestionUsage({
      userId: "user-1",
      content: "영양제",
      usageDateKey: "2026-10-01",
    });

    expect(restarted).toMatchObject({ count: 1, shouldSuggest: false });
  });

  it("저장 제안을 수락하면 미분류 컬렉션에 관리 할 일을 만들고 후보를 제거한다", async () => {
    const candidate: Candidate = {
      id: "suggestion-1",
      userId: "user-1",
      normalizedText: "운동30분",
      displayText: "운동 30분",
      countedDateKeys: ["2026-09-28", "2026-09-29", "2026-09-30"],
      countStartedAt: new Date("2026-09-28T03:00:00.000Z"),
      snoozedUntil: null,
      createdAt: new Date("2026-09-28T03:00:00.000Z"),
      updatedAt: new Date("2026-09-30T03:00:00.000Z"),
    };
    const createdTask = {
      id: "task-1",
      userId: "user-1",
      collectionId: "collection-1",
      title: "운동 30분",
      isFavorite: false,
      isArchived: false,
      order: 0,
      lastUsedAt: null,
      createdAt: new Date("2026-09-30T03:00:00.000Z"),
      updatedAt: new Date("2026-09-30T03:00:00.000Z"),
    };
    const repository = {
      findTaskSuggestionCandidateById: vi.fn(async () => candidate),
      findTasksForTitleCheck: vi.fn(async () => []),
      findTaskCollectionByName: vi.fn(async () => null),
      createTaskCollection: vi.fn(async () => ({ id: "collection-1", name: "미분류" })),
      createTask: vi.fn(async () => createdTask),
      deleteTaskSuggestionCandidate: vi.fn(async () => ({ count: 1 })),
    } as unknown as TaskCollecitonRepository;
    const service = new TaskCollectionService(repository, () => new Date("2026-09-30T03:00:00.000Z"));

    const result = await service.acceptTaskSuggestion({
      userId: "user-1",
      suggestionId: "suggestion-1",
    });

    expect(result).toEqual(createdTask);
    expect(repository.createTaskCollection).toHaveBeenCalledWith({ userId: "user-1", name: "미분류" });
    expect(repository.createTask).toHaveBeenCalledWith({
      userId: "user-1",
      collectionId: "collection-1",
      title: "운동 30분",
    });
    expect(repository.deleteTaskSuggestionCandidate).toHaveBeenCalledWith("user-1", "suggestion-1");
  });
});
