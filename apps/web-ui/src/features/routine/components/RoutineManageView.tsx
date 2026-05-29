import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDroppable,
  type DragEndEvent,
  type CollisionDetection,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiEdit2, FiPlus, FiTrash2 } from "react-icons/fi";
import { useLocation } from "react-router-dom";
import { type RoutineTemplate, type RoutineTemplateItemInput } from "../../../api/routineTemplateApi";
import { TimePickerBottomSheet } from "../../../components/TimePickerBottomSheet";
import { Button } from "../../../components/ui/Button";
import { InputField } from "../../../components/ui/InputField";
import { useSortableSensors } from "../../../hooks/useSortableSensors";
import {
  useRoutineTemplateMutation,
  useRoutineTemplateQuery,
  useRoutineTemplateWeekdayAssignmentsQuery,
} from "../../../queries";
import { actionSheet, confirm, toast } from "../../../stores";
import { reorderById } from "../../../utils/dnd";
import { getUserFacingErrorMessage } from "../../../utils/errorMessage";
import { TodoRoutineCreateModal } from "../../todo/components/TodoRoutineCreateModal";
import { useAppNavigation } from "../../../providers/AppNavigationProvider";
import { ROUTINE_CREATE_PATH, ROUTINE_EDIT_PATH_PREFIX, ROUTINE_MANAGE_PATH } from "../../../routes/route-config";
import {
  RoutineTemplateDraggableCard,
  type RoutineTemplateAssignedDayChip,
} from "./RoutineTemplateDraggableCard";
import { RoutinePreviewDetailPanel } from "./RoutinePreviewDetailPanel";
import { RoutineTemplateListPanel } from "./RoutineTemplateListPanel";
import { RoutineTemplateDetailPanel } from "./RoutineTemplateDetailPanel";
import {
  RoutineTemplateSortableItemRow,
  type RoutineTemplateDraftItem,
} from "./RoutineTemplateSortableItemRow";

type RoutineManageTab = "templates" | "weekdays";
type WeekdayValue = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type WeekdayKey = `${WeekdayValue}`;
type WeekdayAssignmentMap = Record<WeekdayKey, string | null>;

type WeekdayMeta = {
  weekday: WeekdayValue;
  key: WeekdayKey;
  label: string;
  shortLabel: string;
};

type WeekdayTone = {
  base: string;
  over: string;
  assigned: string;
};

type TemplateDraft = {
  templateId: string | null;
  name: string;
  items: RoutineTemplateDraftItem[];
};
type RoutineEditorMode = "create" | "edit";

const WEEKDAY_ITEMS: WeekdayMeta[] = [
  { weekday: 1, key: "1", label: "월요일", shortLabel: "월" },
  { weekday: 2, key: "2", label: "화요일", shortLabel: "화" },
  { weekday: 3, key: "3", label: "수요일", shortLabel: "수" },
  { weekday: 4, key: "4", label: "목요일", shortLabel: "목" },
  { weekday: 5, key: "5", label: "금요일", shortLabel: "금" },
  { weekday: 6, key: "6", label: "토요일", shortLabel: "토" },
  { weekday: 0, key: "0", label: "일요일", shortLabel: "일" },
];

const EMPTY_ASSIGNMENTS: WeekdayAssignmentMap = {
  "0": null,
  "1": null,
  "2": null,
  "3": null,
  "4": null,
  "5": null,
  "6": null,
};

const WEEKDAY_TONE_MAP: Record<WeekdayKey, WeekdayTone> = {
  "1": {
    base: "border-sky-200/80 bg-sky-50/70",
    over: "border-sky-400/90 bg-sky-100/80",
    assigned: "border-sky-300/90 bg-sky-100/90",
  },
  "2": {
    base: "border-cyan-200/80 bg-cyan-50/70",
    over: "border-cyan-400/90 bg-cyan-100/80",
    assigned: "border-cyan-300/90 bg-cyan-100/90",
  },
  "3": {
    base: "border-emerald-200/80 bg-emerald-50/70",
    over: "border-emerald-400/90 bg-emerald-100/80",
    assigned: "border-emerald-300/90 bg-emerald-100/90",
  },
  "4": {
    base: "border-lime-200/80 bg-lime-50/75",
    over: "border-lime-400/90 bg-lime-100/85",
    assigned: "border-lime-300/90 bg-lime-100/95",
  },
  "5": {
    base: "border-amber-200/80 bg-amber-50/75",
    over: "border-amber-400/90 bg-amber-100/85",
    assigned: "border-amber-300/90 bg-amber-100/95",
  },
  "6": {
    base: "border-orange-200/80 bg-orange-50/75",
    over: "border-orange-400/90 bg-orange-100/85",
    assigned: "border-orange-300/90 bg-orange-100/95",
  },
  "0": {
    base: "border-rose-200/80 bg-rose-50/75",
    over: "border-rose-400/90 bg-rose-100/85",
    assigned: "border-rose-300/90 bg-rose-100/95",
  },
};

type WeekdayDropTargetId = `weekday-slot:${WeekdayKey}`;

function toWeekdayDropTargetId(dayKey: WeekdayKey): WeekdayDropTargetId {
  return `weekday-slot:${dayKey}`;
}

function parseRoutineDragItemId(id: unknown): string | null {
  if (typeof id !== "string") {
    return null;
  }
  if (!id.startsWith("routine-template:")) {
    return null;
  }
  return id.replace("routine-template:", "");
}

function parseWeekdayDropTargetId(id: unknown): WeekdayKey | null {
  if (typeof id !== "string") {
    return null;
  }
  if (!id.startsWith("weekday-slot:")) {
    return null;
  }
  const key = id.replace("weekday-slot:", "");
  if (key === "0" || key === "1" || key === "2" || key === "3" || key === "4" || key === "5" || key === "6") {
    return key;
  }
  return null;
}

const WeekdayDropCard = memo(function WeekdayDropCard({
  day,
  assignedTemplate,
  tone,
  disabled,
  onClearDay,
}: {
  day: WeekdayMeta;
  assignedTemplate: RoutineTemplate | null;
  tone: WeekdayTone;
  disabled: boolean;
  onClearDay: (dayKey: WeekdayKey) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: toWeekdayDropTargetId(day.key),
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        "aspect-square rounded-xl border p-2 transition-colors",
        isOver ? tone.over : tone.base,
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-sm font-semibold text-slate-700">{day.shortLabel}</p>
      </div>

      {assignedTemplate ? (
        <button
          type="button"
          className={[
            "mt-2 flex h-[calc(100%-2.05rem)] w-full items-center justify-center rounded-lg border px-2 py-2 text-center",
            `${tone.assigned} text-slate-800`,
          ].join(" ")}
          onClick={() => onClearDay(day.key)}
          disabled={disabled}
          aria-label={`${day.label} 할당 해제`}
        >
          <span className="block w-full truncate text-center text-xs font-semibold text-slate-800">
            {assignedTemplate.name}
          </span>
        </button>
      ) : (
        <div className="mt-2 h-[calc(100%-2.05rem)] w-full rounded-lg border border-dashed border-slate-300/90 bg-white/75" />
      )}
    </div>
  );
});

type RoutineEditorRouteState = {
  isEditorRoute: boolean;
  mode: RoutineEditorMode;
  editingTemplateId: string | null;
};

function getRoutineEditorRouteState(pathname: string): RoutineEditorRouteState {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  if (normalizedPath === ROUTINE_CREATE_PATH) {
    return {
      isEditorRoute: true,
      mode: "create",
      editingTemplateId: null,
    };
  }

  const editMatch = normalizedPath.match(new RegExp(`^${ROUTINE_EDIT_PATH_PREFIX}([^/]+)$`));
  if (editMatch?.[1]) {
    return {
      isEditorRoute: true,
      mode: "edit",
      editingTemplateId: decodeURIComponent(editMatch[1]),
    };
  }

  return {
    isEditorRoute: false,
    mode: "create",
    editingTemplateId: null,
  };
}

function buildDraftFromTemplate(template: RoutineTemplate): TemplateDraft {
  return {
    templateId: template.id,
    name: template.name,
    items: template.items
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((item) => ({
        clientId: `routine-item-${item.id}`,
        id: item.id,
        taskId: item.taskId ?? null,
        titleSnapshot: item.titleSnapshot ?? null,
        content: item.content,
        scheduledTimeHHmm: item.scheduledTimeHHmm ?? null,
      })),
  };
}

function buildEmptyDraft(): TemplateDraft {
  return {
    templateId: null,
    name: "",
    items: [],
  };
}

function sanitizeDraftItems(items: RoutineTemplateDraftItem[]) {
  return items
    .map((item) => ({
      id: item.id,
      taskId: item.taskId ?? null,
      titleSnapshot: item.titleSnapshot ?? null,
      content: item.content.trim(),
      scheduledTimeHHmm: item.scheduledTimeHHmm ?? null,
    }))
    .filter((item) => item.content.length > 0);
}

function buildAssignmentMap(
  items: Array<{
    weekday: number;
    routineTemplateId: string | null;
  }> | undefined
): WeekdayAssignmentMap {
  const next: WeekdayAssignmentMap = { ...EMPTY_ASSIGNMENTS };
  if (!items) {
    return next;
  }

  for (const item of items) {
    if (!Number.isInteger(item.weekday) || item.weekday < 0 || item.weekday > 6) {
      continue;
    }
    const key = String(item.weekday) as WeekdayKey;
    next[key] = item.routineTemplateId;
  }

  return next;
}

type RoutineManageViewProps = {
  forcedPathname?: string;
};

export function RoutineManageView({ forcedPathname }: RoutineManageViewProps) {
  const location = useLocation();
  const { goBack, goPage } = useAppNavigation();
  const pathname = forcedPathname ?? location.pathname;
  const routeState = useMemo(() => getRoutineEditorRouteState(pathname), [pathname]);
  const openedFromRoutineManage = Boolean(
    (location.state as { fromRoutineManage?: boolean } | null)?.fromRoutineManage
  );
  const [activeTab, setActiveTab] = useState<RoutineManageTab>("templates");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(buildEmptyDraft());
  const [draftAssignments, setDraftAssignments] = useState<WeekdayAssignmentMap>({ ...EMPTY_ASSIGNMENTS });
  const [draggingTemplateId, setDraggingTemplateId] = useState<string | null>(null);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [previewWeekdayKey, setPreviewWeekdayKey] = useState<WeekdayKey | null>(null);
  const [editingTimeItemClientId, setEditingTimeItemClientId] = useState<string | null>(null);
  const [renameTemplateId, setRenameTemplateId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const templateDetailScrollRef = useRef<HTMLDivElement | null>(null);
  const weekdayPreviewDetailScrollRef = useRef<HTMLDivElement | null>(null);

  const sensors = useSortableSensors();

  const { routineTemplatesQuery } = useRoutineTemplateQuery();
  const { routineTemplateWeekdayAssignmentsQuery } = useRoutineTemplateWeekdayAssignmentsQuery();
  const {
    createRoutineTemplateMutation,
    updateRoutineTemplateMutation,
    deleteRoutineTemplateMutation,
    updateRoutineTemplateWeekdayAssignmentsMutation,
  } = useRoutineTemplateMutation();

  const routineTemplates = routineTemplatesQuery.data ?? [];

  useEffect(() => {
    if (routineTemplateWeekdayAssignmentsQuery.data) {
      const nextAssignments = buildAssignmentMap(routineTemplateWeekdayAssignmentsQuery.data);
      setDraftAssignments(nextAssignments);
    }
  }, [routineTemplateWeekdayAssignmentsQuery.data]);

  useEffect(() => {
    if (routineTemplates.length === 0) {
      setSelectedTemplateKey(null);
      const empty = buildEmptyDraft();
      setTemplateDraft(empty);
      return;
    }

    if (!selectedTemplateKey || !routineTemplates.some((template) => template.id === selectedTemplateKey)) {
      const first = routineTemplates[0];
      if (!first) {
        return;
      }
      setSelectedTemplateKey(first.id);
      const nextDraft = buildDraftFromTemplate(first);
      setTemplateDraft(nextDraft);
    }
  }, [routineTemplates, selectedTemplateKey]);
  const editingTemplateForRoute = useMemo(
    () =>
      routeState.mode === "edit" && routeState.editingTemplateId
        ? routineTemplates.find((template) => template.id === routeState.editingTemplateId) ?? null
        : null,
    [routeState.editingTemplateId, routeState.mode, routineTemplates]
  );

  const editingTimeItem = useMemo(
    () => templateDraft.items.find((item) => item.clientId === editingTimeItemClientId) ?? null,
    [editingTimeItemClientId, templateDraft.items]
  );

  const sortableItemIds = useMemo(() => templateDraft.items.map((item) => item.clientId), [templateDraft.items]);
  const previewTemplate = useMemo(
    () => routineTemplates.find((template) => template.id === previewTemplateId) ?? null,
    [previewTemplateId, routineTemplates]
  );
  const draggingTemplate = useMemo(
    () => (draggingTemplateId ? routineTemplates.find((template) => template.id === draggingTemplateId) ?? null : null),
    [draggingTemplateId, routineTemplates]
  );
  const assignedDayCount = useMemo(
    () => WEEKDAY_ITEMS.filter((day) => Boolean(draftAssignments[day.key])).length,
    [draftAssignments]
  );
  const templateAssignedDaysById = useMemo(() => {
    const nextMap: Record<string, RoutineTemplateAssignedDayChip[]> = {};
    for (const day of WEEKDAY_ITEMS) {
      const templateId = draftAssignments[day.key];
      if (!templateId) {
        continue;
      }
      if (!nextMap[templateId]) {
        nextMap[templateId] = [];
      }
      nextMap[templateId]?.push({
        key: day.key,
        shortLabel: day.shortLabel,
        toneClassName: WEEKDAY_TONE_MAP[day.key].assigned,
      });
    }
    return nextMap;
  }, [draftAssignments]);
  const isSavingTemplate =
    createRoutineTemplateMutation.isPending ||
    updateRoutineTemplateMutation.isPending ||
    deleteRoutineTemplateMutation.isPending;
  const isSavingAssignments = updateRoutineTemplateWeekdayAssignmentsMutation.isPending;
  const isLoadingAssignments =
    routineTemplateWeekdayAssignmentsQuery.isLoading || routineTemplatesQuery.isLoading;
  const weekdayCollisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args);
    if (pointerHits.length > 0) {
      return pointerHits;
    }
    return rectIntersection(args);
  };

  useEffect(() => {
    if (previewTemplateId && routineTemplates.some((template) => template.id === previewTemplateId)) {
      return;
    }

    const firstAssignedDay = WEEKDAY_ITEMS.find((day) => Boolean(draftAssignments[day.key]));
    if (!firstAssignedDay) {
      setPreviewTemplateId(null);
      setPreviewWeekdayKey(null);
      return;
    }

    setPreviewTemplateId(draftAssignments[firstAssignedDay.key]);
    setPreviewWeekdayKey(firstAssignedDay.key);
  }, [draftAssignments, previewTemplateId, routineTemplates]);

  useEffect(() => {
    templateDetailScrollRef.current?.scrollTo({
      top: 0,
      behavior: "auto",
    });
  }, [selectedTemplateKey]);

  useEffect(() => {
    weekdayPreviewDetailScrollRef.current?.scrollTo({
      top: 0,
      behavior: "auto",
    });
  }, [previewTemplateId]);

  const handleOpenPreviewTemplateDetails = useCallback((templateId: string) => {
    setPreviewTemplateId(templateId);
    setPreviewWeekdayKey(null);
  }, []);

  const handleSelectTemplate = useCallback((nextKey: string) => {
    const template = routineTemplates.find((item) => item.id === nextKey);
    if (!template) {
      return;
    }
    setSelectedTemplateKey(template.id);
    const nextDraft = buildDraftFromTemplate(template);
    setTemplateDraft(nextDraft);
  }, [routineTemplates]);

  const persistTemplateItems = useCallback(async (nextItems: RoutineTemplateDraftItem[]) => {
    if (!templateDraft.templateId) {
      return;
    }

    const normalizedName = templateDraft.name.trim();
    if (!normalizedName) {
      toast.error("루틴 이름을 입력해 주세요.", "저장 실패");
      return;
    }

    const normalizedItems = sanitizeDraftItems(nextItems);
    if (normalizedItems.length === 0) {
      toast.error("루틴 항목을 1개 이상 입력해 주세요.", "저장 실패");
      return;
    }

    const payloadItems: RoutineTemplateItemInput[] = normalizedItems.map((item, index) => ({
      id: item.id,
      taskId: item.taskId ?? null,
      titleSnapshot: item.titleSnapshot ?? null,
      content: item.content,
      order: index,
      scheduledTimeHHmm: item.scheduledTimeHHmm ?? null,
    }));

    try {
      const updated = await updateRoutineTemplateMutation.mutateAsync({
        routineTemplateId: templateDraft.templateId,
        name: normalizedName,
        items: payloadItems,
      });
      const nextDraft = buildDraftFromTemplate(updated);
      setTemplateDraft(nextDraft);
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "루틴 저장 중 오류가 발생했어요.");
      toast.error(message, "저장 실패");
    }
  }, [templateDraft.name, templateDraft.templateId, updateRoutineTemplateMutation]);

  const handleRemoveTemplateItemByClientId = useCallback((clientId: string) => {
    setTemplateDraft((prev) => {
      if (prev.items.length <= 1) {
        toast.error("루틴 항목을 1개 이상 남겨 주세요.", "삭제 제한");
        return prev;
      }
      const next = {
        ...prev,
        items: prev.items.filter((item) => item.clientId !== clientId),
      };
      void persistTemplateItems(next.items);
      return next;
    });
  }, [persistTemplateItems]);

  const handleTemplateItemDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    setTemplateDraft((prev) => {
      const nextItems = reorderById(prev.items, String(active.id), String(over.id), (item) => item.clientId);
      void persistTemplateItems(nextItems);
      return {
        ...prev,
        items: nextItems,
      };
    });
  }, [persistTemplateItems]);

  const handleOpenTemplateItemMenu = useCallback(async (item: RoutineTemplateDraftItem) => {
    const selected = await actionSheet({
      title: item.content,
      message: "작업을 선택하세요",
      items: [
        {
          label: "시작시간 설정",
          value: "set-time",
          tone: "primary",
          icon: <FiEdit2 size={14} />,
          description: "알림 예정 시간을 설정해요.",
        },
        ...(item.scheduledTimeHHmm
          ? [
              {
                label: "시작시간 해제",
                value: "clear-time",
                tone: "muted" as const,
                icon: <FiEdit2 size={14} />,
                description: "설정한 시작시간을 지워요.",
              },
            ]
          : []),
        {
          label: "삭제",
          value: "delete",
          tone: "danger",
          icon: <FiTrash2 size={14} />,
          description: "이 항목을 목록에서 지워요.",
        },
      ],
    });

    if (!selected) {
      return;
    }

    if (selected === "delete") {
      handleRemoveTemplateItemByClientId(item.clientId);
      return;
    }

    if (selected === "clear-time") {
      setTemplateDraft((prev) => {
        const nextItems = prev.items.map((target) =>
          target.clientId === item.clientId ? { ...target, scheduledTimeHHmm: null } : target
        );
        void persistTemplateItems(nextItems);
        return {
          ...prev,
          items: nextItems,
        };
      });
      return;
    }

    if (selected === "set-time") {
      setEditingTimeItemClientId(item.clientId);
    }
  }, [handleRemoveTemplateItemByClientId, persistTemplateItems]);

  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    if (!templateId) {
      return;
    }

    const accepted = await confirm({
      title: "루틴 템플릿을 삭제할까요?",
      message: "해당 템플릿은 요일 할당에서도 해제됩니다.",
      buttons: [
        { label: "취소", value: "cancel", tone: "neutral" },
        { label: "삭제", value: "delete", tone: "danger" },
      ],
    });
    if (accepted !== "delete") {
      return;
    }

    try {
      await deleteRoutineTemplateMutation.mutateAsync({
        routineTemplateId: templateId,
      });
      setSelectedTemplateKey(null);
      toast.positive("루틴 템플릿을 삭제했어요.", "삭제 완료");
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "루틴 삭제 중 오류가 발생했어요.");
      toast.error(message, "삭제 실패");
    }
  }, [deleteRoutineTemplateMutation]);

  const handleCreateTemplateFromRoute = async (input: {
    name: string;
    items: Array<{
      taskId?: string | null;
      titleSnapshot?: string | null;
      content: string;
      scheduledTimeHHmm?: string | null;
    }>;
  }) => {
    try {
      const payloadItems = input.items.map((item, index) => ({
        taskId: item.taskId ?? null,
        titleSnapshot: item.titleSnapshot ?? null,
        content: item.content,
        order: index,
        scheduledTimeHHmm: item.scheduledTimeHHmm ?? null,
      }));

      const updatedTemplate =
        routeState.mode === "edit" && routeState.editingTemplateId
          ? await updateRoutineTemplateMutation.mutateAsync({
              routineTemplateId: routeState.editingTemplateId,
              name: input.name,
              items: payloadItems,
            })
          : await createRoutineTemplateMutation.mutateAsync({
              name: input.name,
              items: payloadItems,
            });

      const nextDraft = buildDraftFromTemplate(updatedTemplate);
      setSelectedTemplateKey(updatedTemplate.id);
      setTemplateDraft(nextDraft);
      toast.positive(routeState.mode === "edit" ? "루틴 템플릿을 수정했어요." : "새 루틴 템플릿을 저장했어요.", "저장 완료");
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "루틴 저장 중 오류가 발생했어요.");
      toast.error(message, "저장 실패");
      throw error;
    }
  };

  const handleOpenTemplateMenu = useCallback(async (template: RoutineTemplate) => {
    const selected = await actionSheet({
      title: template.name,
      message: "작업을 선택하세요",
      items: [
        {
          label: "이름 변경",
          value: "rename",
          tone: "muted",
          icon: <FiEdit2 size={14} />,
          description: "루틴 이름을 변경해요.",
        },
        {
          label: "루틴 수정",
          value: "edit",
          tone: "primary",
          icon: <FiPlus size={14} />,
          description: "구성과 항목 순서를 수정해요.",
        },
        {
          label: "루틴 삭제",
          value: "delete",
          tone: "danger",
          icon: <FiTrash2 size={14} />,
          description: "이 루틴을 목록에서 지워요.",
        },
      ],
    });

    if (selected === "rename") {
      setRenameTemplateId(template.id);
      setRenameInput(template.name);
      return;
    }
    if (selected === "edit") {
      goPage(`${ROUTINE_EDIT_PATH_PREFIX}${template.id}`, {
        state: { fromRoutineManage: true },
      });
      return;
    }
    if (selected === "delete") {
      await handleDeleteTemplate(template.id);
    }
  }, [goPage, handleDeleteTemplate]);

  const handleSubmitRename = async () => {
    if (!renameTemplateId) {
      return;
    }
    const targetTemplate = routineTemplates.find((template) => template.id === renameTemplateId);
    if (!targetTemplate) {
      setRenameTemplateId(null);
      return;
    }
    const nextName = renameInput.trim();
    if (!nextName) {
      toast.error("루틴 이름을 입력해 주세요.", "수정 실패");
      return;
    }
    try {
      const updated = await updateRoutineTemplateMutation.mutateAsync({
        routineTemplateId: renameTemplateId,
        name: nextName,
        items: targetTemplate.items
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((item, index) => ({
            id: item.id,
            taskId: item.taskId,
            titleSnapshot: item.titleSnapshot,
            content: item.content,
            order: index,
            scheduledTimeHHmm: item.scheduledTimeHHmm,
          })),
      });
      const nextDraft = buildDraftFromTemplate(updated);
      setSelectedTemplateKey(updated.id);
      setTemplateDraft(nextDraft);
      setRenameTemplateId(null);
      toast.positive("루틴 이름을 변경했어요.", "수정 완료");
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "루틴 이름 변경 중 오류가 발생했어요.");
      toast.error(message, "수정 실패");
    }
  };

  const handleWeekdayAssignmentDragEnd = (event: DragEndEvent) => {
    const templateId = parseRoutineDragItemId(event.active.id);
    const dayKey = parseWeekdayDropTargetId(event.over?.id);
    setDraggingTemplateId(null);
    if (!templateId || !dayKey) {
      return;
    }

    const nextAssignments = {
      ...draftAssignments,
      [dayKey]: templateId,
    };
    setDraftAssignments(nextAssignments);
    void persistAssignments(nextAssignments);
    setPreviewTemplateId(templateId);
    setPreviewWeekdayKey(dayKey);
  };

  const handleWeekdayAssignmentDragStart = (event: DragStartEvent) => {
    const templateId = parseRoutineDragItemId(event.active.id);
    setDraggingTemplateId(templateId);
  };

  const handleClearWeekdayAssignment = (dayKey: WeekdayKey) => {
    const nextAssignments = {
      ...draftAssignments,
      [dayKey]: null,
    };
    setDraftAssignments(nextAssignments);
    void persistAssignments(nextAssignments);
    if (previewWeekdayKey === dayKey) {
      const nextPreviewDay = WEEKDAY_ITEMS.find((day) => Boolean(nextAssignments[day.key]));
      if (!nextPreviewDay) {
        setPreviewTemplateId(null);
        setPreviewWeekdayKey(null);
        return;
      }
      setPreviewTemplateId(nextAssignments[nextPreviewDay.key]);
      setPreviewWeekdayKey(nextPreviewDay.key);
    }
  };

  async function persistAssignments(nextAssignments: WeekdayAssignmentMap) {
    try {
      const updated = await updateRoutineTemplateWeekdayAssignmentsMutation.mutateAsync({
        assignments: WEEKDAY_ITEMS.map((day) => ({
          weekday: day.weekday,
          routineTemplateId: nextAssignments[day.key],
        })),
      });
      const nextSaved = buildAssignmentMap(updated);
      setDraftAssignments(nextSaved);
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "요일별 루틴 자동 저장 중 오류가 발생했어요.");
      toast.error(message, "자동 저장 실패");
    }
  }

  if (routeState.isEditorRoute) {
    const handleCloseEditor = () => {
      if (openedFromRoutineManage) {
        goBack({ animated: false });
        return;
      }
      goPage(ROUTINE_MANAGE_PATH, { replace: true });
    };

    return (
      <section className="flex h-full min-h-0 flex-col rounded-2xl border border-base-300 bg-base-200/50 px-1.5 pt-1.5 pb-0">
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-base-300/80 bg-base-100/75">
          {routeState.mode === "edit" && !editingTemplateForRoute ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
              <p className="m-0 text-sm text-base-content/70">수정할 루틴을 찾을 수 없어요.</p>
              <Button
                variant="primary"
                size="sm"
                className="rounded-lg"
                onClick={() => goPage(ROUTINE_MANAGE_PATH, { replace: true })}
              >
                루틴 관리로 돌아가기
              </Button>
            </div>
          ) : (
            <TodoRoutineCreateModal
              onClose={handleCloseEditor}
              onCreate={handleCreateTemplateFromRoute}
              initialDraft={
                editingTemplateForRoute
                  ? {
                      name: editingTemplateForRoute.name,
                      items: editingTemplateForRoute.items
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((item) => ({
                          taskId: item.taskId,
                          titleSnapshot: item.titleSnapshot,
                          content: item.content,
                          scheduledTimeHHmm: item.scheduledTimeHHmm,
                        })),
                    }
                  : null
              }
            />
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-base-300 bg-base-200/50 px-1.5 pt-1.5 pb-0">
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <Button
          size="sm"
          variant={activeTab === "templates" ? "primary" : "default"}
          onClick={() => setActiveTab("templates")}
        >
          루틴 템플릿
        </Button>
        <Button
          size="sm"
          variant={activeTab === "weekdays" ? "primary" : "default"}
          onClick={() => setActiveTab("weekdays")}
        >
          요일별 루틴
        </Button>
      </div>

      <div className="mt-3 min-h-0 flex-1">
        {activeTab === "templates" ? (
          <section className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_3.5rem] overflow-hidden rounded-xl border border-base-300/80 bg-base-100/75 p-2">
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <RoutineTemplateListPanel
                routineTemplates={routineTemplates}
                selectedTemplateKey={selectedTemplateKey}
                isSavingTemplate={isSavingTemplate}
                onSelectTemplate={handleSelectTemplate}
                onOpenTemplateMenu={handleOpenTemplateMenu}
              />
              <RoutineTemplateDetailPanel
                hasSelectedTemplate={Boolean(templateDraft.templateId)}
                itemCount={templateDraft.items.length}
                scrollContainerRef={templateDetailScrollRef}
              >
                {templateDraft.templateId ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleTemplateItemDragEnd}
                  >
                    <SortableContext items={sortableItemIds} strategy={verticalListSortingStrategy}>
                      <div className="space-y-1.5">
                        {templateDraft.items.map((item) => (
                          <RoutineTemplateSortableItemRow
                            key={item.clientId}
                            item={item}
                            onOpenMenu={handleOpenTemplateItemMenu}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : null}
              </RoutineTemplateDetailPanel>
            </div>
            <div className="shrink-0 border-t border-base-300/80 bg-base-100 p-2">
              <Button
                variant="primary"
                block
                className="h-10 min-h-10 rounded-xl"
                onClick={() => {
                  goPage(ROUTINE_CREATE_PATH, {
                    state: { fromRoutineManage: true },
                  });
                }}
              >
                루틴 만들기
              </Button>
            </div>
          </section>
        ) : (
          <div className="h-full min-h-0 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col gap-2">
              <DndContext
                sensors={sensors}
                collisionDetection={weekdayCollisionDetection}
                onDragStart={handleWeekdayAssignmentDragStart}
                onDragEnd={handleWeekdayAssignmentDragEnd}
                onDragCancel={() => setDraggingTemplateId(null)}
              >
                <section className="shrink-0 rounded-xl border border-base-300/80 bg-base-100/75 p-3">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="m-0 text-sm font-semibold text-base-content">주간 루틴</p>
                      <p className="m-0 mt-0.5 text-xs text-base-content/60">루틴 카드를 날짜 칸에 놓으면 매주 자동 적용</p>
                    </div>
                    <span className="rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {assignedDayCount}/7일 활성
                    </span>
                  </div>
                  <div className="no-scrollbar -mx-1 overflow-x-auto px-1 pb-1">
                    <div className="grid min-w-[37rem] grid-cols-7 gap-2">
                      {WEEKDAY_ITEMS.map((day) => {
                        const templateId = draftAssignments[day.key];
                        const assignedTemplate = routineTemplates.find((template) => template.id === templateId) ?? null;
                        return (
                          <WeekdayDropCard
                            key={`weekday-slot-${day.key}`}
                            day={day}
                            assignedTemplate={assignedTemplate}
                            tone={WEEKDAY_TONE_MAP[day.key]}
                            disabled={isLoadingAssignments || isSavingAssignments}
                            onClearDay={handleClearWeekdayAssignment}
                          />
                        );
                      })}
                    </div>
                  </div>
                </section>

                <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-base-300/80 bg-base-100/75 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="m-0 text-sm font-semibold text-base-content">루틴</p>
                    <span className="rounded-md border border-base-300/80 bg-base-200/45 px-2 py-0.5 text-[11px] text-base-content/70">
                      {routineTemplates.length}개
                    </span>
                  </div>
                  <p className="m-0 text-xs text-base-content/60">카드를 요일 칸으로 드래그해 매주 루틴을 배치해요.</p>
                  <div className="no-scrollbar mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
                    {routineTemplates.map((template) => (
                      <RoutineTemplateDraggableCard
                        key={template.id}
                        template={template}
                        disabled={isLoadingAssignments || isSavingAssignments}
                        isSelected={previewTemplateId === template.id}
                        assignedDays={templateAssignedDaysById[template.id] ?? []}
                        onOpenDetails={handleOpenPreviewTemplateDetails}
                      />
                    ))}
                    {routineTemplates.length === 0 ? (
                      <p className="m-0 rounded-lg border border-base-300/60 bg-base-200/45 px-3 py-2 text-xs text-base-content/60">
                        저장된 루틴 템플릿이 없어요.
                      </p>
                    ) : null}
                  </div>
                </section>
                {typeof document !== "undefined"
                  ? createPortal(
                      <DragOverlay dropAnimation={null}>
                        {draggingTemplate ? (
                          <div className="w-[13.5rem] rounded-xl border border-primary/55 bg-base-100 px-3 py-2 shadow-2xl">
                            <p className="m-0 truncate text-sm font-semibold text-base-content">
                              {draggingTemplate.name}
                            </p>
                            <p className="m-0 mt-0.5 text-xs text-base-content/65">
                              {draggingTemplate.items.length}개 할 일
                            </p>
                          </div>
                        ) : null}
                      </DragOverlay>,
                      document.body
                    )
                  : null}
              </DndContext>

              <RoutinePreviewDetailPanel
                previewTemplate={previewTemplate}
                scrollContainerRef={weekdayPreviewDetailScrollRef}
              />
            </div>
          </div>
        )}
      </div>

      <TimePickerBottomSheet
        isOpen={Boolean(editingTimeItem)}
        title="시작시간 설정"
        initialValue={editingTimeItem?.scheduledTimeHHmm ?? "09:00"}
        description="위로 스크롤해 시작시간을 선택해 주세요."
        applyLabel="저장"
        onClose={() => setEditingTimeItemClientId(null)}
        onApply={(nextTime) => {
          if (!editingTimeItem) {
            return false;
          }
          setTemplateDraft((prev) => ({
            ...prev,
            items: (() => {
              const nextItems = prev.items.map((item) =>
                item.clientId === editingTimeItem.clientId ? { ...item, scheduledTimeHHmm: nextTime } : item
              );
              void persistTemplateItems(nextItems);
              return nextItems;
            })(),
          }));
          return true;
        }}
      />

      {renameTemplateId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="루틴 이름 변경 닫기"
            onClick={() => setRenameTemplateId(null)}
          />
          <section className="relative z-10 w-full max-w-sm rounded-2xl border border-base-300 bg-base-100 p-4 shadow-2xl">
            <p className="m-0 text-sm font-semibold text-base-content">루틴 이름 변경</p>
            <div className="mt-3">
              <InputField
                value={renameInput}
                autoFocus
                placeholder="루틴 이름"
                onChange={(event) => setRenameInput(event.target.value)}
              />
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => setRenameTemplateId(null)}>
                취소
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="rounded-lg"
                onClick={() => {
                  void handleSubmitRename();
                }}
                disabled={updateRoutineTemplateMutation.isPending}
              >
                저장
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
