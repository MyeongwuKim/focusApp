import { memo } from "react";
import { FiMoreVertical, FiStar, FiTag } from "react-icons/fi";
import { Button } from "../../../components/ui/Button";

type TaskItemSideButton = {
  type: "menu" | "favorite";
  active?: boolean;
  ariaLabel?: string;
  onClick: () => void;
};

type TaskManagementTaskItemProps = {
  label: string;
  collectionName: string;
  active?: boolean;
  isDragging?: boolean;
  disableActions?: boolean;
  onSelect?: () => void;
  sideButton?: TaskItemSideButton;
};

function TaskManagementTaskItemComponent({
  label,
  collectionName,
  active = false,
  isDragging = false,
  disableActions = false,
  onSelect,
  sideButton,
}: TaskManagementTaskItemProps) {
  return (
    <div
      className={[
        "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 transition-colors",
        active
          ? "border-primary/70 bg-primary/10 shadow-[0_0_0_1px_rgba(59,130,246,0.2)]"
          : "border-base-300/75 bg-base-100/85 hover:bg-base-100",
        isDragging ? "opacity-45" : "",
      ].join(" ")}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (disableActions) {
          return;
        }
        onSelect?.();
      }}
      onKeyDown={(event) => {
        if (disableActions) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.();
        }
      }}
    >
      <div className="min-w-0">
        <p className="m-0 truncate text-sm text-base-content/90">{label}</p>
        <p className="m-0 mt-0.5 text-[11px] text-base-content/55">
          <FiTag size={11} className="mr-1 inline-block" />
          {collectionName}
        </p>
      </div>
      {sideButton ? (
        <Button
          variant="ghost"
          size="xs"
          circle
          className={[
            "h-7 min-h-7 w-7 min-w-7",
            sideButton.type === "favorite" && sideButton.active
              ? "text-warning"
              : "text-base-content/55",
          ].join(" ")}
          onClick={(event) => {
            event.stopPropagation();
            if (disableActions) {
              return;
            }
            sideButton.onClick();
          }}
          disabled={disableActions}
          aria-label={
            sideButton.ariaLabel ??
            (sideButton.type === "favorite" ? "즐겨찾기" : "할일 옵션")
          }
        >
          {sideButton.type === "favorite" ? (
            <FiStar
              size={13}
              style={{ fill: sideButton.active ? "currentColor" : "transparent" }}
            />
          ) : (
            <FiMoreVertical size={13} />
          )}
        </Button>
      ) : null}
    </div>
  );
}

export const TaskManagementTaskItem = memo(
  TaskManagementTaskItemComponent,
  (prev, next) =>
    prev.label === next.label &&
    prev.collectionName === next.collectionName &&
    prev.active === next.active &&
    prev.isDragging === next.isDragging &&
    prev.disableActions === next.disableActions &&
    prev.sideButton?.type === next.sideButton?.type &&
    prev.sideButton?.active === next.sideButton?.active &&
    Boolean(prev.sideButton) === Boolean(next.sideButton)
);
