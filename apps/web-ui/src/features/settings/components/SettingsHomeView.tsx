import { FiBell, FiCloud, FiSun } from "react-icons/fi";
import type { IconType } from "react-icons";
import type { SettingsSection } from "../types";
import { SettingsMenuItem } from "./SettingsMenuItem";

type SettingsHomeViewProps = {
  onNavigate: (nextSection: Exclude<SettingsSection, "home">) => void;
};

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

export function SettingsHomeView({ onNavigate }: SettingsHomeViewProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-base-300 bg-base-200/50 p-4">
      <div className="space-y-2">
        {SETTINGS_MENUS.map((menu) => (
          <SettingsMenuItem
            key={menu.key}
            icon={menu.icon}
            title={menu.title}
            description={menu.description}
            onClick={() => onNavigate(menu.key)}
          />
        ))}
      </div>
    </section>
  );
}
