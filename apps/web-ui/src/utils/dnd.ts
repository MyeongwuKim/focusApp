import { arrayMove } from "@dnd-kit/sortable";

function resolveIndex<T>(items: T[], id: string, getId: (item: T) => string) {
  return items.findIndex((item) => getId(item) === id);
}

export function reorderById<T>(
  items: T[],
  activeId: string,
  overId: string,
  getId: (item: T) => string
): T[] {
  const oldIndex = resolveIndex(items, activeId, getId);
  const newIndex = resolveIndex(items, overId, getId);

  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
    return items;
  }

  return arrayMove(items, oldIndex, newIndex);
}

export function reorderStringIdsByDrag(ids: string[], activeId: string, overId: string) {
  return reorderById(ids, activeId, overId, (id) => id);
}
