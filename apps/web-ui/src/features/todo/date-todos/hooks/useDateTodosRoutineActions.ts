import type { RoutineTemplate } from "../../../../api/routineTemplateApi";
import { toast } from "../../../../stores";

type CreateRoutineTemplateInput = {
  name: string;
  items: Array<{
    taskId?: string | null;
    titleSnapshot?: string | null;
    content: string;
    scheduledTimeHHmm?: string | null;
  }>;
};

type UpdateRoutineTemplateInput = {
  routineTemplateId: string;
  items: Array<{
    id?: string;
    taskId?: string | null;
    titleSnapshot?: string | null;
    content: string;
    scheduledTimeHHmm?: string | null;
  }>;
};

type UseDateTodosRoutineActionsParams = {
  dateKey: string | null;
  routineTemplates: RoutineTemplate[];
  handleDateAddTasks: (
    items: Array<{ label: string; taskId?: string | null; scheduledStartAt?: string | null }>
  ) => Promise<void>;
  createRoutineTemplate: (input: {
    name: string;
    items: Array<{
      taskId?: string | null;
      titleSnapshot?: string | null;
      content: string;
      order?: number;
      scheduledTimeHHmm?: string | null;
    }>;
  }) => Promise<{ name: string }>;
  updateRoutineTemplate: (input: {
    routineTemplateId: string;
    items: Array<{
      id?: string;
      taskId?: string | null;
      titleSnapshot?: string | null;
      content: string;
      order?: number;
      scheduledTimeHHmm?: string | null;
    }>;
  }) => Promise<unknown>;
  deleteRoutineTemplate: (input: { routineTemplateId: string }) => Promise<unknown>;
};

function toIsoByDateAndHHmm(dateKey: string, hhmm?: string | null) {
  if (!hhmm) {
    return null;
  }
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!match) {
    return null;
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export function useDateTodosRoutineActions({
  dateKey,
  routineTemplates,
  handleDateAddTasks,
  createRoutineTemplate,
  updateRoutineTemplate,
  deleteRoutineTemplate,
}: UseDateTodosRoutineActionsParams) {
  const handleApplyRoutineTemplate = async (routineTemplateId: string) => {
    if (!dateKey) {
      return;
    }

    const routine = routineTemplates.find((template) => template.id === routineTemplateId);
    if (!routine) {
      toast.show({
        type: "error",
        title: "루틴 없음",
        message: "선택한 루틴을 찾을 수 없어요.",
        duration: 2200,
      });
      return;
    }

    await handleDateAddTasks(
      routine.items
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((item) => ({
          label: item.content,
          taskId: item.taskId ?? null,
          scheduledStartAt: toIsoByDateAndHHmm(dateKey, item.scheduledTimeHHmm),
        }))
    );
  };

  const handleCreateRoutineTemplate = async (input: CreateRoutineTemplateInput) => {
    const normalizedName = input.name.trim();
    if (!normalizedName) {
      toast.show({
        type: "error",
        title: "저장 실패",
        message: "루틴 이름을 입력해 주세요.",
        duration: 2200,
      });
      return;
    }

    const duplicatedName = routineTemplates.some(
      (template) => template.name.trim().toLowerCase() === normalizedName.toLowerCase()
    );
    if (duplicatedName) {
      toast.show({
        type: "error",
        title: "저장 실패",
        message: "같은 이름의 루틴이 이미 있어요.",
        duration: 2200,
      });
      return;
    }

    const normalizedItems = input.items
      .map((item) => ({
        taskId: item.taskId ?? null,
        titleSnapshot: item.titleSnapshot ?? null,
        content: item.content.trim(),
        scheduledTimeHHmm: item.scheduledTimeHHmm ?? null,
      }))
      .filter((item) => item.content.length > 0);

    if (normalizedItems.length === 0) {
      toast.show({
        type: "error",
        title: "저장 실패",
        message: "루틴 항목을 1개 이상 입력해 주세요.",
        duration: 2200,
      });
      return;
    }

    try {
      const created = await createRoutineTemplate({
        name: normalizedName,
        items: normalizedItems.map((item, index) => ({
          taskId: item.taskId,
          titleSnapshot: item.titleSnapshot,
          content: item.content,
          order: index,
          scheduledTimeHHmm: item.scheduledTimeHHmm,
        })),
      });
      toast.show({
        type: "positive",
        title: "루틴 저장됨",
        message: `${created.name} 루틴을 저장했어요.`,
        duration: 1800,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "루틴 저장 중 오류가 발생했어요.";
      toast.show({
        type: "error",
        title: "루틴 저장 실패",
        message,
        duration: 2200,
      });
    }
  };

  const handleUpdateRoutineTemplate = async (input: UpdateRoutineTemplateInput) => {
    const normalizedItems = input.items
      .map((item) => ({
        id: item.id,
        taskId: item.taskId ?? null,
        titleSnapshot: item.titleSnapshot ?? null,
        content: item.content.trim(),
        scheduledTimeHHmm: item.scheduledTimeHHmm ?? null,
      }))
      .filter((item) => item.content.length > 0);

    if (normalizedItems.length === 0) {
      toast.show({
        type: "error",
        title: "수정 실패",
        message: "루틴 항목을 1개 이상 남겨 주세요.",
        duration: 2200,
      });
      return;
    }

    try {
      await updateRoutineTemplate({
        routineTemplateId: input.routineTemplateId,
        items: normalizedItems.map((item, index) => ({
          id: item.id,
          taskId: item.taskId,
          titleSnapshot: item.titleSnapshot,
          content: item.content,
          order: index,
          scheduledTimeHHmm: item.scheduledTimeHHmm,
        })),
      });
      toast.show({
        type: "positive",
        title: "루틴 수정됨",
        message: "루틴 항목이 업데이트되었어요.",
        duration: 1800,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "루틴 수정 중 오류가 발생했어요.";
      toast.show({
        type: "error",
        title: "루틴 수정 실패",
        message,
        duration: 2200,
      });
    }
  };

  const handleDeleteRoutineTemplate = async (routineTemplateId: string) => {
    try {
      await deleteRoutineTemplate({ routineTemplateId });
      toast.show({
        type: "positive",
        title: "루틴 삭제됨",
        message: "저장된 루틴을 삭제했어요.",
        duration: 1800,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "루틴 삭제 중 오류가 발생했어요.";
      toast.show({
        type: "error",
        title: "루틴 삭제 실패",
        message,
        duration: 2200,
      });
    }
  };

  return {
    handleApplyRoutineTemplate,
    handleCreateRoutineTemplate,
    handleUpdateRoutineTemplate,
    handleDeleteRoutineTemplate,
  };
}
