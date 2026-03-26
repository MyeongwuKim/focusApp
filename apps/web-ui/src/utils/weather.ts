export type WeatherSnapshot = {
  temperature: number;
  weatherCode: number;
  isDay: number;
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export const SEOUL_COORDINATES: Coordinates = {
  latitude: 37.5665,
  longitude: 126.978,
};

export async function fetchCurrentWeather({
  latitude,
  longitude,
}: Coordinates): Promise<WeatherSnapshot> {
  try {
    return await fetchCurrentWeatherFromMetNo({ latitude, longitude });
  } catch (error) {
    console.warn("met.no weather failed, fallback to Open-Meteo", error);
    return fetchCurrentWeatherFromOpenMeteo({ latitude, longitude });
  }
}

function mapSymbolCodeToWeatherCode(symbolCode: string): number {
  const symbol = symbolCode.toLowerCase();
  if (symbol.includes("thunder")) return 95;
  if (symbol.includes("sleet") || symbol.includes("snow")) return 71;
  if (
    symbol.includes("rain") ||
    symbol.includes("showers") ||
    symbol.includes("drizzle")
  ) {
    return 61;
  }
  if (symbol.includes("fog")) return 45;
  if (symbol.includes("cloudy")) return symbol.includes("partly") ? 2 : 3;
  if (symbol.includes("fair") || symbol.includes("clearsky")) return 0;
  return 3;
}

function resolveIsDay(symbolCode: string, timeIso: string): number {
  const symbol = symbolCode.toLowerCase();
  if (symbol.endsWith("_day")) return 1;
  if (symbol.endsWith("_night")) return 0;
  const hour = new Date(timeIso).getHours();
  return hour >= 6 && hour < 19 ? 1 : 0;
}

async function fetchCurrentWeatherFromMetNo({
  latitude,
  longitude,
}: Coordinates): Promise<WeatherSnapshot> {
  const url = new URL("https://api.met.no/weatherapi/locationforecast/2.0/compact");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`met.no weather API error: ${response.status}`);
  }

  type TimeseriesItem = {
    time: string;
    data?: {
      instant?: { details?: { air_temperature?: number } };
      next_1_hours?: { summary?: { symbol_code?: string } };
      next_6_hours?: { summary?: { symbol_code?: string } };
      next_12_hours?: { summary?: { symbol_code?: string } };
    };
  };

  const data = (await response.json()) as {
    properties?: { timeseries?: TimeseriesItem[] };
  };

  const timeseries = data.properties?.timeseries;
  if (!timeseries || timeseries.length === 0) {
    throw new Error("Invalid met.no payload");
  }

  const nowTs = Date.now();
  const nearest = timeseries.reduce((closest, current) => {
    const currentDiff = Math.abs(new Date(current.time).getTime() - nowTs);
    const closestDiff = Math.abs(new Date(closest.time).getTime() - nowTs);
    return currentDiff < closestDiff ? current : closest;
  });

  const temperature = nearest.data?.instant?.details?.air_temperature;
  const symbolCode =
    nearest.data?.next_1_hours?.summary?.symbol_code ||
    nearest.data?.next_6_hours?.summary?.symbol_code ||
    nearest.data?.next_12_hours?.summary?.symbol_code ||
    "cloudy";

  if (typeof temperature !== "number") {
    throw new Error("Missing met.no air_temperature");
  }

  return {
    temperature,
    weatherCode: mapSymbolCodeToWeatherCode(symbolCode),
    isDay: resolveIsDay(symbolCode, nearest.time),
  };
}

async function fetchCurrentWeatherFromOpenMeteo({
  latitude,
  longitude,
}: Coordinates): Promise<WeatherSnapshot> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
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
    throw new Error("Invalid Open-Meteo payload");
  }

  return {
    temperature: current.temperature_2m,
    weatherCode: current.weather_code,
    isDay: current.is_day,
  };
}
