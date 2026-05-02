import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { DRAWER_ROUTES } from "../routes/route-config";
import type { RouteKey } from "../routes/types";
import { FiArchive, FiBarChart2, FiLogOut, FiSettings } from "react-icons/fi";
import { useAppNavigation } from "../providers/AppNavigationProvider";
import { logout } from "../api/authApi";
import { fetchMe } from "../api/userApi";
import { toast, useAuthStore } from "../stores";
import { Button } from "./ui/Button";

type DrawerMenuProps = {
  isOpen: boolean;
};

const ROUTE_ICON: Partial<Record<RouteKey, ReactNode>> = {
  tasks: <FiArchive size={15} />,
  stats: <FiBarChart2 size={15} />,
  settings: <FiSettings size={15} />,
};

export function DrawerMenu({ isOpen }: DrawerMenuProps) {
  const { activeRoute, closeMenu, navigateTo, goPage } = useAppNavigation();
  const token = useAuthStore((state) => state.token);
  const authUser = useAuthStore((state) => state.user);
  const authProvider = useAuthStore((state) => state.provider);
  const setAuthUser = useAuthStore((state) => state.setAuthUser);
  const hasToken = Boolean(token);
  const meQuery = useQuery({
    queryKey: ["me", token],
    queryFn: fetchMe,
    enabled: hasToken,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    meta: {
      skipGlobalErrorToast: true,
    },
  });
  useEffect(() => {
    if (!hasToken) {
      setAuthUser(null);
      return;
    }

    if (meQuery.isSuccess) {
      setAuthUser(meQuery.data ?? null);
    }
  }, [hasToken, meQuery.data, meQuery.isSuccess, setAuthUser]);

  const handleNavigateFromDrawer = (route: RouteKey) => {
    navigateTo(route);
  };

  const accountEmail = meQuery.data?.email ?? authUser?.email ?? "guest";
  const providerLabel =
    authProvider === "kakao" ? "카카오 로그인" : authProvider === "naver" ? "네이버 로그인" : null;

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
        <div className="mb-3">
          <p className="m-0 text-xs font-medium uppercase tracking-wide text-base-content/55">ACCOUNT</p>
          <p className="mt-1 text-sm font-medium text-base-content/80 break-all">{accountEmail}</p>
          {providerLabel ? <p className="mt-1 text-xs text-base-content/55">{providerLabel}</p> : null}
        </div>
        <div className="mb-3 h-px w-full bg-base-300/90" />

        <nav className="menu gap-1 p-0 text-sm">
          {DRAWER_ROUTES.map((route) => (
            <Button
              key={route.key}
              variant={activeRoute === route.key ? "default" : "ghost"}
              className={[
                "justify-start gap-2.5 rounded-lg border border-transparent px-2.5",
                activeRoute === route.key ? "bg-base-200 text-primary" : "text-base-content/80",
              ].join(" ")}
              onClick={() => handleNavigateFromDrawer(route.key)}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center text-base-content/75">
                {ROUTE_ICON[route.key]}
              </span>
              {route.label}
            </Button>
          ))}

          <div className="my-1 h-px w-full bg-base-300/80" />

          <Button
            variant="ghost"
            className="justify-start gap-2.5 text-error"
            onClick={async () => {
              await logout();
              closeMenu();
              goPage("/login", { replace: true });
              toast.positive("로그아웃 되었어요.", "로그아웃");
            }}
          >
            <span className="inline-flex h-4 w-4 items-center justify-center">
              <FiLogOut size={15} />
            </span>
            로그아웃
          </Button>
        </nav>
      </aside>
    </div>
  );
}
