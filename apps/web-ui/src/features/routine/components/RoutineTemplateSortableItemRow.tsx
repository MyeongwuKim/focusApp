import { memo } from "react";
import { FiTag } from "react-icons/fi";
import { Button } from "../../../components/ui/Button";
import { useSortableItem } from "../../../hooks/useSortableItem";

export type RoutineTemplateDraftItem = {
  clientId: string;
  id?: string;
  taskId?: string | null;
  titleSnapshot?: string | null;
  content: string;
  scheduledTimeHHmm?: string | null;
};

type RoutineTemplateSortableItemRowProps = {
  item: RoutineTemplateDraftItem;
  onOpenMenu: (item: RoutineTemplateDraftItem) => Promise<void>;
};

export const RoutineTemplateSortableItemRow = memo(function RoutineTemplateSortableItemRow({
  item,
  onOpenMenu,
}: RoutineTemplateSortableItemRowProps) {
  const { setNodeRef, style, isDragging, dragHandleProps } = useSortableItem({
    id: item.clientId,
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...dragHandleProps}
      className={[
        "rounded-lg border border-base-300/70 bg-base-100 px-2.5 py-2 transition-[border-color,background-color,box-shadow]",
        isDragging ? "border-primary/65 bg-base-100 shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_10px_24px_rgba(0,0,0,0.22)]" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-sm font-medium text-base-content/85">{item.content}</p>
          <p className="m-0 mt-0.5 truncate text-[11px] text-base-content/55">
            <FiTag size={11} className="mr-1 inline-block" />
            {item.titleSnapshot ?? "직접 입력"}
            <span className="ml-2">{item.scheduledTimeHHmm ? `시간 ${item.scheduledTimeHHmm}` : "시간 미설정"}</span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="xs"
          className="h-7 min-h-7 rounded-md px-2 text-sm text-base-content/60"
          onClick={(event) => {
            event.stopPropagation();
            void onOpenMenu(item);
          }}
          aria-label="루틴 항목 메뉴"
        >
          :
        </Button>
      </div>
    </div>
  );
});
