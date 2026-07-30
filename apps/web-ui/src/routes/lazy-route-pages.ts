import { lazy } from "react";

const loadSettingsPage = () => import("../pages/SettingsPage");
const loadRoutineRoutePage = () => import("../pages/RoutineRoutePage");
const loadTaskManagementRoutePage = () => import("../pages/TaskManagementRoutePage");
const loadStatsRoutePage = () => import("../pages/StatsRoutePage");
const loadAchievementsRoutePage = () => import("../pages/AchievementsRoutePage");
const loadMemoArchiveRoutePage = () => import("../pages/MemoArchiveRoutePage");

export const LazySettingsPage = lazy(() =>
  loadSettingsPage().then((module) => ({ default: module.SettingsPage }))
);

export const LazyRoutineRoutePage = lazy(() =>
  loadRoutineRoutePage().then((module) => ({ default: module.RoutineRoutePage }))
);

export const LazyTaskManagementRoutePage = lazy(() =>
  loadTaskManagementRoutePage().then((module) => ({
    default: module.TaskManagementRoutePage,
  }))
);

export const LazyStatsRoutePage = lazy(() =>
  loadStatsRoutePage().then((module) => ({ default: module.StatsRoutePage }))
);

export const LazyAchievementsRoutePage = lazy(() =>
  loadAchievementsRoutePage().then((module) => ({
    default: module.AchievementsRoutePage,
  }))
);

export const LazyMemoArchiveRoutePage = lazy(() =>
  loadMemoArchiveRoutePage().then((module) => ({
    default: module.MemoArchiveRoutePage,
  }))
);

export function preloadSecondaryRoutePages() {
  return Promise.allSettled([
    loadSettingsPage(),
    loadRoutineRoutePage(),
    loadTaskManagementRoutePage(),
    loadStatsRoutePage(),
    loadAchievementsRoutePage(),
    loadMemoArchiveRoutePage(),
  ]);
}
