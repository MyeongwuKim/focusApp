import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiPlus, FiStar, FiX } from "react-icons/fi";

type PickerCategory = "all" | "study" | "health" | "work" | "life";

type PickerTask = {
  id: string;
  label: string;
  category: Exclude<PickerCategory, "all">;
};

const CATEGORY_LABEL: Record<PickerCategory, string> = {
  all: "전체",
  study: "공부",
  health: "건강",
  work: "업무",
  life: "생활",
};

const TASK_LIBRARY: PickerTask[] = [
  { id: "study-algo", label: "알고리즘 문제풀기", category: "study" },
  { id: "study-english", label: "영어 단어 암기", category: "study" },
  { id: "study-read", label: "전공 서적 읽기", category: "study" },
  { id: "health-walk", label: "30분 걷기", category: "health" },
  { id: "health-stretch", label: "스트레칭", category: "health" },
  { id: "health-water", label: "물 2L 마시기", category: "health" },
  { id: "work-docs", label: "프로젝트 문서 정리", category: "work" },
  { id: "work-review", label: "PR 리뷰", category: "work" },
  { id: "work-report", label: "주간 리포트 작성", category: "work" },
  { id: "life-clean", label: "방 정리", category: "life" },
  { id: "life-journal", label: "하루 회고", category: "life" },
  { id: "life-budget", label: "지출 정리", category: "life" },
];

type TodoTaskPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onApply: (labels: string[]) => void;
};

export function TodoTaskPickerModal({ isOpen, onClose, onApply }: TodoTaskPickerModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PickerCategory>("all");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [favoriteTaskIds, setFavoriteTaskIds] = useState<string[]>([]);
  const [customLabel, setCustomLabel] = useState("");

  useEffect(() => {
    let rafId: number | null = null;
    let timeoutId: number | null = null;

    if (isOpen) {
      setShouldRender(true);
      rafId = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
      timeoutId = window.setTimeout(() => {
        setShouldRender(false);
      }, 240);
    }

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isOpen]);

  const visibleTasks = useMemo(() => {
    const base =
      selectedCategory === "all"
        ? TASK_LIBRARY
        : TASK_LIBRARY.filter((task) => task.category === selectedCategory);

    return [...base].sort((a, b) => {
      const aFavorite = favoriteTaskIds.includes(a.id);
      const bFavorite = favoriteTaskIds.includes(b.id);
      if (aFavorite === bFavorite) {
        return 0;
      }
      return aFavorite ? -1 : 1;
    });
  }, [favoriteTaskIds, selectedCategory]);

  const toggleLabel = (label: string) => {
    setSelectedLabels((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const addCustomTask = () => {
    const nextLabel = customLabel.trim();
    if (!nextLabel) {
      return;
    }
    setSelectedLabels((prev) => (prev.includes(nextLabel) ? prev : [...prev, nextLabel]));
    setCustomLabel("");
  };

  const toggleFavoriteTask = (taskId: string) => {
    setFavoriteTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleApply = () => {
    if (selectedLabels.length === 0) {
      return;
    }
    onApply(selectedLabels);
    setSelectedLabels([]);
    setCustomLabel("");
    setSelectedCategory("all");
    onClose();
  };

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={[
        "absolute inset-0 z-40 transition-opacity duration-250 ease-out",
        isVisible ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      <div
        className={[
          "absolute inset-0 flex flex-col bg-base-100 transition-[transform,opacity] duration-250 ease-out",
          isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-90",
        ].join(" ")}
      >
        <header className="grid h-12 shrink-0 grid-cols-[44px_1fr_64px] items-center border-b border-base-300/80 px-2">
        <button
          type="button"
          aria-label="할일 선택 닫기"
          className="btn btn-sm btn-ghost btn-circle"
          onClick={onClose}
        >
          <FiX size={18} />
        </button>
        <h2 className="m-0 text-center text-sm font-semibold text-base-content">할일 가져오기</h2>
        <div aria-hidden="true" />
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_104px] gap-2 p-2">
        <div className="min-h-0 rounded-xl border border-base-300/80 bg-base-200/35 p-2">
          <div className="no-scrollbar h-full space-y-1.5 overflow-y-auto pr-0.5">
            {visibleTasks.map((task) => {
              const selected = selectedLabels.includes(task.label);
              const favorite = favoriteTaskIds.includes(task.id);
              return (
                <div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  className={[
                    "flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    selected
                      ? "border-primary/65 bg-primary/12 text-primary"
                      : "border-base-300/75 bg-base-100/80 text-base-content/88",
                  ].join(" ")}
                  onClick={() => toggleLabel(task.label)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleLabel(task.label);
                    }
                  }}
                >
                  <span className="truncate">{task.label}</span>
                  <span className="ml-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      className={[
                        "btn btn-xs btn-circle h-6 min-h-6 w-6 min-w-6 border transition-colors",
                        favorite
                          ? "border-warning/45 bg-warning/18 text-warning"
                          : "border-base-300/75 bg-base-100/80 text-base-content/45",
                      ].join(" ")}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleFavoriteTask(task.id);
                      }}
                      aria-label={favorite ? "즐겨찾기 해제" : "즐겨찾기"}
                    >
                      <FiStar
                        size={12}
                        style={{ fill: favorite ? "currentColor" : "transparent" }}
                      />
                    </button>
                    {selected ? <FiCheck size={14} /> : null}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="space-y-1.5 rounded-xl border border-base-300/80 bg-base-200/35 p-2">
          {(Object.keys(CATEGORY_LABEL) as PickerCategory[]).map((category) => {
            const active = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                className={[
                  "btn btn-sm h-9 min-h-9 w-full rounded-lg text-xs",
                  active
                    ? "btn-primary border-primary/60 bg-primary/16 text-primary"
                    : "btn-ghost border border-base-300/70 bg-base-100/70 text-base-content/70",
                ].join(" ")}
                onClick={() => setSelectedCategory(category)}
              >
                {CATEGORY_LABEL[category]}
              </button>
            );
          })}
        </aside>
        </div>

        <div className="shrink-0 border-t border-base-300/80 bg-base-100 p-2">
        <div className="rounded-lg border border-base-300/75 bg-base-200/30 px-2 py-1.5">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="m-0 text-xs font-semibold text-base-content/75">추가한 항목</p>
            <button
              type="button"
              className="text-xs text-base-content/55"
              onClick={() => setSelectedLabels([])}
              disabled={selectedLabels.length === 0}
            >
              비우기
            </button>
          </div>
          <div className="no-scrollbar flex max-h-16 flex-wrap gap-1 overflow-y-auto">
            {selectedLabels.length > 0 ? (
              selectedLabels.map((label) => (
                <button
                  key={label}
                  type="button"
                  className="rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-xs text-primary"
                  onClick={() => toggleLabel(label)}
                >
                  {label}
                </button>
              ))
            ) : (
              <p className="m-0 text-xs text-base-content/55">아직 선택된 할일이 없어요.</p>
            )}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-[1fr_96px] gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-base-300/75 bg-base-100/90 px-3">
            <input
              value={customLabel}
              onChange={(event) => setCustomLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomTask();
                }
              }}
              className="h-9 w-full bg-transparent text-sm outline-none"
              placeholder="리스트에 없는 할일 직접 추가"
            />
            <button
              type="button"
              className="btn btn-xs btn-ghost btn-circle"
              onClick={addCustomTask}
              aria-label="직접 할일 추가"
            >
              <FiPlus size={14} />
            </button>
          </div>
          <button
            type="button"
            className="btn btn-primary h-9 min-h-9 rounded-full text-xs"
            disabled={selectedLabels.length === 0}
            onClick={handleApply}
          >
            {selectedLabels.length}개 추가
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
