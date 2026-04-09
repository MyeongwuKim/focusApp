import { useEffect, useMemo, useRef } from "react";
import { FiChevronDown } from "react-icons/fi";
import { SelectDropbox } from "./SelectDropbox";
import { Button } from "./ui/Button";

type MonthDropdownProps = {
  month: Date;
  onChange: (nextMonth: Date) => void;
};

function createYearRange(centerYear: number, range = 6) {
  const years: number[] = [];
  for (let year = centerYear - range; year <= centerYear + range; year += 1) {
    years.push(year);
  }
  return years;
}

export function MonthDropdown({ month, onChange }: MonthDropdownProps) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  const years = useMemo(() => createYearRange(month.getFullYear()), [month]);
  const monthLabel = `${month.getFullYear()}.${String(month.getMonth() + 1).padStart(2, "0")}`;

  const closeDropdown = () => {
    if (detailsRef.current) {
      detailsRef.current.removeAttribute("open");
    }
  };

  const handleYearChange = (year: number) => {
    onChange(new Date(year, month.getMonth(), 1));
  };

  const handleMonthClick = (monthIndex: number) => {
    onChange(new Date(month.getFullYear(), monthIndex, 1));
    closeDropdown();
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const detailsElement = detailsRef.current;
      if (!detailsElement || !detailsElement.hasAttribute("open")) {
        return;
      }
      if (!detailsElement.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <details ref={detailsRef} className="dropdown dropdown-bottom flex w-full justify-center">
      <summary className="btn btn-sm btn-ghost rounded-xl px-3.5 text-base font-semibold normal-case">
        <span className="inline-flex items-center gap-2.5">
          <span>{monthLabel}</span>
          <FiChevronDown size={14} className="text-base-content/65" />
        </span>
      </summary>

      <div
        className="dropdown-content left-1/2 z-30 mt-2 max-h-[58svh] -translate-x-1/2 overflow-auto rounded-2xl border border-base-300 bg-base-100 p-3 shadow-xl"
        style={{
          width: "calc(100vw - 1.25rem)",
          maxWidth: "calc(460px * var(--ui-scale) - 0.7rem)",
        }}
      >
        <label className="mb-2 block text-xs font-medium text-base-content/70">연도</label>
        <SelectDropbox
          className="select-sm mb-3 h-10"
          value={month.getFullYear()}
          onChange={(event) => handleYearChange(Number(event.target.value))}
          options={years.map((year) => ({
            value: String(year),
            label: `${year}년`
          }))}
        />

        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 12 }, (_, monthIndex) => (
            <Button
              key={monthIndex}
              variant={month.getMonth() === monthIndex ? "primary" : "ghost"}
              className="h-8 min-h-8"
              onClick={() => handleMonthClick(monthIndex)}
            >
              {monthIndex + 1}월
            </Button>
          ))}
        </div>
      </div>
    </details>
  );
}
