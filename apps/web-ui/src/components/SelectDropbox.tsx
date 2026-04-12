import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown } from "react-icons/fi";

type SelectOption = {
  value: string | number;
  label: string;
  disabled?: boolean;
};

type SelectDropboxProps = {
  value?: string | number | null;
  defaultValue?: string | number | null;
  options: SelectOption[];
  className?: string;
  menuClassName?: string;
  disabled?: boolean;
  placeholder?: string;
  onValueChange?: (value: string) => void;
};

export function SelectDropbox({
  value,
  defaultValue,
  options,
  className,
  menuClassName,
  disabled = false,
  placeholder = "선택해 주세요",
  onValueChange,
}: SelectDropboxProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [uncontrolledValue, setUncontrolledValue] = useState<string | null>(
    defaultValue === undefined || defaultValue === null ? null : String(defaultValue)
  );

  const isControlled = value !== undefined;
  const selectedValue = isControlled
    ? value === null ? null : String(value)
    : uncontrolledValue;

  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === selectedValue) ?? null,
    [options, selectedValue]
  );

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) {
        return;
      }
      if (!root.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleSelect = (nextValue: string) => {
    if (!isControlled) {
      setUncontrolledValue(nextValue);
    }
    onValueChange?.(nextValue);
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }
          setIsOpen((prev) => !prev);
        }}
        className={[
          "flex h-10 w-full items-center justify-between rounded-lg border border-base-300 bg-base-100 px-3 text-sm text-base-content/90 transition-colors",
          "focus:outline-none focus:ring-0",
          disabled ? "cursor-not-allowed opacity-60" : "hover:border-base-content/25",
          className ?? "",
        ].join(" ")}
      >
        <span className={selectedOption ? "truncate" : "truncate text-base-content/50"}>
          {selectedOption?.label ?? placeholder}
        </span>
        <FiChevronDown
          size={14}
          className={["shrink-0 text-base-content/60 transition-transform", isOpen ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {isOpen ? (
        <div
          className={[
            "absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-base-300 bg-base-100 p-1 shadow-lg",
            menuClassName ?? "",
          ].join(" ")}
        >
          {options.map((option) => {
            const optionValue = String(option.value);
            const active = optionValue === selectedValue;
            return (
              <button
                key={optionValue}
                type="button"
                disabled={option.disabled}
                onClick={() => handleSelect(optionValue)}
                className={[
                  "flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  option.disabled ? "cursor-not-allowed opacity-50" : "",
                  active ? "bg-primary/12 text-primary" : "text-base-content/85 hover:bg-base-200/70",
                ].join(" ")}
              >
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
