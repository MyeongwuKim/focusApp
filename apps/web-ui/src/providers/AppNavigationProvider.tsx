import { createContext, useContext, type ReactNode } from "react";
import type { RouteKey } from "../routes/types";

export type AppNavigationActions = {
  activeRoute: RouteKey;
  openMenu: () => void;
  closeMenu: () => void;
  navigateTo: (nextRoute: RouteKey) => void;
  goMain: () => void;
  goSettings: () => void;
  goOverlayBack: () => void;
  openTasksForDate: (dateKey: string, tasks: string[]) => void;
};

const AppNavigationContext = createContext<AppNavigationActions | null>(null);

type AppNavigationProviderProps = {
  value: AppNavigationActions;
  children: ReactNode;
};

export function AppNavigationProvider({ value, children }: AppNavigationProviderProps) {
  return <AppNavigationContext.Provider value={value}>{children}</AppNavigationContext.Provider>;
}

export function useAppNavigation() {
  const context = useContext(AppNavigationContext);
  if (!context) {
    throw new Error("useAppNavigation must be used within AppNavigationProvider");
  }
  return context;
}
