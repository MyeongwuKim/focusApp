import type { ReactNode } from "react";
import { DRAWER_ROUTES } from "../routes/route-config";
import type { RouteKey } from "../routes/types";
import { FiArchive, FiBarChart2, FiLogOut, FiSettings } from "react-icons/fi";
import { useAppNavigation } from "../providers/AppNavigationProvider";
import { toast } from "../stores";

type DrawerMenuProps = {
  isOpen: boolean;
};

const ROUTE_ICON: Partial<Record<RouteKey, ReactNode>> = {
  tasks: <FiArchive size={15} />,
  stats: <FiBarChart2 size={15} />,
  settings: <FiSettings size={15} />,
};

export function DrawerMenu({ isOpen }: DrawerMenuProps) {
  const { activeRoute, closeMenu, navigateTo } = useAppNavigation();

  return (
    <div
      className={[
        "fixed inset-0 z-40 transition",
        isOpen ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
    >
      <button
        type="button"
        className={[
          "absolute inset-0 bg-black/35 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={closeMenu}
        aria-label="메뉴 닫기"
      />

      <aside
        className={[
          "absolute left-0 top-0 h-full w-[280px] border-r border-base-300 bg-base-100 p-5 shadow-2xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        aria-hidden={!isOpen}
      >
        <div className="mb-6">
          <h2 className="m-0 text-base font-semibold text-base-content">Focus Hybrid</h2>
          <p className="mt-1 text-sm text-base-content/65">메뉴</p>
        </div>

        <nav className="menu gap-1 rounded-box bg-base-200/60 p-2 text-sm">
          {DRAWER_ROUTES.map((route) => (
            <button
              key={route.key}
              type="button"
              className={[
                "btn justify-start gap-2.5",
                activeRoute === route.key ? "btn-soft btn-primary" : "btn-ghost",
              ].join(" ")}
              onClick={() => navigateTo(route.key)}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center text-base-content/75">
                {ROUTE_ICON[route.key]}
              </span>
              {route.label}
            </button>
          ))}

          <div className="my-1 h-px w-full bg-base-300/80" />

          <button
            type="button"
            className="btn btn-ghost justify-start gap-2.5 text-error"
            onClick={() => {
              closeMenu();
              toast.show({
                type: "positive",
                title: "로그아웃",
                message: "로그아웃 기능은 곧 연결할게요.",
                duration: 1800,
              });
            }}
          >
            <span className="inline-flex h-4 w-4 items-center justify-center">
              <FiLogOut size={15} />
            </span>
            로그아웃
          </button>
        </nav>
      </aside>
    </div>
  );
}
