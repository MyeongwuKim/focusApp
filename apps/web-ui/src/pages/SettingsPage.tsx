import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiBell, FiCloud, FiSun } from "react-icons/fi";
import { SettingsNotificationsView } from "../features/settings/components/SettingsNotificationsView";
import { SettingsMenuItem } from "../features/settings/components/SettingsMenuItem";
import { SettingsThemeView } from "../features/settings/components/SettingsThemeView";
import { SettingsWeatherView } from "../features/settings/components/SettingsWeatherView";
import type { IconType } from "react-icons";

type SettingsSection = "home" | "theme" | "weather" | "notifications";

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
];

function resolveSettingsSection(pathname: string): SettingsSection {
  if (!pathname.startsWith("/settings")) {
    return "home";
  }

  const subPath = pathname.replace(/^\/settings\/?/, "").split("/")[0];
  if (subPath === "theme" || subPath === "weather" || subPath === "notifications") {
    return subPath;
  }
  return "home";
}

export function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const section = useMemo(() => resolveSettingsSection(location.pathname), [location.pathname]);

  const goSection = (nextSection: SettingsSection) => {
    if (nextSection === "home") {
      navigate("/settings");
      return;
    }
    navigate(`/settings/${nextSection}`);
  };

  return (
    <div key={section} className="settings-view-forward">
      {section === "home" ? (
        <section className="space-y-4 rounded-2xl border border-base-300 bg-base-200/50 p-4">
          <div className="space-y-2">
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
      {section === "notifications" ? <SettingsNotificationsView /> : null}
    </div>
  );
}
