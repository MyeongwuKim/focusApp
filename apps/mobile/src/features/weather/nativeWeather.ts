import type { NativeCoordinates } from "../bridge/handlers/locationBridgeHandlers";
import { getLocationCoordinatesSnapshot } from "../location/nativeLocationBridge";

export const WEATHER_REFRESH_MS = 30 * 60 * 1000;

export type NativeWeatherSnapshot = {
  temperature: number;
  weatherCode: number;
  isDay: number;
  coordinates: NativeCoordinates;
  source: "device";
  updatedAt: string;
};

export async function fetchNativeWeatherSnapshot(): Promise<NativeWeatherSnapshot | null> {
  const locationSnapshot = await getLocationCoordinatesSnapshot();
  if (!locationSnapshot.granted || !locationSnapshot.coordinates) return null;

  const coordinates = locationSnapshot.coordinates;
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(coordinates.latitude));
  url.searchParams.set("longitude", String(coordinates.longitude));
  url.searchParams.set("current", "temperature_2m,weather_code,is_day");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Open-Meteo weather API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    current?: { temperature_2m?: number; weather_code?: number; is_day?: number };
  };
  const current = data.current;
  if (
    !current ||
    typeof current.temperature_2m !== "number" ||
    typeof current.weather_code !== "number" ||
    typeof current.is_day !== "number"
  ) {
    throw new Error("Invalid Open-Meteo weather payload");
  }

  return {
    temperature: current.temperature_2m,
    weatherCode: current.weather_code,
    isDay: current.is_day,
    coordinates,
    source: "device",
    updatedAt: new Date().toISOString(),
  };
}
