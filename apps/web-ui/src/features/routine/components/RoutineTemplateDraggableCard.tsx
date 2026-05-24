import { useDraggable } from "@dnd-kit/core";
import { memo } from "react";
import { type RoutineTemplate } from "../../../api/routineTemplateApi";

export type RoutineTemplateAssignedDayChip = {
  key: string;
  shortLabel: string;
  toneClassName: string;
};

type RoutineTemplateDraggableCardProps = {
  template: RoutineTemplate;
  isSelected: boolean;
  disabled: boolean;
  assignedDays: RoutineTemplateAssignedDayChip[];
  onOpenDetails: (templateId: string) => void;
};

export const RoutineTemplateDraggableCard = memo(function RoutineTemplateDraggableCard({
  template,
  isSelected,
  disabled,
  assignedDays,
  onOpenDetails,
}: RoutineTemplateDraggableCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `routine-template:${template.id}`,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={[
        "touch-pan-y select-none rounded-xl border p-3 transition-[transform,border-color,background-color,box-shadow]",
        "border-base-300/80 bg-base-100 text-base-content shadow-sm",
        disabled ? "cursor-not-allowed" : "cursor-grab hover:border-primary/45 hover:shadow-md active:cursor-grabbing",
        isDragging ? "border-primary/70 shadow-lg" : "",
        isSelected ? "border-primary/55 shadow-[inset_0_0_0_1px_rgba(236,72,153,0.35)]" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-left"
          onClick={() => {
            if (isDragging) {
              return;
            }
            onOpenDetails(template.id);
          }}
          disabled={disabled}
        >
          <p className="m-0 truncate text-sm font-semibold">{template.name}</p>
          <p className="m-0 mt-0.5 text-xs text-base-content/65">{template.items.length}개 할 일</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {assignedDays.length > 0 ? (
              assignedDays.map((day) => (
                <span
                  key={`assigned-day-${template.id}-${day.key}`}
                  className={[
                    "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold text-slate-800",
                    day.toneClassName,
                  ].join(" ")}
                >
                  {day.shortLabel}
                </span>
              ))
            ) : (
              <span className="rounded-md border border-base-300/70 bg-base-200/45 px-1.5 py-0.5 text-[10px] text-base-content/55">
                미할당
              </span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
});
