import { QueryClientProvider } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { AppNavigationProvider, type AppNavigationActions } from "../../providers/AppNavigationProvider";
import { queryClient } from "../../queryClient";
import type { RouteKey } from "../../routes/types";

type PageStoryProvidersProps = {
  children: ReactNode;
  initialEntry: string;
  activeRoute: RouteKey;
  navigationOverrides?: Partial<AppNavigationActions>;
};

export function PageStoryProviders({
  children,
  initialEntry,
  activeRoute,
  navigationOverrides,
}: PageStoryProvidersProps) {
  const navigation = useMemo<AppNavigationActions>(
    () => ({
      activeRoute,
      openMenu: () => {},
      closeMenu: () => {},
      goPage: () => {},
      goBack: () => {},
      navigateTo: () => {},
      goMain: () => {},
      goSettings: () => {},
      ...navigationOverrides,
    }),
    [activeRoute, navigationOverrides]
  );

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppNavigationProvider value={navigation}>
          <div className="relative flex h-[78dvh] min-h-[36rem] max-h-[52rem] min-w-0 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </div>
        </AppNavigationProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
