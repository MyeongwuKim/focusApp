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
  iconKey: "today" | "calendar" | "tasks" | "stats" | "memo" | "settings" | "routine";
};

export const MAIN_ROUTE: RouteKey = "dateTasks";
export const CALENDAR_DATE_TASKS_PATH = "/date-tasks/calendar";
export const SETTINGS_PATH = "/settings";
export const ROUTINE_MANAGE_PATH = "/routine";
export const ROUTINE_CREATE_PATH = "/routine/create";
export const ROUTINE_EDIT_PATH_PREFIX = "/routine/edit/";

export const ROUTES: RouteConfig[] = [
  { key: "dateTasks", label: "오늘 할 일", inDrawer: true },
  { key: "calendar", label: "캘린더", inDrawer: true },
  { key: "tasks", label: "할일 관리", inDrawer: true },
  { key: "stats", label: "통계", inDrawer: true },
  { key: "memo", label: "메모", inDrawer: true },
  { key: "routine", label: "할 일 묶음", inDrawer: true },
  { key: "settings", label: "설정", inDrawer: true },
];

export const ROUTE_LABEL: Record<RouteKey, string> = ROUTES.reduce((acc, route) => {
  acc[route.key] = route.label;
  return acc;
}, {} as Record<RouteKey, string>);

const ROUTE_ICON_KEY: Record<RouteKey, DrawerRouteConfig["iconKey"]> = {
  dateTasks: "today",
  calendar: "calendar",
  tasks: "tasks",
  stats: "stats",
  memo: "memo",
  routine: "routine",
  settings: "settings",
};

const CORE_DRAWER_ROUTES: DrawerRouteConfig[] = ROUTES.filter((route) => route.inDrawer).map((route) => ({
  id: route.key,
  label: route.label,
  routeKey: route.key,
  path: route.key === MAIN_ROUTE ? "/date-tasks" : undefined,
  iconKey: ROUTE_ICON_KEY[route.key],
}));
export const DRAWER_ROUTES: DrawerRouteConfig[] = CORE_DRAWER_ROUTES;
