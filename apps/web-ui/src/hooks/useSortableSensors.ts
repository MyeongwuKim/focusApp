import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export type SortableSensorPreset = "default" | "quick";

export function useSortableSensors(preset: SortableSensorPreset = "default") {
  const mouseActivationConstraint =
    preset === "quick"
      ? { distance: 2 }
      : { delay: 180, tolerance: 8 };

  const touchActivationConstraint =
    preset === "quick"
      ? { delay: 120, tolerance: 3 }
      : { delay: 180, tolerance: 8 };

  return useSensors(
    useSensor(MouseSensor, {
      activationConstraint: mouseActivationConstraint,
    }),
    useSensor(TouchSensor, {
      activationConstraint: touchActivationConstraint,
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
}
