import { useWeatherStore } from "../../stores";
import { SegmentedToggle } from "../../components/SegmentedToggle";
import { SettingsDetailShell } from "./SettingsDetailShell";

type SettingsWeatherViewProps = {
  onBack: () => void;
};

export function SettingsWeatherView({ onBack }: SettingsWeatherViewProps) {
  const weatherEnabled = useWeatherStore((state) => state.weatherEnabled);
  const weatherMood = useWeatherStore((state) => state.weatherMood);
  const setWeatherEnabled = useWeatherStore((state) => state.setWeatherEnabled);
  const setWeatherMood = useWeatherStore((state) => state.setWeatherMood);

  return (
    <SettingsDetailShell title="날씨" description="표시와 무드를 선택하세요." onBack={onBack}>
      <div className="space-y-2 rounded-xl border border-base-300/80 bg-base-100/75 p-3">
        <p className="m-0 text-sm font-medium text-base-content">사용</p>
        <div className="mt-3">
          <SegmentedToggle
            value={weatherEnabled ? "on" : "off"}
            options={[
              { value: "on", label: "ON" },
              { value: "off", label: "OFF" },
            ]}
            onChange={(nextValue) => setWeatherEnabled(nextValue === "on")}
          />
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-base-300/80 bg-base-100/75 p-3">
        <p className="m-0 text-sm font-medium text-base-content">무드</p>
        <div className="mt-3">
          <SegmentedToggle
            value={weatherMood}
            options={[
              { value: "dreamy", label: "DREAMY" },
              { value: "cinematic", label: "CINEMA" },
            ]}
            onChange={setWeatherMood}
          />
        </div>
      </div>
    </SettingsDetailShell>
  );
}

