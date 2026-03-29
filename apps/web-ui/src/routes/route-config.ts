import type { RouteKey } from "./types";

export type RouteConfig = {
  key: RouteKey;
  label: string;
  inDrawer: boolean;
};

export const MAIN_ROUTE: RouteKey = "calendar";

export const ROUTES: RouteConfig[] = [
  { key: "calendar", label: "캘린더", inDrawer: false },
  { key: "tasks", label: "할일 관리", inDrawer: true },
  { key: "memo", label: "메모", inDrawer: false },
  { key: "stats", label: "통계", inDrawer: true },
  { key: "settings", label: "설정", inDrawer: true },
];

export const ROUTE_LABEL: Record<RouteKey, string> = ROUTES.reduce((acc, route) => {
  acc[route.key] = route.label;
  return acc;
}, {} as Record<RouteKey, string>);

export const DRAWER_ROUTES = ROUTES.filter((route) => route.inDrawer);
