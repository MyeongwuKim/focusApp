import { useEffect, useState } from "react";
import { useWeatherStore } from "../../../stores";
import { SegmentedToggle } from "../../../components/SegmentedToggle";
import { SettingsDetailShell } from "./SettingsDetailShell";
import { PermissionToggleButton } from "../../../components/ui/PermissionToggleButton";
import { getLocationPermissionStatus, openAppPermissionSettings } from "../../../utils/notifications";

export function SettingsWeatherView() {
  const weatherEnabled = useWeatherStore((state) => state.weatherEnabled);
  const weatherMood = useWeatherStore((state) => state.weatherMood);
  const setWeatherEnabled = useWeatherStore((state) => state.setWeatherEnabled);
  const setWeatherMood = useWeatherStore((state) => state.setWeatherMood);
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
    <SettingsDetailShell title="날씨 설정" description="">
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
    </SettingsDetailShell>
  );
}
