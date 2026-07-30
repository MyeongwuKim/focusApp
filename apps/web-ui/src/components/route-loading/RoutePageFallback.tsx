import type { RouteKey } from "../../routes/types";

type RoutePageFallbackProps = {
  route: RouteKey;
  forcedPathname?: string;
};

type SkeletonBlockProps = {
  className: string;
};

function SkeletonBlock({ className }: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-lg border border-base-300/65 bg-base-200/55 ${className}`}
    />
  );
}

function LoadingStatus({ label }: { label: string }) {
  return <span className="sr-only">{label} 화면 불러오는 중</span>;
}

function SettingsRouteFallback({ pathname = "/settings" }: { pathname?: string }) {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const isHome = normalizedPathname === "/settings";
  const detailCardCount =
    normalizedPathname === "/settings/weather"
      ? 5
      : normalizedPathname === "/settings/theme"
        ? 3
        : 1;

  return (
    <div
      className="min-h-0 h-full overflow-y-auto px-0.5 pt-1 pb-2"
      data-route-fallback="settings"
      role="status"
      aria-busy="true"
    >
      <LoadingStatus label="설정" />
      {isHome ? (
        <section className="space-y-5 rounded-2xl border border-base-300 bg-base-200/50 p-4">
          <div className="space-y-2.5">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="flex h-[61px] items-center gap-3 rounded-xl border border-base-300/80 bg-base-100/75 px-3 py-3.5"
              >
                <SkeletonBlock className="h-8 w-8 shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <SkeletonBlock className="h-3.5 w-20 border-0" />
                  <SkeletonBlock className="h-2.5 w-36 max-w-full border-0" />
                </div>
                <SkeletonBlock className="h-4 w-4 shrink-0 border-0" />
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-1 rounded-2xl border border-base-300 bg-base-200/50 p-4">
          <SkeletonBlock className="h-5 w-52 max-w-full border-0" />
          <div className="mt-6 space-y-5">
            {Array.from({ length: detailCardCount }, (_, index) => (
              <div
                key={index}
                className={[
                  "rounded-xl border border-base-300/80 bg-base-100/75 p-3",
                  normalizedPathname === "/settings/notifications" ? "h-32" : "h-24",
                ].join(" ")}
              >
                <SkeletonBlock className="h-3.5 w-24 border-0" />
                <SkeletonBlock className="mt-4 h-9 w-full border-0" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RoutineRouteFallback({ pathname = "/routines" }: { pathname?: string }) {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const isEditorRoute =
    normalizedPathname === "/routines/new" || normalizedPathname.startsWith("/routines/edit/");

  return (
    <div
      className="min-h-0 h-full overflow-hidden px-0.5 pt-1 pb-0"
      data-route-fallback="routine"
      role="status"
      aria-busy="true"
    >
      <LoadingStatus label="루틴" />
      <section className="flex h-full min-h-0 flex-col rounded-2xl border border-base-300 bg-base-200/50 px-1.5 pt-1.5 pb-0">
        {isEditorRoute ? (
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-base-300/80 bg-base-100/75 p-3">
            <SkeletonBlock className="h-10 w-full" />
            <div className="mt-3 min-h-0 space-y-2">
              <SkeletonBlock className="h-16 w-full" />
              <SkeletonBlock className="h-16 w-full" />
              <SkeletonBlock className="h-16 w-full" />
            </div>
            <SkeletonBlock className="mt-3 h-10 w-full" />
          </div>
        ) : (
          <>
            <div className="grid h-8 shrink-0 grid-cols-2 gap-2">
              <SkeletonBlock className="h-8 w-full" />
              <SkeletonBlock className="h-8 w-full" />
            </div>
            <div className="mt-3 min-h-0 flex-1">
              <section className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_3.5rem] overflow-hidden rounded-xl border border-base-300/80 bg-base-100/75 p-2">
                <div className="flex min-h-0 flex-col gap-2">
                  <SkeletonBlock className="h-10 w-full shrink-0" />
                  <div className="grid min-h-0 flex-1 grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
                    <div className="space-y-2 rounded-lg border border-base-300/65 bg-base-200/30 p-2">
                      <SkeletonBlock className="h-12 w-full" />
                      <SkeletonBlock className="h-12 w-full" />
                      <SkeletonBlock className="h-12 w-full" />
                    </div>
                    <div className="space-y-2 rounded-lg border border-base-300/65 bg-base-200/30 p-2">
                      <SkeletonBlock className="h-16 w-full" />
                      <SkeletonBlock className="h-16 w-full" />
                    </div>
                  </div>
                </div>
                <SkeletonBlock className="mt-2 h-11 w-full" />
              </section>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function TaskStatsRouteFallback() {
  return (
    <section
      className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-base-300 bg-base-100/80 p-4 md:p-5"
      data-route-fallback="task-stats"
      role="status"
      aria-busy="true"
    >
      <LoadingStatus label="할 일 통계" />
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2">
          <SkeletonBlock className="h-9 w-full" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <SkeletonBlock className="h-20 w-full" />
          <SkeletonBlock className="h-20 w-full" />
          <SkeletonBlock className="h-20 w-full" />
        </div>
        <div className="rounded-xl border border-base-300/80 bg-base-200/40 p-3">
          <SkeletonBlock className="h-4 w-28 border-0" />
          <div className="mt-2 space-y-2">
            <SkeletonBlock className="h-20 w-full" />
            <SkeletonBlock className="h-20 w-full" />
            <SkeletonBlock className="h-20 w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}

function TaskManagementRouteFallback({ pathname = "/tasks" }: { pathname?: string }) {
  if (pathname.replace(/\/+$/, "") === "/tasks/stats") {
    return <TaskStatsRouteFallback />;
  }

  return (
    <div
      className="relative min-h-0 flex-1 overflow-hidden"
      data-route-fallback="tasks"
      role="status"
      aria-busy="true"
    >
      <LoadingStatus label="할 일 관리" />
      <div className="absolute inset-0">
        <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-200/40 p-4">
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_136px] gap-2">
            <div className="space-y-1.5 rounded-xl border border-base-300/75 bg-base-200/35 p-2">
              <SkeletonBlock className="h-14 w-full" />
              <SkeletonBlock className="h-14 w-full" />
              <SkeletonBlock className="h-14 w-full" />
              <SkeletonBlock className="h-14 w-full" />
            </div>
            <aside className="space-y-1.5 rounded-xl border border-base-300/75 bg-base-200/35 p-2">
              <SkeletonBlock className="h-12 w-full" />
              <SkeletonBlock className="h-12 w-full" />
              <SkeletonBlock className="h-12 w-full" />
            </aside>
          </div>
          <div className="mt-3 shrink-0 space-y-2 border-t border-base-300/65 pt-2.5">
            <div className="flex justify-end gap-2">
              <SkeletonBlock className="h-10 w-16 rounded-full" />
              <SkeletonBlock className="h-10 w-20 rounded-full" />
              <SkeletonBlock className="h-10 w-16 rounded-full" />
            </div>
            <SkeletonBlock className="h-[61px] w-full rounded-xl" />
          </div>
        </section>
      </div>
    </div>
  );
}

function StatsRouteFallback() {
  return (
    <section
      className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-base-300 bg-base-100/80 p-4 md:p-5"
      data-route-fallback="stats"
      role="status"
      aria-busy="true"
    >
      <LoadingStatus label="통계" />
      <div className="space-y-5">
        <SkeletonBlock className="h-10 w-full" />
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <SkeletonBlock className="h-20 w-full" />
          <SkeletonBlock className="h-20 w-full" />
          <SkeletonBlock className="h-20 w-full" />
        </div>
        <SkeletonBlock className="h-32 w-full rounded-xl" />
        <SkeletonBlock className="h-72 w-full rounded-xl" />
        <SkeletonBlock className="h-72 w-full rounded-xl" />
      </div>
    </section>
  );
}

function AchievementsRouteFallback() {
  return (
    <section
      className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-base-300 bg-base-100/80 p-4 md:p-5"
      data-route-fallback="achievements"
      role="status"
      aria-busy="true"
    >
      <LoadingStatus label="업적" />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-base-300/80 bg-base-200/35 p-1">
          <SkeletonBlock className="h-8 w-full" />
          <SkeletonBlock className="h-8 w-full" />
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <SkeletonBlock className="h-20 w-full" />
          <SkeletonBlock className="h-20 w-full" />
          <SkeletonBlock className="h-20 w-full" />
          <SkeletonBlock className="h-20 w-full" />
        </div>
        <SkeletonBlock className="h-40 w-full rounded-xl" />
        <div className="flex gap-1.5">
          <SkeletonBlock className="h-7 w-12 rounded-full" />
          <SkeletonBlock className="h-7 w-12 rounded-full" />
          <SkeletonBlock className="h-7 w-12 rounded-full" />
          <SkeletonBlock className="h-7 w-12 rounded-full" />
        </div>
        <SkeletonBlock className="h-28 w-full rounded-xl" />
        <SkeletonBlock className="h-28 w-full rounded-xl" />
      </div>
    </section>
  );
}

function MemoRouteFallback() {
  return (
    <section
      className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-base-300 bg-base-100/80 p-4"
      data-route-fallback="memo"
      role="status"
      aria-busy="true"
    >
      <LoadingStatus label="메모" />
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 space-y-3">
          <SkeletonBlock className="h-[49px] w-full rounded-xl" />
          <SkeletonBlock className="h-10 w-full rounded-xl" />
          <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-1.5">
            <SkeletonBlock className="h-9 w-full rounded-xl" />
            <SkeletonBlock className="h-9 w-full rounded-xl" />
          </div>
        </div>
        <div className="mt-3 min-h-0 flex-1 space-y-2.5 overflow-hidden">
          <SkeletonBlock className="h-24 w-full rounded-xl" />
          <SkeletonBlock className="h-24 w-full rounded-xl" />
          <SkeletonBlock className="h-24 w-full rounded-xl" />
        </div>
      </div>
    </section>
  );
}

export function RoutePageFallback({ route, forcedPathname }: RoutePageFallbackProps) {
  switch (route) {
    case "settings":
      return <SettingsRouteFallback pathname={forcedPathname} />;
    case "routine":
      return <RoutineRouteFallback pathname={forcedPathname} />;
    case "tasks":
      return <TaskManagementRouteFallback pathname={forcedPathname} />;
    case "stats":
      return <StatsRouteFallback />;
    case "achievements":
      return <AchievementsRouteFallback />;
    case "memo":
      return <MemoRouteFallback />;
    case "dateTasks":
    case "calendar":
      return null;
    default: {
      const exhaustiveRoute: never = route;
      return exhaustiveRoute;
    }
  }
}
