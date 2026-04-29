import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import "./index.css";
import App from "./App.tsx";
import { AppErrorFallback } from "./components/AppErrorFallback";
import { ThemeController } from "./components/ThemeController";
import { queryClient } from "./queryClient";
import { initWebSentry, Sentry } from "./sentry";

const sentryEnabled = initWebSentry();
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement, sentryEnabled
  ? {
      onUncaughtError: Sentry.reactErrorHandler(),
      onCaughtError: Sentry.reactErrorHandler(),
      onRecoverableError: Sentry.reactErrorHandler(),
    }
  : undefined);

root.render(
  <QueryClientProvider client={queryClient}>
    <ThemeController />
    <Sentry.ErrorBoundary fallback={<AppErrorFallback />}>
      <HashRouter>
        <App />
      </HashRouter>
    </Sentry.ErrorBoundary>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
);
