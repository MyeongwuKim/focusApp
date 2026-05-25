import type { RouteKey } from "./types";

export type RouteConfig = {
  key: RouteKey;
  label: string;
  inDrawer: boolean;
};

export type DrawerRouteConfig = {
  id: string;
  label: string;
  routeKey?: RouteKey;
  path?: string;
  activePathPrefixes?: string[];
  iconKey: "tasks" | "stats" | "achievements" | "settings" | "routine";
};

export const MAIN_ROUTE: RouteKey = "calendar";
export const SETTINGS_PATH = "/settings";
export const ROUTINE_MANAGE_PATH = "/routine";
export const ROUTINE_CREATE_PATH = "/routine/create";
export const ROUTINE_EDIT_PATH_PREFIX = "/routine/edit/";

export const ROUTES: RouteConfig[] = [
  { key: "tasks", label: "할일 관리", inDrawer: true },
  { key: "stats", label: "통계", inDrawer: true },
  { key: "achievements", label: "업적", inDrawer: true },
  { key: "routine", label: "루틴 관리", inDrawer: true },
  { key: "settings", label: "설정", inDrawer: false },
];

export const ROUTE_LABEL: Record<RouteKey, string> = ROUTES.reduce((acc, route) => {
  acc[route.key] = route.label;
  return acc;
}, {} as Record<RouteKey, string>);

const CORE_DRAWER_ROUTES: DrawerRouteConfig[] = ROUTES.filter((route) => route.inDrawer).map((route) => ({
  id: route.key,
  label: route.label,
  routeKey: route.key,
  iconKey:
    route.key === "tasks"
      ? "tasks"
      : route.key === "stats"
        ? "stats"
        : route.key === "achievements"
          ? "achievements"
          : route.key === "routine"
            ? "routine"
            : "settings",
}));
export const DRAWER_ROUTES: DrawerRouteConfig[] = CORE_DRAWER_ROUTES;
