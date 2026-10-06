import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { FiBell, FiCloud, FiUser } from "react-icons/fi";
import { SettingsNotificationsView } from "../features/settings/components/SettingsNotificationsView";
import { SettingsMenuItem } from "../features/settings/components/SettingsMenuItem";
import { SettingsWeatherView } from "../features/settings/components/SettingsWeatherView";
import { SettingsAccountView } from "../features/settings/components/SettingsAccountView";
import type { IconType } from "react-icons";
import { useAppNavigation } from "../providers/AppNavigationProvider";

type SettingsSection = "home" | "weather" | "notifications" | "account";

type SettingsMenu = {
  key: Exclude<SettingsSection, "home">;
  icon: IconType;
  title: string;
  description: string;
};

const SETTINGS_MENUS: SettingsMenu[] = [
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
  if (!pathname.startsWith("/settings")) {
    return "home";
  }

  const subPath = pathname.replace(/^\/settings\/?/, "").split("/")[0];
  if (
    subPath === "weather" ||
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

  const goSection = (nextSection: SettingsSection) => {
    if (nextSection === "home") {
      goPage("/settings");
      return;
    }
    goPage(`/settings/${nextSection}`);
  };

  return (
    <div className="sketchbook-settings-page min-h-0 h-full overflow-y-auto px-0.5 pt-1 pb-2">
      {section === "home" ? (
        <section className="sketchbook-settings-home space-y-5 rounded-2xl border border-base-300 bg-base-200/50 p-4">
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
      {section === "weather" ? <SettingsWeatherView /> : null}
      {section === "notifications" ? <SettingsNotificationsView /> : null}
      {section === "account" ? <SettingsAccountView /> : null}
    </div>
  );
}
