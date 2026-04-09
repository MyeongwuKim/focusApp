import { Button } from "./ui/Button";

type ToggleOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedToggleProps<T extends string> = {
  value: T;
  options: ToggleOption<T>[];
  onChange: (nextValue: T) => void;
  size?: "sm" | "md";
};

export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  size = "sm",
}: SegmentedToggleProps<T>) {
  return (
    <div className="join">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Button
            key={option.value}
            size={size}
            variant={isActive ? "primary" : "ghost"}
            className="join-item"
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
