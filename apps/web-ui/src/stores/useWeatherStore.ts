import { create } from "zustand";
import type { WeatherSnapshot } from "../utils/weather";

export type WeatherMood = "dreamy" | "cinematic";

type WeatherStoreState = {
  weatherEnabled: boolean;
  weatherMood: WeatherMood;
  weather: WeatherSnapshot | null;
};

type WeatherStoreActions = {
  setWeatherEnabled: (enabled: boolean) => void;
  setWeatherMood: (mood: WeatherMood) => void;
  setWeather: (nextWeather: WeatherSnapshot | null) => void;
  resetWeather: () => void;
};

type WeatherStore = WeatherStoreState & WeatherStoreActions;

const initialState: WeatherStoreState = {
  weatherEnabled: true,
  weatherMood: "dreamy",
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
