import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type TouchEventHandler,
  type TransitionEventHandler,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type {
  AppNavigationActions,
  GoPageOptions,
  NavigateOptions,
} from "../providers/AppNavigationProvider";
import { MAIN_ROUTE, ROUTINE_MANAGE_PATH } from "../routes/route-config";
import type { RouteKey } from "../routes/types";
import { useEdgeSwipeClose } from "./useEdgeSwipeClose";

const OVERLAY_EDGE_SWIPE_START_MAX_X = 56;
const OVERLAY_EDGE_SWIPE_MIN_DISTANCE = 72;
const OVERLAY_EDGE_SWIPE_MAX_VERTICAL_DRIFT = 56;
const OVERLAY_SWIPE_AXIS_THRESHOLD = 8;
const OVERLAY_SWIPE_CLOSE_ANIMATION_MS = 320;
const OVERLAY_ENTER_ANIMATION_MS = 340;
const OVERLAY_ENTER_GUARD_MS = 720;
const OVERLAY_CAROUSEL_BACK_OFFSET_PERCENT = 16;
const OVERLAY_CAROUSEL_BACK_MIN_SCALE = 0.955;
const OVERLAY_CAROUSEL_FRONT_MIN_SCALE = 0.985;

const ROUTE_PATH: Record<RouteKey, string> = {
  calendar: "/calendar",
  tasks: "/tasks",
  dateTasks: "/date-tasks",
  stats: "/stats",
  achievements: "/achievements",
  memo: "/memo",
  settings: "/settings",
  routine: ROUTINE_MANAGE_PATH,
};

export type OverlayStackEntry = {
  stackIndex: number;
  route: RouteKey;
  pathname: string;
  search: string;
};

type UseOverlayRouteNavigationOptions = {
  openMenu: () => void;
  closeMenu: () => void;
};

type OverlayTouchHandlers = {
  onTouchStart?: TouchEventHandler<HTMLDivElement>;
  onTouchMove?: TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: TouchEventHandler<HTMLDivElement>;
  onTouchCancel?: TouchEventHandler<HTMLDivElement>;
  onTransitionEnd?: TransitionEventHandler<HTMLDivElement>;
};

function getRouteFromPath(pathname: string): RouteKey {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const matched = (Object.entries(ROUTE_PATH) as Array<[RouteKey, string]>).find(([, routePath]) => {
    return normalizedPath === routePath || normalizedPath.startsWith(`${routePath}/`);
  });
  return matched?.[0] ?? MAIN_ROUTE;
}

function isDateTasksRoutinePath(pathname: string) {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  return normalizedPath === "/date-tasks/routines" || normalizedPath === "/date-tasks/routines/new";
}

function isDateTasksMainPath(pathname: string) {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  return normalizedPath === "/date-tasks";
}

function buildRoutePath(route: RouteKey, search?: string): string {
  if (!search) {
    return ROUTE_PATH[route];
  }
  return `${ROUTE_PATH[route]}?${search}`;
}

function buildSearchFromQuery(query?: Record<string, string>) {
  if (!query) {
    return "";
  }

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    params.set(key, value);
  });
  return params.toString();
}

function buildPagePath(path: string, query?: Record<string, string>) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const search = buildSearchFromQuery(query);
  return search ? `${normalizedPath}?${search}` : normalizedPath;
}

function getHistoryStackIndex() {
  const historyState = window.history.state as { idx?: number } | null;
  return typeof historyState?.idx === "number" ? historyState.idx : 0;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isOverlaySwipeBackBlockedTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        "input",
        "textarea",
        "select",
        "button",
        "[role='button']",
        "[role='slider']",
        "[contenteditable='true']",
        "[data-disable-overlay-swipe-back='true']",
      ].join(",")
    )
  );
}

export function useOverlayRouteNavigation({ openMenu, closeMenu }: UseOverlayRouteNavigationOptions) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeRoute = getRouteFromPath(location.pathname);
  const overlayRoute = activeRoute === MAIN_ROUTE ? null : activeRoute;
  const [isOverlayEntering, setIsOverlayEntering] = useState(false);
  const onOverlaySwipeCloseRef = useRef<() => void>(() => {});
  const {
    dragX: overlayDragX,
    swipeState: overlaySwipeState,
    startClosing: startOverlayClosing,
    resetInteraction: resetOverlayInteraction,
    handleTouchStart: handleOverlayTouchStart,
    handleTouchMove: handleOverlayTouchMove,
    handleTouchEnd: handleOverlayTouchEnd,
    handleTouchCancel: handleOverlayTouchCancel,
    handleTransitionEnd: handleOverlayTransitionEnd,
  } = useEdgeSwipeClose({
    onClose: () => onOverlaySwipeCloseRef.current(),
    edgeStartMaxX: OVERLAY_EDGE_SWIPE_START_MAX_X,
    minDistance: OVERLAY_EDGE_SWIPE_MIN_DISTANCE,
    maxVerticalDrift: OVERLAY_EDGE_SWIPE_MAX_VERTICAL_DRIFT,
    axisThreshold: OVERLAY_SWIPE_AXIS_THRESHOLD,
    closeAnimationMs: OVERLAY_SWIPE_CLOSE_ANIMATION_MS,
  });
  const overlayEnterAnimationTimeoutRef = useRef<number | null>(null);
  const [overlayStackEntriesByIdx, setOverlayStackEntriesByIdx] = useState(
    () => new Map<number, OverlayStackEntry>()
  );
  const overlayLastStackIndexRef = useRef<number | null>(null);
  const lastOverlayEnterRef = useRef<{ path: string; at: number } | null>(null);
  const lastOverlayNavigationRef = useRef<{ path: string; at: number } | null>(null);

  const goPage = useCallback(
    (path: string, options?: GoPageOptions) => {
      const nextPath = buildPagePath(path, options?.query);
      const currentPath = `${location.pathname}${location.search}`;
      const liveCurrentPath =
        typeof window === "undefined" ? currentPath : `${window.location.pathname}${window.location.search}`;
      const now = Date.now();
      const isDuplicateRapidNavigation =
        lastOverlayNavigationRef.current?.path === nextPath &&
        now - lastOverlayNavigationRef.current.at < OVERLAY_ENTER_ANIMATION_MS;

      if (currentPath === nextPath || liveCurrentPath === nextPath || isDuplicateRapidNavigation) {
        closeMenu();
        return;
      }

      lastOverlayNavigationRef.current = {
        path: nextPath,
        at: now,
      };
      navigate(nextPath, {
        state: options?.state,
        replace: options?.replace,
      });
      closeMenu();
    },
    [closeMenu, location.pathname, location.search, navigate]
  );

  const navigateTo = useCallback(
    (nextRoute: RouteKey, options?: NavigateOptions) => {
      if (activeRoute === nextRoute) {
        closeMenu();
        return;
      }

      const replace = options?.replace ?? false;
      goPage(buildRoutePath(nextRoute), {
        ...options,
        replace,
      });
    },
    [activeRoute, closeMenu, goPage]
  );

  const performGoBackNavigation = useCallback(() => {
    const stackIndex = getHistoryStackIndex();

    if (stackIndex > 0) {
      navigate(-1);
      return;
    }

    goPage(ROUTE_PATH[MAIN_ROUTE], { replace: true });
    closeMenu();
  }, [closeMenu, goPage, navigate]);

  const goBack = useCallback(
    (options?: { animated?: boolean }) => {
      const prefersAnimatedBack = options?.animated ?? true;
      const stackIndex = getHistoryStackIndex();
      const previousEntry = stackIndex > 0 ? overlayStackEntriesByIdx.get(stackIndex - 1) ?? null : null;
      const previousRoute = previousEntry?.route ?? null;
      const isInternalBackWithinSameOverlay = previousRoute !== null && previousRoute === overlayRoute;
      const shouldAnimate = prefersAnimatedBack && overlayRoute !== null && !isInternalBackWithinSameOverlay;

      if (!shouldAnimate) {
        performGoBackNavigation();
        return;
      }

      if (overlaySwipeState === "closing") {
        return;
      }

      startOverlayClosing();
    },
    [overlayRoute, overlayStackEntriesByIdx, overlaySwipeState, performGoBackNavigation, startOverlayClosing]
  );

  const handleOverlaySwipeClose = useCallback(() => {
    performGoBackNavigation();
    resetOverlayInteraction();
  }, [performGoBackNavigation, resetOverlayInteraction]);

  useEffect(() => {
    onOverlaySwipeCloseRef.current = handleOverlaySwipeClose;
  }, [handleOverlaySwipeClose]);

  useEffect(() => {
    const stackIndex = getHistoryStackIndex();
    const nextEntry: OverlayStackEntry = {
      stackIndex,
      route: activeRoute,
      pathname: location.pathname,
      search: location.search,
    };
    setOverlayStackEntriesByIdx((previousEntries) => {
      const previousEntry = previousEntries.get(stackIndex);
      if (
        previousEntry?.route === nextEntry.route &&
        previousEntry.pathname === nextEntry.pathname &&
        previousEntry.search === nextEntry.search
      ) {
        return previousEntries;
      }

      const nextEntries = new Map(previousEntries);
      nextEntries.set(stackIndex, nextEntry);
      return nextEntries;
    });
  }, [activeRoute, location.pathname, location.search]);

  useLayoutEffect(() => {
    resetOverlayInteraction();
    const stackIndex = getHistoryStackIndex();
    const previousStackIndex = overlayLastStackIndexRef.current;
    overlayLastStackIndexRef.current = stackIndex;
    const shouldAnimateOverlayEnterCandidate =
      Boolean(overlayRoute) && (previousStackIndex === null || stackIndex > previousStackIndex);
    const nextOverlayPath = `${location.pathname}${location.search}`;
    const now = Date.now();
    const shouldSuppressDuplicateEnter =
      shouldAnimateOverlayEnterCandidate &&
      lastOverlayEnterRef.current?.path === nextOverlayPath &&
      now - lastOverlayEnterRef.current.at < OVERLAY_ENTER_GUARD_MS;
    const shouldAnimateOverlayEnter = shouldAnimateOverlayEnterCandidate && !shouldSuppressDuplicateEnter;
    if (shouldAnimateOverlayEnter) {
      lastOverlayEnterRef.current = {
        path: nextOverlayPath,
        at: now,
      };
    }
    setIsOverlayEntering(shouldAnimateOverlayEnter);

    if (overlayEnterAnimationTimeoutRef.current !== null) {
      window.clearTimeout(overlayEnterAnimationTimeoutRef.current);
      overlayEnterAnimationTimeoutRef.current = null;
    }

    if (overlayRoute && shouldAnimateOverlayEnter) {
      overlayEnterAnimationTimeoutRef.current = window.setTimeout(() => {
        overlayEnterAnimationTimeoutRef.current = null;
        setIsOverlayEntering(false);
      }, OVERLAY_ENTER_ANIMATION_MS);
    }
  }, [location.pathname, location.search, overlayRoute, resetOverlayInteraction]);

  useEffect(() => {
    return () => {
      if (overlayEnterAnimationTimeoutRef.current !== null) {
        window.clearTimeout(overlayEnterAnimationTimeoutRef.current);
      }
    };
  }, []);

  const navigationActions = useMemo<AppNavigationActions>(
    () => ({
      activeRoute,
      openMenu,
      closeMenu,
      goPage,
      goBack,
      navigateTo,
      goMain: () => navigateTo(MAIN_ROUTE),
      goSettings: () => navigateTo("settings"),
    }),
    [activeRoute, closeMenu, goBack, goPage, navigateTo, openMenu]
  );

  const overlayCurrentStackIndex = getHistoryStackIndex();
  const overlayCurrentEntryCandidate = overlayStackEntriesByIdx.get(overlayCurrentStackIndex) ?? null;
  const hasCurrentEntryLocationMismatch = Boolean(
    overlayCurrentEntryCandidate &&
      (overlayCurrentEntryCandidate.pathname !== location.pathname ||
        overlayCurrentEntryCandidate.search !== location.search)
  );
  const overlayCurrentEntry =
    overlayRoute === null
      ? null
      : !hasCurrentEntryLocationMismatch && overlayCurrentEntryCandidate
        ? overlayCurrentEntryCandidate
        : {
            stackIndex: overlayCurrentStackIndex,
            route: overlayRoute,
            pathname: location.pathname,
            search: location.search,
          };
  const overlayPreviousEntryCandidate =
    overlayCurrentEntry && overlayCurrentStackIndex > 0
      ? overlayStackEntriesByIdx.get(overlayCurrentStackIndex - 1) ?? null
      : null;
  const overlayPreviousEntry =
    overlayPreviousEntryCandidate && overlayPreviousEntryCandidate.route !== MAIN_ROUTE
      ? overlayPreviousEntryCandidate
      : null;
  const overlayRenderEntries = overlayCurrentEntry
    ? [overlayPreviousEntry, overlayCurrentEntry].filter(
        (entry): entry is OverlayStackEntry => entry !== null
      )
    : [];
  const previousStackEntryForBackdrop =
    overlayCurrentStackIndex > 0
      ? overlayStackEntriesByIdx.get(overlayCurrentStackIndex - 1) ?? null
      : null;
  const shouldRevealCalendarDateSheetBackdrop =
    overlayRoute === "dateTasks" &&
    isDateTasksRoutinePath(location.pathname) &&
    previousStackEntryForBackdrop?.route === MAIN_ROUTE &&
    overlayDragX > 0 &&
    (overlaySwipeState === "dragging" || overlaySwipeState === "settling" || overlaySwipeState === "closing");
  const shouldShowOverlaySwipePreview =
    overlayPreviousEntry !== null &&
    overlayDragX > 0 &&
    (overlaySwipeState === "dragging" || overlaySwipeState === "settling" || overlaySwipeState === "closing");
  const overlayViewportWidth = typeof window === "undefined" ? 390 : Math.max(window.innerWidth || 390, 1);
  const overlaySwipeProgress = clampNumber(overlayDragX / overlayViewportWidth, 0, 1);
  const overlayBackTranslatePercent = (1 - overlaySwipeProgress) * OVERLAY_CAROUSEL_BACK_OFFSET_PERCENT;
  const overlayBackScale =
    OVERLAY_CAROUSEL_BACK_MIN_SCALE + (1 - OVERLAY_CAROUSEL_BACK_MIN_SCALE) * overlaySwipeProgress;
  const overlayBackOpacity = 0.76 + overlaySwipeProgress * 0.24;
  const overlayFrontScale = 1 - (1 - OVERLAY_CAROUSEL_FRONT_MIN_SCALE) * overlaySwipeProgress;
  const overlayFrontOpacity = Math.max(1 - overlaySwipeProgress * 0.2, 0.8);

  const getOverlayEntryStyle = useCallback(
    (isActiveEntry: boolean): CSSProperties | undefined => {
      if (isActiveEntry) {
        if (overlaySwipeState === "idle") {
          return undefined;
        }

        return {
          transform: `translateX(${overlayDragX}px) scale(${overlayFrontScale})`,
          transformOrigin: "left center",
          opacity: overlayFrontOpacity,
          boxShadow: "0 0 0 1px rgba(148, 163, 184, 0.12), -24px 0 42px rgba(2, 6, 23, 0.18)",
          transition:
            overlaySwipeState === "dragging"
              ? "none"
              : "transform 320ms cubic-bezier(0.22,1,0.36,1), opacity 260ms ease",
        };
      }

      return {
        transform: `translateX(-${overlayBackTranslatePercent}%) scale(${overlayBackScale})`,
        transformOrigin: "left center",
        opacity: shouldShowOverlaySwipePreview ? overlayBackOpacity : 0,
        transition:
          overlaySwipeState === "dragging"
            ? "none"
            : "transform 320ms cubic-bezier(0.22,1,0.36,1), opacity 260ms ease",
      };
    },
    [
      overlayBackOpacity,
      overlayBackScale,
      overlayBackTranslatePercent,
      overlayDragX,
      overlayFrontOpacity,
      overlayFrontScale,
      overlaySwipeState,
      shouldShowOverlaySwipePreview,
    ]
  );

  const getOverlayTouchHandlers = useCallback(
    (entry: OverlayStackEntry, isActiveEntry: boolean): OverlayTouchHandlers => {
      if (!isActiveEntry) {
        return {};
      }

      return {
        onTouchStart: (event) => {
          const touch = event.touches[0];
          handleOverlayTouchStart(event, {
            canSwipeBack:
              touch.clientX <= OVERLAY_EDGE_SWIPE_START_MAX_X &&
              !isOverlaySwipeBackBlockedTarget(event.target) &&
              !(entry.route === "dateTasks" && isDateTasksMainPath(entry.pathname)),
            onEdgeTouchStart: () => setIsOverlayEntering(false),
          });
        },
        onTouchMove: handleOverlayTouchMove,
        onTouchEnd: handleOverlayTouchEnd,
        onTouchCancel: () => handleOverlayTouchCancel(),
        onTransitionEnd: handleOverlayTransitionEnd,
      };
    },
    [
      handleOverlayTouchCancel,
      handleOverlayTouchEnd,
      handleOverlayTouchMove,
      handleOverlayTouchStart,
      handleOverlayTransitionEnd,
    ]
  );

  return {
    activeRoute,
    locationPathname: location.pathname,
    locationSearch: location.search,
    mainRoutePath: ROUTE_PATH[MAIN_ROUTE],
    navigationActions,
    overlayRoute,
    overlayCurrentEntry,
    overlayRenderEntries,
    overlaySwipeState,
    isOverlayEntering,
    shouldRevealCalendarDateSheetBackdrop,
    getOverlayEntryStyle,
    getOverlayTouchHandlers,
  };
}
