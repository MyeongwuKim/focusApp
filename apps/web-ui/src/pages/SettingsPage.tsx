import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { FiBell, FiCloud, FiSun, FiUser } from "react-icons/fi";
import { SettingsNotificationsView } from "../features/settings/components/SettingsNotificationsView";
import { SettingsMenuItem } from "../features/settings/components/SettingsMenuItem";
import { SettingsThemeView } from "../features/settings/components/SettingsThemeView";
import { SettingsWeatherView } from "../features/settings/components/SettingsWeatherView";
import { SettingsAccountView } from "../features/settings/components/SettingsAccountView";
import { SettingsRoutineView } from "../features/settings/components/SettingsRoutineView";
import type { IconType } from "react-icons";
import { useAppNavigation } from "../providers/AppNavigationProvider";
import { ROUTINE_EDIT_PATH_PREFIX, ROUTINE_MANAGE_PATH } from "../routes/route-config";

type SettingsSection = "home" | "theme" | "weather" | "routine" | "notifications" | "account";

type SettingsMenu = {
  key: Exclude<SettingsSection, "home">;
  icon: IconType;
  title: string;
  description: string;
};

const SETTINGS_MENUS: SettingsMenu[] = [
  {
    key: "theme",
    icon: FiSun,
    title: "테마",
    description: "스타일과 라이트/다크 모드",
  },
  {
    key: "weather",
    icon: FiCloud,
    title: "날씨",
    description: "표시 여부와 무드 선택",
  },
  {
    key: "notifications",
    icon: FiBell,
    title: "알림",
    description: "푸시 알림/리마인더 옵션",
  },
  {
    key: "account",
    icon: FiUser,
    title: "계정",
    description: "로그인 정보와 계정 관리",
  },
];

function resolveSettingsSection(pathname: string): SettingsSection {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  if (normalizedPath === ROUTINE_MANAGE_PATH || normalizedPath.startsWith(`${ROUTINE_MANAGE_PATH}/`)) {
    return "routine";
  }
  if (normalizedPath.startsWith(ROUTINE_EDIT_PATH_PREFIX)) {
    return "routine";
  }

  if (!pathname.startsWith("/settings")) {
    return "home";
  }

  const subPath = pathname.replace(/^\/settings\/?/, "").split("/")[0];
  if (
    subPath === "theme" ||
    subPath === "weather" ||
    subPath === "routine" ||
    subPath === "notifications" ||
    subPath === "account"
  ) {
    return subPath;
  }
  return "home";
}

type SettingsPageProps = {
  forcedPathname?: string;
};

export function SettingsPage({ forcedPathname }: SettingsPageProps) {
  const location = useLocation();
  const { goPage } = useAppNavigation();
  const pathname = forcedPathname ?? location.pathname;
  const section = useMemo(() => resolveSettingsSection(pathname), [pathname]);
  const isRoutineSection = section === "routine";

  const goSection = (nextSection: SettingsSection) => {
    if (nextSection === "home") {
      goPage("/settings");
      return;
    }
    goPage(`/settings/${nextSection}`);
  };

  return (
    <div
      className={
        isRoutineSection
          ? "min-h-0 h-full overflow-hidden px-0.5 pt-1 pb-0"
          : "min-h-0 h-full overflow-y-auto px-0.5 pt-1 pb-2"
      }
    >
      {section === "home" ? (
        <section className="space-y-5 rounded-2xl border border-base-300 bg-base-200/50 p-4">
          <div className="space-y-2.5">
            {SETTINGS_MENUS.map((menu) => (
              <SettingsMenuItem
                key={menu.key}
                icon={menu.icon}
                title={menu.title}
                description={menu.description}
                onClick={() => goSection(menu.key)}
              />
            ))}
          </div>
        </section>
      ) : null}
      {section === "theme" ? <SettingsThemeView /> : null}
      {section === "weather" ? <SettingsWeatherView /> : null}
      {section === "routine" ? <SettingsRoutineView forcedPathname={pathname} /> : null}
      {section === "notifications" ? <SettingsNotificationsView /> : null}
      {section === "account" ? <SettingsAccountView /> : null}
    </div>
  );
}
