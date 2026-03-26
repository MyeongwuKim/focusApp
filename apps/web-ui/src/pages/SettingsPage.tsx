import { useState } from "react";
import { SettingsHomeView } from "./settings/SettingsHomeView";
import { SettingsNotificationsView } from "./settings/SettingsNotificationsView";
import { SettingsThemeView } from "./settings/SettingsThemeView";
import { SettingsWeatherView } from "./settings/SettingsWeatherView";
import type { SettingsSection } from "./settings/types";

type TransitionDirection = "forward" | "backward";

export function SettingsPage() {
  const [section, setSection] = useState<SettingsSection>("home");
  const [direction, setDirection] = useState<TransitionDirection>("forward");

  const goSection = (nextSection: Exclude<SettingsSection, "home">) => {
    setDirection("forward");
    setSection(nextSection);
  };

  const goHome = () => {
    setDirection("backward");
    setSection("home");
  };

  const motionClass =
    direction === "forward" ? "settings-view-forward" : "settings-view-backward";

  return (
    <div key={`${section}-${direction}`} className={motionClass}>
      {section === "home" ? <SettingsHomeView onNavigate={goSection} /> : null}
      {section === "theme" ? <SettingsThemeView onBack={goHome} /> : null}
      {section === "weather" ? <SettingsWeatherView onBack={goHome} /> : null}
      {section === "notifications" ? <SettingsNotificationsView onBack={goHome} /> : null}
    </div>
  );
}

