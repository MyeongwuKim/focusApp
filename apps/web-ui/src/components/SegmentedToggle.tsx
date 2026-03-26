type ToggleOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedToggleProps<T extends string> = {
  value: T;
  options: ToggleOption<T>[];
  onChange: (nextValue: T) => void;
  sizeClassName?: string;
};

export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  sizeClassName = "btn-sm",
}: SegmentedToggleProps<T>) {
  return (
    <div className="join">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`btn ${sizeClassName} join-item ${isActive ? "btn-primary" : "btn-ghost"}`}
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
