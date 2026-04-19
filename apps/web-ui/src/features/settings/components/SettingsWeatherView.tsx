import { useEffect, useState } from "react";
import { useWeatherStore } from "../../../stores";
import { SegmentedToggle } from "../../../components/SegmentedToggle";
import { SettingsDetailShell } from "./SettingsDetailShell";
import { PermissionToggleButton } from "../../../components/ui/PermissionToggleButton";
import { RangeSlider } from "../../../components/ui/RangeSlider";
import { getLocationPermissionStatus, openAppPermissionSettings } from "../../../utils/notifications";

export function SettingsWeatherView() {
  const weatherEnabled = useWeatherStore((state) => state.weatherEnabled);
  const weatherMood = useWeatherStore((state) => state.weatherMood);
  const weatherParticleClarity = useWeatherStore((state) => state.weatherParticleClarity);
  const setWeatherEnabled = useWeatherStore((state) => state.setWeatherEnabled);
  const setWeatherMood = useWeatherStore((state) => state.setWeatherMood);
  const setWeatherParticleClarity = useWeatherStore((state) => state.setWeatherParticleClarity);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocationOn, setIsLocationOn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refreshLocationStatus = async () => {
      if (!cancelled) {
        setIsLoading(true);
      }
      const status = await getLocationPermissionStatus();
      if (cancelled) {
        return;
      }
      setIsLocationOn(status.granted);
      setIsLoading(false);
    };

    void refreshLocationStatus();
    const handleFocus = () => {
      void refreshLocationStatus();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const handleLocationToggle = () => {
    openAppPermissionSettings();
  };

  const isWeatherOptionsDisabled = !isLocationOn;
  const disabledClassName = isWeatherOptionsDisabled ? "opacity-45 pointer-events-none select-none" : "";

  return (
    <SettingsDetailShell description="날씨 표시와 파티클 분위기를 설정합니다.">
      <div className="space-y-2 rounded-xl border border-base-300/80 bg-base-100/75 p-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-base-300/70 bg-base-200/40 px-3 py-2">
          <p className="m-0 text-sm font-medium text-base-content/85">위치 권한</p>
          <PermissionToggleButton enabled={isLocationOn} onClick={handleLocationToggle} disabled={isLoading} />
        </div>
      </div>

      <div className={`space-y-2 rounded-xl border border-base-300/80 bg-base-100/75 p-3 ${disabledClassName}`}>
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

      <div className={`space-y-2 rounded-xl border border-base-300/80 bg-base-100/75 p-3 ${disabledClassName}`}>
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

      <div className={`space-y-3 rounded-xl border border-base-300/80 bg-base-100/75 p-3 ${disabledClassName}`}>
        <div className="flex items-center justify-between">
          <p className="m-0 text-sm font-medium text-base-content">파티클 선명도</p>
          <p className="m-0 text-xs font-semibold text-base-content/70">{weatherParticleClarity}%</p>
        </div>
        <RangeSlider
          min={0}
          max={100}
          step={1}
          value={weatherParticleClarity}
          onChange={(event) => setWeatherParticleClarity(Number(event.target.value))}
          aria-label="파티클 선명도"
          leftLabel="소프트"
          rightLabel="선명"
        />
      </div>
    </SettingsDetailShell>
  );
}
