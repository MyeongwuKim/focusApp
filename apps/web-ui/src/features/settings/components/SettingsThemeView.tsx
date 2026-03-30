import { THEME_STYLES, THEME_STYLE_LABEL, useThemeStore } from "../../../stores";
import { SegmentedToggle } from "../../../components/SegmentedToggle";
import { SettingsDetailShell } from "./SettingsDetailShell";

export function SettingsThemeView() {
  const themeStyle = useThemeStore((state) => state.themeStyle);
  const themeMode = useThemeStore((state) => state.themeMode);
  const setThemeStyle = useThemeStore((state) => state.setThemeStyle);
  const setThemeMode = useThemeStore((state) => state.setThemeMode);

  return (
    <SettingsDetailShell title="테마" description="스타일과 모드를 선택하세요.">
      <div className="space-y-3 rounded-xl border border-base-300/80 bg-base-100/75 p-3">
        <p className="m-0 text-sm font-medium text-base-content">스타일</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {THEME_STYLES.map((style) => {
            const isActive = style === themeStyle;
            return (
              <button
                key={style}
                type="button"
                className={`btn btn-sm ${isActive ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setThemeStyle(style)}
                aria-pressed={isActive}
              >
                {THEME_STYLE_LABEL[style]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-base-300/80 bg-base-100/75 p-3">
        <p className="m-0 text-sm font-medium text-base-content">모드</p>
        <div className="mt-3">
          <SegmentedToggle
            value={themeMode}
            options={[
              { value: "system", label: "SYSTEM" },
              { value: "light", label: "LIGHT" },
              { value: "dark", label: "DARK" },
            ]}
            onChange={setThemeMode}
          />
        </div>
      </div>
    </SettingsDetailShell>
  );
}
