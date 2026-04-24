import { useSortable, type UseSortableArguments } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";

type SortableStylePreset = "default" | "fadeOutOnDrag" | "elevateOnDrag";

type UseSortableItemOptions = UseSortableArguments & {
  stylePreset?: SortableStylePreset;
};

function buildStyle(
  transform: ReturnType<typeof useSortable>["transform"],
  transition: ReturnType<typeof useSortable>["transition"],
  isDragging: boolean,
  stylePreset: SortableStylePreset
): CSSProperties {
  const baseStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (stylePreset === "fadeOutOnDrag") {
    return {
      ...baseStyle,
      transition: isDragging ? undefined : transition,
      opacity: isDragging ? 0 : 1,
    };
  }

  if (stylePreset === "elevateOnDrag") {
    return {
      ...baseStyle,
      transition: isDragging ? undefined : transition,
      zIndex: isDragging ? 20 : undefined,
      position: isDragging ? "relative" : undefined,
    };
  }

  return baseStyle;
}

export function useSortableItem({ stylePreset = "default", ...options }: UseSortableItemOptions) {
  const sortable = useSortable(options);
  const { attributes, listeners, transform, transition, isDragging } = sortable;

  const dragHandleProps = {
    ...(attributes ?? {}),
    ...(listeners ?? {}),
  };

  const style = buildStyle(transform, transition, isDragging, stylePreset);

  return {
    ...sortable,
    style,
    dragHandleProps,
  };
}
