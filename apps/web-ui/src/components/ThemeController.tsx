import { useEffect } from "react";
import { resolveThemeName, useThemeStore } from "../stores";

export function ThemeController() {
  const themeStyle = useThemeStore((state) => state.themeStyle);
  const themeMode = useThemeStore((state) => state.themeMode);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const themeName = resolveThemeName(themeStyle, themeMode, media.matches);
      document.documentElement.setAttribute("data-theme", themeName);
    };

    applyTheme();
    const handleChange = () => applyTheme();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [themeStyle, themeMode]);

  return null;
}
