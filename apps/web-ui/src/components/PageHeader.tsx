import { MAIN_ROUTE, ROUTE_LABEL } from "../routes/route-config";
import type { RouteKey } from "../routes/types";
import { MonthDropdown } from "./MonthDropdown";
import { FiMenu, FiSettings } from "react-icons/fi";

type PageHeaderProps = {
  route: RouteKey;
  month: Date;
  onMonthChange: (nextMonth: Date) => void;
  onOpenMenu: () => void;
  onGoMain: () => void;
  onGoSettings: () => void;
};

export function PageHeader({
  route,
  month,
  onMonthChange,
  onOpenMenu,
  onGoMain,
  onGoSettings,
}: PageHeaderProps) {
  if (route === MAIN_ROUTE) {
    return (
      <header className="mb-2 grid h-12 grid-cols-[44px_1fr_44px] items-center rounded-2xl border border-base-300/80 bg-base-200/50 px-2">
        <button
          type="button"
          className="btn btn-sm btn-ghost btn-circle"
          onClick={onOpenMenu}
          aria-label="메뉴 열기"
        >
          <FiMenu size={18} />
        </button>

        <div className="flex justify-center">
          <MonthDropdown month={month} onChange={onMonthChange} />
        </div>

        <button
          type="button"
          className="btn btn-sm btn-ghost btn-circle justify-self-end"
          onClick={onGoSettings}
          aria-label="설정으로 이동"
        >
          <FiSettings size={18} />
        </button>
      </header>
    );
  }

  return (
    <header className="mb-2 flex h-12 items-center gap-2 rounded-2xl border border-base-300/80 bg-base-200/50 px-2">
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={onGoMain}
        aria-label="뒤로가기"
      >
        ← 뒤로
      </button>
      <h1 className="m-0 text-lg font-semibold text-base-content">{ROUTE_LABEL[route]}</h1>
    </header>
  );
}
