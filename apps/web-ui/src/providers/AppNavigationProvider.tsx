import { createContext, useContext, type ReactNode } from "react";
import type { RouteKey } from "../routes/types";

export type NavigateOptions = {
  query?: Record<string, string>;
  state?: unknown;
  replace?: boolean;
};

export type GoPageOptions = {
  query?: Record<string, string>;
  state?: unknown;
  replace?: boolean;
};

export type AppNavigationActions = {
  activeRoute: RouteKey;
  openMenu: () => void;
  closeMenu: () => void;
  goPage: (path: string, options?: GoPageOptions) => void;
  goBack: (options?: { animated?: boolean }) => void;
  navigateTo: (nextRoute: RouteKey, options?: NavigateOptions) => void;
  goMain: () => void;
  goSettings: () => void;
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
