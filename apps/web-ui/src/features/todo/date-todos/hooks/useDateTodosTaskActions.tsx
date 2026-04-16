import { type MutableRefObject } from "react";
import { FiCheckCircle, FiClock, FiRotateCcw, FiTrash2 } from "react-icons/fi";
import { actionSheet, confirm, toast } from "../../../../stores";
import { getUserFacingErrorMessage } from "../../../../utils/errorMessage";
import { formatDateKey } from "../../../../utils/holidays";
import type { TaskItem } from "../../types";

type DailyLogWithTodos = {
  todos: Array<{
    id: string;
    content: string;
    done: boolean;
    order: number;
    startedAt: string | null;
    scheduledStartAt: string | null;
    pausedAt: string | null;
    completedAt: string | null;
    deviationSeconds: number;
    actualFocusSeconds: number | null;
  }>;
} | null;

type DateTaskAction = "start" | "pause" | "resume" | "complete";

type UseDateTodosTaskActionsParams = {
  dateKey: string | null;
  items: TaskItem[];
  isRestActive: boolean;
  applyDailyLog: (nextLog: DailyLogWithTodos) => void;
  stopRestSessionRef: MutableRefObject<(input: { dateKey: string }) => Promise<DailyLogWithTodos>>;
  setActiveRestDurationMin: (value: number | null) => void;
  editingActualFocus: { taskId: string; initialMinutes: number } | null;
  setEditingActualFocus: (value: { taskId: string; initialMinutes: number } | null) => void;
  editingScheduledStart: { taskId: string; initialTime: string } | null;
  setEditingScheduledStart: (value: { taskId: string; initialTime: string } | null) => void;
  addTodos: (input: {
    dateKey: string;
    items: Array<{ content: string; taskId?: string | null; scheduledStartAt?: string | null }>;
  }) => Promise<DailyLogWithTodos>;
  deleteTodo: (input: { dateKey: string; todoId: string }) => Promise<DailyLogWithTodos>;
  startTodo: (input: { dateKey: string; todoId: string }) => Promise<DailyLogWithTodos>;
  pauseTodo: (input: { dateKey: string; todoId: string }) => Promise<DailyLogWithTodos>;
  resumeTodo: (input: { dateKey: string; todoId: string }) => Promise<DailyLogWithTodos>;
  completeTodo: (input: { dateKey: string; todoId: string }) => Promise<DailyLogWithTodos>;
  resetTodo: (input: { dateKey: string; todoId: string }) => Promise<DailyLogWithTodos>;
  updateTodoActualFocus: (input: {
    dateKey: string;
    todoId: string;
    actualFocusSeconds: number;
  }) => Promise<DailyLogWithTodos>;
  updateTodoSchedule: (input: {
    dateKey: string;
    todoId: string;
    scheduledStartAt: string | null;
  }) => Promise<DailyLogWithTodos>;
};

export function useDateTodosTaskActions({
  dateKey,
  items,
  isRestActive,
  applyDailyLog,
  stopRestSessionRef,
  setActiveRestDurationMin,
  editingActualFocus,
  setEditingActualFocus,
  editingScheduledStart,
  setEditingScheduledStart,
  addTodos,
  deleteTodo,
  startTodo,
  pauseTodo,
  resumeTodo,
  completeTodo,
  resetTodo,
  updateTodoActualFocus,
  updateTodoSchedule,
}: UseDateTodosTaskActionsParams) {
  const handleDateTaskAction = (taskId: string, action: DateTaskAction) => {
    if (!dateKey) {
      return;
    }

    const target = items.find((item) => item.id === taskId);
    if (!target) {
      return;
    }

    if (target.status === "done" && action !== "start") {
      return;
    }

    if (action === "start" || action === "resume") {
      const hasAnotherInProgress = items.some((item) => item.id !== taskId && item.status === "in_progress");
      if (hasAnotherInProgress) {
        toast.show({
          type: "error",
          title: "동시 진행 불가",
          message: "진행 중인 할일이 있어요.",
          duration: 2000,
        });
        return;
      }
    }

    if (action === "pause") {
      void (async () => {
        try {
          const nextLog = await pauseTodo({ dateKey, todoId: taskId });
          applyDailyLog(nextLog);
        } catch (error) {
          const message = getUserFacingErrorMessage(error, "할일 상태 업데이트 중 오류가 발생했어요.");
          toast.show({ type: "error", title: "업데이트 실패", message, duration: 2200 });
        }
      })();
      return;
    }

    void (async () => {
      try {
        if (action === "start") {
          const todayKey = formatDateKey(new Date());
          if (dateKey !== todayKey) {
            const confirmed = await confirm({
              title: "오늘 날짜가 아니에요",
              message: "선택한 날짜의 할일을 시작할까요?",
              buttons: [
                { label: "취소", value: "cancel", tone: "neutral" },
                { label: "시작", value: "start", tone: "primary" },
              ],
            });

            if (confirmed !== "start") {
              return;
            }
          }

          if (isRestActive) {
            await stopRestSessionRef.current({ dateKey });
            setActiveRestDurationMin(null);
          }
          const nextLog = await startTodo({ dateKey, todoId: taskId });
          applyDailyLog(nextLog);
          return;
        }

        if (action === "resume") {
          if (isRestActive) {
            await stopRestSessionRef.current({ dateKey });
            setActiveRestDurationMin(null);
          }
          const nextLog = await resumeTodo({ dateKey, todoId: taskId });
          applyDailyLog(nextLog);
          return;
        }

        if (action === "complete") {
          const nextLog = await completeTodo({ dateKey, todoId: taskId });
          applyDailyLog(nextLog);
        }
      } catch (error) {
        const message = getUserFacingErrorMessage(error, "할일 상태 업데이트 중 오류가 발생했어요.");
        toast.show({ type: "error", title: "업데이트 실패", message, duration: 2200 });
      }
    })();
  };

  const handleEditActualFocus = (taskId: string) => {
    if (!dateKey) {
      return;
    }

    const target = items.find((item) => item.id === taskId);
    if (!target || target.status !== "done") {
      return;
    }

    const initialMinutes = Math.max(Math.round((target.completedDurationMs ?? target.accumulatedMs) / 60000), 0);
    setEditingActualFocus({ taskId, initialMinutes });
  };

  const handleSaveActualFocus = async (minutes: number) => {
    if (!dateKey || !editingActualFocus) {
      return;
    }

    if (!Number.isFinite(minutes) || minutes < 0) {
      toast.show({
        type: "error",
        title: "시간 형식 오류",
        message: "0분 이상의 숫자로 입력해 주세요.",
        duration: 2200,
      });
      return;
    }

    try {
      const nextLog = await updateTodoActualFocus({
        dateKey,
        todoId: editingActualFocus.taskId,
        actualFocusSeconds: Math.floor(minutes * 60),
      });
      applyDailyLog(nextLog);
      setEditingActualFocus(null);
      toast.show({
        type: "positive",
        title: "집중 시간 수정됨",
        message: "집중 시간이 업데이트되었습니다.",
        duration: 1800,
      });
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "집중 시간 수정 중 오류가 발생했어요.");
      toast.show({
        type: "error",
        title: "수정 실패",
        message,
        duration: 2200,
      });
    }
  };

  const handleSaveScheduledStart = async (time: string) => {
    if (!dateKey || !editingScheduledStart) {
      return;
    }

    const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
    if (!timeMatch) {
      toast.show({
        type: "error",
        title: "시간 형식 오류",
        message: "시간은 HH:mm 형식으로 입력해 주세요.",
        duration: 2200,
      });
      return;
    }

    const [hour, minute] = time.split(":").map(Number);
    const [year, month, day] = dateKey.split("-").map(Number);
    const scheduled = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (Number.isNaN(scheduled.getTime())) {
      toast.show({
        type: "error",
        title: "시간 형식 오류",
        message: "시작 시간을 확인해 주세요.",
        duration: 2200,
      });
      return;
    }

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
    if (dateKey === todayKey && scheduled.getTime() <= now.getTime()) {
      toast.show({
        type: "error",
        title: "시간 선택 오류",
        message: "오늘 일정은 현재 시각 이후로 설정해 주세요.",
        duration: 2200,
      });
      return;
    }

    try {
      const nextLog = await updateTodoSchedule({
        dateKey,
        todoId: editingScheduledStart.taskId,
        scheduledStartAt: scheduled.toISOString(),
      });
      applyDailyLog(nextLog);
      setEditingScheduledStart(null);
      toast.show({
        type: "positive",
        title: "시작시간 설정됨",
        message: `${time}에 알림 기준 시간으로 저장했어요.`,
        duration: 1800,
      });
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "시작시간 저장 중 오류가 발생했어요.");
      toast.show({
        type: "error",
        title: "설정 실패",
        message,
        duration: 2200,
      });
    }
  };

  const handleDateAddTasks = async (
    nextItems: Array<{ label: string; taskId?: string | null; scheduledStartAt?: string | null }>
  ) => {
    if (!dateKey || nextItems.length === 0) {
      return;
    }

    try {
      const nextLog = await addTodos({
        dateKey,
        items: nextItems.map((item) => ({
          content: item.label,
          taskId: item.taskId ?? null,
          scheduledStartAt: item.scheduledStartAt ?? null,
        })),
      });
      applyDailyLog(nextLog);
    } catch (error) {
      console.error(error);
      toast.show({
        type: "error",
        title: "추가 실패",
        message: "할일을 추가하지 못했어요. 잠시 후 다시 시도해 주세요.",
        duration: 2200,
      });
    }
  };

  const handleDateTaskMenuAction = async (taskId: string) => {
    const target = items.find((item) => item.id === taskId);
    if (!target) {
      return;
    }

    const canCompleteFromMenu = target.status === "overdue";
    const canReset = target.status === "in_progress" || target.status === "paused" || target.status === "done";
    const canClearSchedule = Boolean(target.scheduledStartAt);
    const resetLabel = "초기화";
    const resetDescription =
      target.status === "done" ? "시작 전 상태로 되돌립니다." : "진행 기록을 초기화하고 시작 전 상태로 되돌립니다.";

    const result = await actionSheet({
      title: target.label,
      message: "작업을 선택하세요",
      items: [
        ...(canCompleteFromMenu
          ? [
              {
                label: "완료 처리",
                value: "mark_done",
                tone: "primary" as const,
                icon: <FiCheckCircle size={14} />,
                description: "완료 상태로 변경합니다.",
              },
            ]
          : []),
        ...(canReset
          ? [
              {
                label: resetLabel,
                value: "mark_todo",
                tone: "muted" as const,
                icon: <FiRotateCcw size={14} />,
                description: resetDescription,
              },
            ]
          : []),
        {
          label: "시작시간 설정",
          value: "schedule",
          tone: "primary",
          icon: <FiClock size={14} />,
          description: "알림 예정 시간을 설정합니다.",
        },
        ...(canClearSchedule
          ? [
              {
                label: "시작시간 해제",
                value: "clear_schedule",
                tone: "muted" as const,
                icon: <FiClock size={14} />,
                description: "설정한 시작시간을 제거합니다.",
              },
            ]
          : []),
        {
          label: "삭제",
          value: "delete",
          tone: "danger",
          icon: <FiTrash2 size={14} />,
          description: "이 할일을 목록에서 제거합니다.",
        },
      ],
    });

    if (result === "mark_done") {
      handleDateTaskAction(taskId, "complete");
      return;
    }

    if (result === "mark_todo") {
      if (!dateKey) {
        return;
      }

      try {
        const nextLog = await resetTodo({ dateKey, todoId: taskId });
        applyDailyLog(nextLog);
        toast.show({
          type: "positive",
          title: "초기화됨",
          message: "할일이 시작 전 상태로 되돌아갔어요.",
          duration: 1800,
        });
      } catch (error) {
        const message = getUserFacingErrorMessage(error, "할일 상태 업데이트 중 오류가 발생했어요.");
        toast.show({ type: "error", title: "업데이트 실패", message, duration: 2200 });
      }
      return;
    }

    if (result === "schedule") {
      if (target.status === "done" || target.status === "overdue") {
        toast.show({
          type: "error",
          title: "설정 불가",
          message: "완료/미완료 상태에서는 시작시간을 설정할 수 없어요.",
          duration: 2200,
        });
        return;
      }

      const initialDate = target.scheduledStartAt ? new Date(target.scheduledStartAt) : new Date();
      const initialTime = `${String(initialDate.getHours()).padStart(2, "0")}:${String(
        initialDate.getMinutes()
      ).padStart(2, "0")}`;
      setEditingScheduledStart({ taskId, initialTime });
      return;
    }

    if (result === "clear_schedule") {
      if (!dateKey) {
        return;
      }

      try {
        const nextLog = await updateTodoSchedule({
          dateKey,
          todoId: taskId,
          scheduledStartAt: null,
        });
        applyDailyLog(nextLog);
        toast.show({
          type: "positive",
          title: "시작시간 해제됨",
          message: "설정한 시작시간을 제거했어요.",
          duration: 1800,
        });
      } catch (error) {
        const message = getUserFacingErrorMessage(error, "시작시간 해제 중 오류가 발생했어요.");
        toast.show({
          type: "error",
          title: "해제 실패",
          message,
          duration: 2200,
        });
      }
      return;
    }

    if (result === "delete") {
      if (!dateKey) {
        return;
      }

      if (target.status === "done") {
        const confirmed = await confirm({
          title: "완료한 할일을 삭제할까요?",
          message: "삭제하면 기록한 시간도 사라져요.",
          buttons: [
            { label: "취소", value: "cancel", tone: "neutral" },
            { label: "삭제", value: "delete", tone: "danger" },
          ],
        });

        if (confirmed !== "delete") {
          return;
        }
      }

      try {
        const nextLog = await deleteTodo({ dateKey, todoId: taskId });
        applyDailyLog(nextLog);
        toast.show({
          type: "positive",
          title: "삭제됨",
          message: "할일이 삭제되었습니다.",
          duration: 1800,
        });
      } catch (error) {
        const message = getUserFacingErrorMessage(error, "할일 삭제 중 오류가 발생했어요.");
        toast.show({ type: "error", title: "삭제 실패", message, duration: 2200 });
      }
    }
  };

  return {
    handleDateTaskAction,
    handleEditActualFocus,
    handleSaveActualFocus,
    handleSaveScheduledStart,
    handleDateAddTasks,
    handleDateTaskMenuAction,
  };
}
