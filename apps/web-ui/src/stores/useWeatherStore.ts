import { create } from "zustand";
import type { WeatherSnapshot } from "../utils/weather";

export type WeatherMood = "dreamy" | "cinematic";

type WeatherStoreState = {
  weatherEnabled: boolean;
  weatherMood: WeatherMood;
  weatherParticleClarity: number;
  weather: WeatherSnapshot | null;
};

type WeatherStoreActions = {
  setWeatherEnabled: (enabled: boolean) => void;
  setWeatherMood: (mood: WeatherMood) => void;
  setWeatherParticleClarity: (value: number) => void;
  setWeather: (nextWeather: WeatherSnapshot | null) => void;
  resetWeather: () => void;
};

type WeatherStore = WeatherStoreState & WeatherStoreActions;

const initialState: WeatherStoreState = {
  weatherEnabled: true,
  weatherMood: "dreamy",
  weatherParticleClarity: 70,
  weather: null,
};

export const useWeatherStore = create<WeatherStore>((set) => ({
  ...initialState,
  setWeatherEnabled: (enabled) => {
    set((prevState) =>
      prevState.weatherEnabled === enabled
        ? prevState
        : { weatherEnabled: enabled, weather: enabled ? prevState.weather : null }
    );
  },
  setWeatherMood: (mood) => {
    set((prevState) => (prevState.weatherMood === mood ? prevState : { weatherMood: mood }));
  },
  setWeatherParticleClarity: (value) => {
    const normalized = Math.max(0, Math.min(100, Math.round(value)));
    set((prevState) =>
      prevState.weatherParticleClarity === normalized
        ? prevState
        : { weatherParticleClarity: normalized }
    );
  },
  setWeather: (nextWeather) => {
    set((prevState) => {
      if (
        prevState.weather?.temperature === nextWeather?.temperature &&
        prevState.weather?.weatherCode === nextWeather?.weatherCode &&
        prevState.weather?.isDay === nextWeather?.isDay
      ) {
        return prevState;
      }
      return { weather: nextWeather };
    });
  },
  resetWeather: () => {
    set(initialState);
  },
}));
