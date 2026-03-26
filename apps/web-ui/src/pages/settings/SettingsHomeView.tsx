import { FiBell, FiChevronRight, FiCloud, FiSun } from "react-icons/fi";
import type { SettingsSection } from "./types";

type SettingsHomeViewProps = {
  onNavigate: (nextSection: Exclude<SettingsSection, "home">) => void;
};

export function SettingsHomeView({ onNavigate }: SettingsHomeViewProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-base-300 bg-base-200/50 p-4">
      <div>
        <h2 className="m-0 text-base font-semibold text-base-content">설정</h2>
        <p className="mt-1 text-sm text-base-content/70">카테고리를 선택하세요.</p>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl border border-base-300/80 bg-base-100/75 px-3 py-3 text-left"
          onClick={() => onNavigate("theme")}
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-base-200 text-base-content/80">
            <FiSun size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-base-content">테마</span>
            <span className="block text-xs text-base-content/60">스타일과 라이트/다크 모드</span>
          </span>
          <FiChevronRight size={18} className="text-base-content/50" />
        </button>

        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl border border-base-300/80 bg-base-100/75 px-3 py-3 text-left"
          onClick={() => onNavigate("weather")}
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-base-200 text-base-content/80">
            <FiCloud size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-base-content">날씨</span>
            <span className="block text-xs text-base-content/60">표시 여부와 무드 선택</span>
          </span>
          <FiChevronRight size={18} className="text-base-content/50" />
        </button>

        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl border border-base-300/80 bg-base-100/75 px-3 py-3 text-left"
          onClick={() => onNavigate("notifications")}
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-base-200 text-base-content/80">
            <FiBell size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-base-content">알림</span>
            <span className="block text-xs text-base-content/60">푸시 알림/리마인더 옵션</span>
          </span>
          <FiChevronRight size={18} className="text-base-content/50" />
        </button>
      </div>
    </section>
  );
}

