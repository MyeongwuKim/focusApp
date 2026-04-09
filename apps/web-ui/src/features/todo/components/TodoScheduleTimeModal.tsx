import { useEffect, useMemo, useState } from "react";
import { FiClock, FiX } from "react-icons/fi";
import { Button } from "../../../components/ui/Button";
import { InputField } from "../../../components/ui/InputField";

type TodoScheduleTimeModalProps = {
  isOpen: boolean;
  dateKey: string;
  initialTime: string;
  onClose: () => void;
  onSave: (time: string) => void;
};

function getTodayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

export function TodoScheduleTimeModal({
  isOpen,
  dateKey,
  initialTime,
  onClose,
  onSave,
}: TodoScheduleTimeModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [time, setTime] = useState(initialTime);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setTime(initialTime);
      return;
    }

    const timer = window.setTimeout(() => {
      setShouldRender(false);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [initialTime, isOpen]);

  const minTime = useMemo(() => {
    if (dateKey !== getTodayDateKey()) {
      return undefined;
    }
    const now = new Date(Date.now() + 60 * 1000);
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }, [dateKey, isOpen]);

  const isInvalidForToday = useMemo(() => {
    if (!minTime) {
      return false;
    }
    return time < minTime;
  }, [minTime, time]);

  const minMinutes = useMemo(() => {
    if (!minTime) {
      return null;
    }
    const [hour, minute] = minTime.split(":").map(Number);
    return hour * 60 + minute;
  }, [minTime]);

  const applyQuickTime = (targetTime: string) => {
    if (minMinutes === null) {
      setTime(targetTime);
      return;
    }

    const [hour, minute] = targetTime.split(":").map(Number);
    const targetMinutes = hour * 60 + minute;
    if (targetMinutes < minMinutes) {
      setTime(minTime ?? targetTime);
      return;
    }
    setTime(targetTime);
  };

  const applyQuickOffset = (minutes: number) => {
    const now = new Date();
    now.setSeconds(0, 0);
    const roundedMinute = Math.ceil(now.getMinutes() / 5) * 5;
    now.setMinutes(roundedMinute + minutes);
    const nextTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    applyQuickTime(nextTime);
  };

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={[
        "absolute inset-0 z-40 flex items-center justify-center bg-transparent p-4 transition-opacity duration-200",
        isOpen ? "opacity-100" : "opacity-0",
      ].join(" ")}
      onClick={onClose}
    >
      <div
        className={[
          "w-full max-w-sm rounded-3xl border border-base-300/80 bg-base-100 p-4 shadow-2xl transition-transform duration-200",
          isOpen ? "translate-y-0" : "translate-y-2",
        ].join(" ")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="m-0 text-base font-semibold text-base-content">시작시간 설정</h3>
          <Button variant="ghost" size="xs" circle onClick={onClose} aria-label="시작시간 설정 닫기">
            <FiX size={14} />
          </Button>
        </div>

        <div className="space-y-3.5">
          <div className="rounded-2xl border border-base-300/70 bg-base-200/45 px-3 py-2.5">
            <p className="m-0 text-[11px] font-medium text-base-content/55">선택된 시간</p>
            <p className="mt-0.5 mb-0 flex items-center gap-1.5 text-lg font-semibold text-base-content">
              <FiClock size={15} className="text-info" />
              {time || "--:--"}
            </p>
          </div>

          <InputField
            type="time"
            value={time}
            min={minTime}
            onChange={(event) => setTime(event.target.value)}
            className="h-12 w-full rounded-xl text-base"
          />

          <div className="grid grid-cols-4 gap-1.5">
            <Button size="xs" className="h-8 min-h-8 rounded-full" onClick={() => applyQuickOffset(30)}>
              +30분
            </Button>
            <Button size="xs" className="h-8 min-h-8 rounded-full" onClick={() => applyQuickOffset(60)}>
              +1시간
            </Button>
            <Button size="xs" className="h-8 min-h-8 rounded-full" onClick={() => applyQuickOffset(120)}>
              +2시간
            </Button>
            <Button size="xs" className="h-8 min-h-8 rounded-full" onClick={() => applyQuickTime("21:00")}>
              21:00
            </Button>
          </div>

          {minTime ? (
            <p className="m-0 text-xs text-base-content/65">오늘은 현재 시각 이후로만 설정할 수 있어요.</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="min-w-16"
              disabled={!time || isInvalidForToday}
              onClick={() => onSave(time)}
            >
              저장
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
