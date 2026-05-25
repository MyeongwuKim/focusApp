import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { DRAWER_ROUTES, type DrawerRouteConfig } from "../routes/route-config";
import { FiArchive, FiAward, FiBarChart2, FiLogOut, FiRefreshCw, FiSettings } from "react-icons/fi";
import { useAppNavigation } from "../providers/AppNavigationProvider";
import { logout } from "../api/authApi";
import { fetchMe } from "../api/userApi";
import { toast, useAuthStore } from "../stores";
import { Button } from "./ui/Button";
import { getNativeAppVersionInfo, type NativeAppVersionInfo } from "../utils/nativeBridge";

type DrawerMenuProps = {
  isOpen: boolean;
};

const ROUTE_ICON: Record<DrawerRouteConfig["iconKey"], ReactNode> = {
  tasks: <FiArchive size={15} />,
  stats: <FiBarChart2 size={15} />,
  achievements: <FiAward size={15} />,
  settings: <FiSettings size={15} />,
  routine: <FiRefreshCw size={15} />,
};

export function DrawerMenu({ isOpen }: DrawerMenuProps) {
  const { activeRoute, closeMenu, navigateTo, goPage } = useAppNavigation();
  const location = useLocation();
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

  const handleNavigateFromDrawer = (route: DrawerRouteConfig) => {
    if (route.path) {
      goPage(route.path);
      return;
    }
    if (route.routeKey) {
      navigateTo(route.routeKey);
    }
  };

  const accountEmail = meQuery.data?.email ?? authUser?.email ?? "guest";
  const providerLabel =
    authProvider === "kakao" ? "카카오 로그인" : authProvider === "naver" ? "네이버 로그인" : null;
  const [versionInfo, setVersionInfo] = useState<NativeAppVersionInfo | null>(null);
  const hasRequestedVersionRef = useRef(false);

  useEffect(() => {
    if (!isOpen || hasRequestedVersionRef.current) {
      return;
    }

    hasRequestedVersionRef.current = true;
    void getNativeAppVersionInfo().then((info) => {
      setVersionInfo(info);
    });
  }, [isOpen]);

  const appVersionLabel = versionInfo?.appVersion ?? "-";
  const webUiVersionLabel = versionInfo?.webUiVersion ?? "-";
  const releaseChannelLabel =
    versionInfo?.webUiChannel === "dev"
      ? "dev"
      : versionInfo?.webUiChannel === "prod"
        ? "prod"
        : versionInfo?.webUiChannel === "none"
          ? "none"
          : "unknown";
  const isDrawerRouteActive = (route: DrawerRouteConfig) => {
    const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
    if (route.activePathPrefixes?.some((prefix) => normalizedPath.startsWith(prefix))) {
      return true;
    }
    return route.routeKey ? activeRoute === route.routeKey : false;
  };

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
        <div className="flex h-full flex-col">
          <div className="mb-3">
            <p className="m-0 text-xs font-medium uppercase tracking-wide text-base-content/55">ACCOUNT</p>
            <p className="mt-1 text-sm font-medium text-base-content/80 break-all">{accountEmail}</p>
            {providerLabel ? <p className="mt-1 text-xs text-base-content/55">{providerLabel}</p> : null}
          </div>
          <div className="mb-3 h-px w-full bg-base-300/90" />

          <nav className="menu flex-1 gap-1 p-0 text-sm">
            {DRAWER_ROUTES.map((route) => (
              <Button
                key={route.id}
                variant={isDrawerRouteActive(route) ? "default" : "ghost"}
                className={[
                  "justify-start gap-2.5 rounded-lg border border-transparent px-2.5",
                  isDrawerRouteActive(route) ? "bg-base-200 text-primary" : "text-base-content/80",
                ].join(" ")}
                onClick={() => handleNavigateFromDrawer(route)}
              >
                <span className="inline-flex h-4 w-4 items-center justify-center text-base-content/75">
                  {ROUTE_ICON[route.iconKey]}
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
          <div className="mt-4 border-t border-base-300/80 pt-3">
            <p className="text-[11px] text-base-content/45">현재 버전</p>
            <p className="mt-1 text-xs text-base-content/65">앱 {appVersionLabel}</p>
            <p className="mt-0.5 text-xs text-base-content/65">
              WebUI {webUiVersionLabel} ({releaseChannelLabel})
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
