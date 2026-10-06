import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<CSSProperties | null>(null);
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

  /**
   * 메뉴를 document.body에 띄울 때 트리거의 화면 좌표를 기준으로 위치를 계산한다.
   * 아래 공간이 부족하면 위로 열고, 양쪽 화면 여백과 최대 높이를 벗어나지 않게 제한한다.
   */
  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const viewportPadding = 8;
    const menuGap = 4;
    const preferredMaxHeight = 224;
    const minimumUsefulHeight = 112;
    const rect = trigger.getBoundingClientRect();
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding - menuGap;
    const availableAbove = rect.top - viewportPadding - menuGap;
    const openAbove = availableBelow < minimumUsefulHeight && availableAbove > availableBelow;
    const availableHeight = Math.max(openAbove ? availableAbove : availableBelow, 72);
    const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(rect.left, viewportPadding),
      Math.max(viewportPadding, window.innerWidth - viewportPadding - width)
    );

    setMenuPosition({
      position: "fixed",
      left,
      width,
      maxHeight: Math.min(preferredMaxHeight, availableHeight),
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + menuGap, top: "auto" }
        : { top: rect.bottom + menuGap, bottom: "auto" }),
    });
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) {
        return;
      }
      const target = event.target as Node;
      if (!root.contains(target) && !menuRef.current?.contains(target)) {
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

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  const handleSelect = (nextValue: string) => {
    if (!isControlled) {
      setUncontrolledValue(nextValue);
    }
    onValueChange?.(nextValue);
    setIsOpen(false);
  };

  const menu = isOpen && menuPosition ? (
    <div
      ref={menuRef}
      role="listbox"
      className={[
        "sketchbook-floating-surface fixed z-[140] overflow-auto rounded-lg border border-base-300 p-1 shadow-lg",
        menuClassName ?? "",
      ].join(" ")}
      style={menuPosition}
    >
      {options.map((option) => {
        const optionValue = String(option.value);
        const active = optionValue === selectedValue;
        return (
          <button
            key={optionValue}
            type="button"
            role="option"
            aria-selected={active}
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
  ) : null;

  return (
    <>
      <div ref={rootRef} className="relative w-full">
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          disabled={disabled}
          onClick={() => {
            if (disabled) {
              return;
            }
            setIsOpen((prev) => {
              if (!prev) {
                updateMenuPosition();
              }
              return !prev;
            });
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
            className={[
              "shrink-0 text-base-content/60 transition-transform",
              isOpen ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>
      </div>
      {menu && typeof document !== "undefined" ? createPortal(menu, document.body) : menu}
    </>
  );
}
