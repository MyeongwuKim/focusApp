import { create } from "zustand";
import { persist } from "zustand/middleware";

export const THEME_STYLES = ["dreamy", "cinematic", "neon", "paper", "nordic", "sunset"] as const;
export type ThemeStyle = (typeof THEME_STYLES)[number];
export type ThemeMode = "system" | "light" | "dark";

export const THEME_STYLE_LABEL: Record<ThemeStyle, string> = {
  dreamy: "Dreamy",
  cinematic: "Cinematic",
  neon: "Neon",
  paper: "Paper",
  nordic: "Nordic",
  sunset: "Sunset",
};

const themeNameMap: Record<ThemeStyle, { light: string; dark: string }> = {
  dreamy: { light: "cupcake", dark: "synthwave" },
  cinematic: { light: "lofi", dark: "coffee" },
  neon: { light: "light", dark: "dracula" },
  paper: { light: "retro", dark: "night" },
  nordic: { light: "nord", dark: "black" },
  sunset: { light: "autumn", dark: "sunset" },
};

type ThemeStoreState = {
  themeStyle: ThemeStyle;
  themeMode: ThemeMode;
};

type ThemeStoreActions = {
  setThemeStyle: (style: ThemeStyle) => void;
  setThemeMode: (mode: ThemeMode) => void;
};

type ThemeStore = ThemeStoreState & ThemeStoreActions;

export function resolveThemeName(style: ThemeStyle, mode: ThemeMode, prefersDark: boolean): string {
  const resolvedMode = mode === "system" ? (prefersDark ? "dark" : "light") : mode;
  return themeNameMap[style][resolvedMode];
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      themeStyle: "dreamy",
      themeMode: "system",
      setThemeStyle: (style) => {
        set((prev) => (prev.themeStyle === style ? prev : { themeStyle: style }));
      },
      setThemeMode: (mode) => {
        set((prev) => (prev.themeMode === mode ? prev : { themeMode: mode }));
      },
    }),
    {
      name: "focus-web-theme",
      partialize: (state) => ({
        themeStyle: state.themeStyle,
        themeMode: state.themeMode,
      }),
    }
  )
);
