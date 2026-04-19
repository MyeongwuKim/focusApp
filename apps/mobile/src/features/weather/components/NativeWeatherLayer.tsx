import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SkiaWeatherOverlay } from '../SkiaWeatherOverlay';

const WEATHER_REFRESH_MS = 30 * 60 * 1000;
const FOOTER_IMPACT_OFFSET = 72;
const SNOW_ACCUMULATION_MAX = 1;
const SNOW_ACCUMULATION_STEP = 0.045;
const SNOW_ACCUMULATION_INTERVAL_MS = 2800;
const SNOW_MELT_STEP = 0.03;
const SNOW_MELT_INTERVAL_MS = 3400;
const SEOUL_WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=weather_code&forecast_days=1&timezone=auto';

type WeatherEffect = 'rain' | 'snow' | 'thunder' | null;
type WeatherMood = 'dreamy' | 'cinematic';
type WeatherEffectOverride = 'auto' | WeatherEffect;
type WeatherRenderer = 'legacy' | 'skia';

type WeatherControlState = {
  manualEffect: WeatherEffectOverride;
  weatherEnabled: boolean;
  weatherMood: WeatherMood;
  weatherParticleClarity: number;
};

type WeatherLiveState = {
  weatherEffect: WeatherEffect;
  weatherRenderer: WeatherRenderer;
};

const DEFAULT_WEATHER_CONTROL_STATE: WeatherControlState = {
  manualEffect: 'auto',
  weatherEnabled: true,
  weatherMood: 'dreamy',
  weatherParticleClarity: 70,
};

const DEFAULT_WEATHER_LIVE_STATE: WeatherLiveState = {
  weatherEffect: null,
  weatherRenderer: 'legacy',
};

let weatherControlState: WeatherControlState = DEFAULT_WEATHER_CONTROL_STATE;
let weatherLiveState: WeatherLiveState = DEFAULT_WEATHER_LIVE_STATE;
const weatherControlListeners = new Set<(state: WeatherControlState) => void>();
const weatherLiveListeners = new Set<(state: WeatherLiveState) => void>();

function updateWeatherControlState(patch: Partial<WeatherControlState>) {
  weatherControlState = {
    ...weatherControlState,
    ...patch,
  };
  weatherControlListeners.forEach((listener) => listener(weatherControlState));
}

function updateWeatherLiveState(patch: Partial<WeatherLiveState>) {
  weatherLiveState = {
    ...weatherLiveState,
    ...patch,
  };
  weatherLiveListeners.forEach((listener) => listener(weatherLiveState));
}

function useWeatherControlState() {
  const [state, setState] = useState<WeatherControlState>(weatherControlState);

  useEffect(() => {
    weatherControlListeners.add(setState);
    return () => {
      weatherControlListeners.delete(setState);
    };
  }, []);

  const setManualEffect = useCallback((manualEffect: WeatherEffectOverride) => {
    updateWeatherControlState({ manualEffect });
  }, []);

  return {
    manualEffect: state.manualEffect,
    weatherEnabled: state.weatherEnabled,
    weatherMood: state.weatherMood,
    weatherParticleClarity: state.weatherParticleClarity,
    setManualEffect,
  };
}

function isWeatherMood(value: unknown): value is WeatherMood {
  return value === 'dreamy' || value === 'cinematic';
}

export function applyNativeWeatherSettings(input: {
  enabled?: boolean;
  mood?: WeatherMood | string;
  particleClarity?: number;
}) {
  const patch: Partial<WeatherControlState> = {};
  if (typeof input.enabled === 'boolean') {
    patch.weatherEnabled = input.enabled;
  }
  if (isWeatherMood(input.mood)) {
    patch.weatherMood = input.mood;
  }
  if (typeof input.particleClarity === 'number' && Number.isFinite(input.particleClarity)) {
    patch.weatherParticleClarity = clamp(Math.round(input.particleClarity), 0, 100);
  }
  if (Object.keys(patch).length > 0) {
    updateWeatherControlState(patch);
  }
}

function useWeatherLiveState() {
  const [state, setState] = useState<WeatherLiveState>(weatherLiveState);

  useEffect(() => {
    weatherLiveListeners.add(setState);
    return () => {
      weatherLiveListeners.delete(setState);
    };
  }, []);

  return state;
}

type Particle = {
  left: number;
  top?: number;
  delay: number;
  duration: number;
  size: number;
  opacity: number;
  drift: number;
  width?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function weatherCodeToEffect(code: number): WeatherEffect {
  if (code >= 95 && code <= 99) {
    return 'thunder';
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return 'snow';
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return 'rain';
  }
  return null;
}

async function fetchWeatherSnapshot(): Promise<{
  effect: WeatherEffect;
}> {
  const response = await fetch(SEOUL_WEATHER_URL);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }
  const data = (await response.json()) as {
    current?: { weather_code?: number };
  };
  const weatherCode = data.current?.weather_code;
  if (typeof weatherCode !== 'number') {
    throw new Error('Missing weather_code');
  }
  return { effect: weatherCodeToEffect(weatherCode) };
}

function AnimatedRainDrop({
  left,
  delay,
  duration,
  size,
  opacity: baseOpacity,
  drift,
  width: customWidth,
  viewportHeight,
}: Particle & { viewportHeight: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      progress.setValue(0);
      loopRef.current = Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loopRef.current.start();
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      loopRef.current?.stop();
      progress.setValue(0);
    };
  }, [delay, duration, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, viewportHeight + 120],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [0, drift * 0.35, drift, drift * 1.2],
  });
  const rotate = `${clamp(drift * 0.85, -14, 14)}deg`;
  const opacity = progress.interpolate({
    inputRange: [0, 0.06, 0.88, 1],
    outputRange: [0, baseOpacity, baseOpacity * 0.9, 0],
  });

  return (
    <Animated.View
      style={[
        styles.rainDrop,
        {
          left,
          height: size,
          width: customWidth ?? Math.max(1.2, size * 0.055),
          opacity,
          transform: [{ translateY }, { translateX }, { rotate }],
        },
      ]}
    />
  );
}

function AnimatedSnowFlake({
  left,
  delay,
  duration,
  size,
  opacity,
  drift,
  viewportHeight,
}: Particle & { viewportHeight: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      progress.setValue(0);
      loopRef.current = Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loopRef.current.start();
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      loopRef.current?.stop();
      progress.setValue(0);
    };
  }, [delay, duration, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, viewportHeight + 40],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 0.25, 0.55, 0.82, 1],
    outputRange: [0, drift * 0.6, -drift * 0.5, drift * 0.35, -drift * 0.2],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-8deg', '6deg', '-4deg'],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.92, 1.04, 0.96],
  });
  const animatedOpacity = progress.interpolate({
    inputRange: [0, 0.06, 0.9, 1],
    outputRange: [0, opacity, opacity * 0.9, 0],
  });

  return (
    <Animated.View
      style={[
        styles.snowFlake,
        {
          left,
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: animatedOpacity,
          transform: [{ translateY }, { translateX }, { rotate }, { scale }],
        },
      ]}
    />
  );
}

function AnimatedSnowLandingPuff({
  left,
  bottomOffset,
  delay,
  duration,
  size,
  opacity: baseOpacity,
}: Particle & { bottomOffset: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      progress.setValue(0);
      loopRef.current = Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        })
      );
      loopRef.current.start();
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      loopRef.current?.stop();
      progress.setValue(0);
    };
  }, [delay, duration, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [2, -6, -16],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0.25, 1.05, 1.5],
  });
  const scaleX = progress.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0.35, 1.25, 1.7],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 0.55, 1],
    outputRange: [0, baseOpacity * 1.05, baseOpacity * 0.55, 0],
  });

  return (
    <Animated.View
      style={[
        styles.snowLandingPuff,
        {
          left,
          width: size,
          height: size * 0.45,
          borderRadius: size * 0.22,
          bottom: bottomOffset,
          opacity,
          transform: [{ translateY }, { scale }, { scaleX }],
        },
      ]}
    />
  );
}

function AnimatedRainSplash({
  left,
  bottomOffset,
  delay,
  duration,
  size,
  opacity: baseOpacity,
}: Particle & { bottomOffset: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      progress.setValue(0);
      loopRef.current = Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      );
      loopRef.current.start();
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      loopRef.current?.stop();
      progress.setValue(0);
    };
  }, [delay, duration, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, -7, -12],
  });
  const scaleX = progress.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0.3, 1.1, 1.55],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [0, baseOpacity, 0],
  });

  return (
    <Animated.View
      style={[
        styles.rainSplash,
        {
          left,
          width: size,
          bottom: bottomOffset,
          borderRadius: size * 0.45,
          opacity,
          transform: [{ translateY }, { scaleX }],
        },
      ]}
    />
  );
}

function AnimatedRainSpray({
  left,
  bottomOffset,
  delay,
  duration,
  size,
  opacity: baseOpacity,
  drift,
}: Particle & { bottomOffset: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      progress.setValue(0);
      loopRef.current = Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      );
      loopRef.current.start();
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      loopRef.current?.stop();
      progress.setValue(0);
    };
  }, [delay, duration, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, -(size * 0.9), -(size * 1.7)],
  });
  const spread = Math.max(4, drift);
  const leftDropX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -spread],
  });
  const rightDropX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, spread],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [0, baseOpacity, 0],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0.8, 1.05, 1.2],
  });

  return (
    <>
      <Animated.View
        style={[
          styles.rainSprayDrop,
          {
            left,
            bottom: bottomOffset,
            width: size * 0.24,
            height: size * 0.24,
            borderRadius: size * 0.12,
            opacity,
            transform: [{ translateY }, { translateX: leftDropX }, { scale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.rainSprayDrop,
          {
            left,
            bottom: bottomOffset,
            width: size * 0.24,
            height: size * 0.24,
            borderRadius: size * 0.12,
            opacity,
            transform: [{ translateY }, { translateX: rightDropX }, { scale }],
          },
        ]}
      />
    </>
  );
}

function WeatherOverlay({
  effect,
  mood,
  particleClarity,
  width,
  height,
  renderer,
}: {
  effect: WeatherEffect;
  mood: WeatherMood;
  particleClarity: number;
  width: number;
  height: number;
  renderer: WeatherRenderer;
}) {
  const useSkiaRenderer = renderer === 'skia';
  const [skiaFailed, setSkiaFailed] = useState(false);
  const impactBottomOffset = Math.max(14, FOOTER_IMPACT_OFFSET - height * 0.01);
  const isCinematic = mood === 'cinematic';
  const clarityRatio = clamp(particleClarity, 0, 100) / 100;
  const clarityAlphaScale = 0.45 + clarityRatio * 1.2;
  const clarityCountScale = 0.7 + clarityRatio * 0.65;
  const clarityThicknessScale = 0.7 + clarityRatio * 0.95;
  const claritySpeedScale = 0.85 + clarityRatio * 0.35;
  const moodTintOpacity = 0.8 + (1 - clarityRatio) * 0.6;
  const rainParticles = useMemo<Particle[]>(() => {
    if (effect !== 'rain' && effect !== 'thunder') {
      return [];
    }
    const baseCount = isCinematic ? 30 : 58;
    const count = Math.max(8, Math.round(baseCount * clarityCountScale));
    return Array.from({ length: count }, () => ({
      left: Math.random() * width,
      delay: Math.random() * 2200,
      duration:
        ((isCinematic ? 620 : 980) + Math.random() * (isCinematic ? 520 : 920)) / claritySpeedScale,
      size: (isCinematic ? 28 : 18) + Math.random() * (isCinematic ? 24 : 20),
      opacity: clamp(
        ((isCinematic ? 0.11 : 0.2) + Math.random() * (isCinematic ? 0.08 : 0.13)) * clarityAlphaScale,
        0.03,
        0.95
      ),
      drift: (Math.random() - 0.5) * (isCinematic ? 11 : 26),
      width: ((isCinematic ? 1.2 : 0.8) + Math.random() * (isCinematic ? 1.0 : 0.6)) * clarityThicknessScale,
    }));
  }, [clarityAlphaScale, clarityCountScale, claritySpeedScale, clarityThicknessScale, effect, isCinematic, width]);
  const snowFarParticles = useMemo<Particle[]>(() => {
    if (effect !== 'snow') {
      return [];
    }
    const baseCount = isCinematic ? 12 : 32;
    const count = Math.max(6, Math.round(baseCount * clarityCountScale));
    return Array.from({ length: count }, () => ({
      left: Math.random() * width,
      delay: Math.random() * 2600,
      duration:
        ((isCinematic ? 4600 : 7600) + Math.random() * (isCinematic ? 2600 : 4200)) / claritySpeedScale,
      size: (isCinematic ? 1.4 : 2.4) + Math.random() * (isCinematic ? 2.2 : 3.8),
      opacity: clamp(
        ((isCinematic ? 0.05 : 0.13) + Math.random() * (isCinematic ? 0.06 : 0.16)) * clarityAlphaScale,
        0.02,
        0.7
      ),
      drift: (isCinematic ? 4 : 9) + Math.random() * (isCinematic ? 5 : 11),
    }));
  }, [clarityAlphaScale, clarityCountScale, claritySpeedScale, effect, isCinematic, width]);
  const snowNearParticles = useMemo<Particle[]>(() => {
    if (effect !== 'snow') {
      return [];
    }
    const baseCount = isCinematic ? 16 : 40;
    const count = Math.max(8, Math.round(baseCount * clarityCountScale));
    return Array.from({ length: count }, () => ({
      left: Math.random() * width,
      delay: Math.random() * 2200,
      duration:
        ((isCinematic ? 3400 : 5200) + Math.random() * (isCinematic ? 2200 : 3200)) / claritySpeedScale,
      size: (isCinematic ? 2.8 : 4.5) + Math.random() * (isCinematic ? 4.2 : 7.6),
      opacity: clamp(
        ((isCinematic ? 0.1 : 0.24) + Math.random() * (isCinematic ? 0.1 : 0.24)) * clarityAlphaScale,
        0.04,
        0.95
      ),
      drift: (isCinematic ? 6 : 12) + Math.random() * (isCinematic ? 6 : 14),
    }));
  }, [clarityAlphaScale, clarityCountScale, claritySpeedScale, effect, isCinematic, width]);
  const snowLandingPuffs = useMemo<Particle[]>(() => {
    if (effect !== 'snow') {
      return [];
    }
    const baseCount = isCinematic ? 12 : 28;
    const count = Math.max(5, Math.round(baseCount * clarityCountScale));
    return Array.from({ length: count }, () => ({
      left: Math.random() * width,
      delay: Math.random() * 1800,
      duration:
        ((isCinematic ? 760 : 980) + Math.random() * (isCinematic ? 680 : 1200)) / claritySpeedScale,
      size: (isCinematic ? 8 : 12) + Math.random() * (isCinematic ? 10 : 16),
      opacity: clamp(
        ((isCinematic ? 0.14 : 0.26) + Math.random() * (isCinematic ? 0.12 : 0.22)) * clarityAlphaScale,
        0.05,
        0.92
      ),
      drift: 0,
    }));
  }, [clarityAlphaScale, clarityCountScale, claritySpeedScale, effect, isCinematic, width]);
  const rainSplashes = useMemo<Particle[]>(() => {
    if (effect !== 'rain' && effect !== 'thunder') {
      return [];
    }
    const baseCount = isCinematic ? 8 : 20;
    const count = Math.max(4, Math.round(baseCount * clarityCountScale));
    return Array.from({ length: count }, () => ({
      left: Math.random() * width,
      delay: Math.random() * 1600,
      duration:
        ((isCinematic ? 760 : 1080) + Math.random() * (isCinematic ? 640 : 920)) / claritySpeedScale,
      size: (isCinematic ? 6 : 9) + Math.random() * (isCinematic ? 6 : 10),
      opacity: clamp(
        ((isCinematic ? 0.07 : 0.14) + Math.random() * (isCinematic ? 0.08 : 0.14)) * clarityAlphaScale,
        0.04,
        0.9
      ),
      drift: 0,
    }));
  }, [clarityAlphaScale, clarityCountScale, claritySpeedScale, effect, isCinematic, width]);
  const rainSprays = useMemo<Particle[]>(() => {
    if (effect !== 'rain' && effect !== 'thunder') {
      return [];
    }
    const baseCount = isCinematic ? 6 : 12;
    const count = Math.max(4, Math.round(baseCount * clarityCountScale));
    return Array.from({ length: count }, () => ({
      left: Math.random() * width,
      delay: Math.random() * 1800,
      duration:
        ((isCinematic ? 620 : 840) + Math.random() * (isCinematic ? 520 : 780)) / claritySpeedScale,
      size: (isCinematic ? 4 : 6) + Math.random() * (isCinematic ? 4 : 7),
      opacity: clamp(
        ((isCinematic ? 0.07 : 0.13) + Math.random() * (isCinematic ? 0.08 : 0.12)) * clarityAlphaScale,
        0.04,
        0.9
      ),
      drift: (isCinematic ? 3 : 5) + Math.random() * (isCinematic ? 5 : 10),
    }));
  }, [clarityAlphaScale, clarityCountScale, claritySpeedScale, effect, isCinematic, width]);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const afterGlowOpacity = useRef(new Animated.Value(0)).current;
  const snowGroundOpacity = useRef(new Animated.Value(0)).current;
  const [snowAccumulation, setSnowAccumulation] = useState(0);
  const thunderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (effect !== 'thunder') {
      flashOpacity.setValue(0);
      return;
    }

    const scheduleNextFlash = () => {
      const strikeCount = Math.random() > 0.66 ? 3 : Math.random() > 0.35 ? 2 : 1;
      const flashSequence: Animated.CompositeAnimation[] = [];
      const thunderClarityScale = 0.75 + clarityRatio * 0.45;

      for (let i = 0; i < strikeCount; i += 1) {
        const intensityBase = mood === 'cinematic' ? 0.34 : 0.16;
        const intensity =
          (intensityBase + Math.random() * (mood === 'cinematic' ? 0.18 : 0.08)) *
          thunderClarityScale;
        flashSequence.push(
          Animated.timing(flashOpacity, {
            toValue: intensity,
            duration: 85 + Math.floor(Math.random() * 55),
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(flashOpacity, {
            toValue: 0,
            duration: 180 + Math.floor(Math.random() * 180),
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(afterGlowOpacity, {
            toValue: Math.max(mood === 'cinematic' ? 0.08 : 0.03, intensity * (mood === 'cinematic' ? 0.44 : 0.25)),
            duration: 110 + Math.floor(Math.random() * 90),
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(afterGlowOpacity, {
            toValue: 0,
            duration: 360 + Math.floor(Math.random() * 320),
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          })
        );
        if (i < strikeCount - 1) {
          flashSequence.push(Animated.delay(120 + Math.floor(Math.random() * 140)));
        }
      }

      Animated.sequence(flashSequence).start(({ finished }) => {
        if (!finished || effect !== 'thunder') {
          return;
        }
        const nextDelay =
          (mood === 'cinematic' ? 2200 : 5600) + Math.floor(Math.random() * (mood === 'cinematic' ? 5200 : 9800));
        thunderTimeoutRef.current = setTimeout(scheduleNextFlash, nextDelay);
      });
    };

    scheduleNextFlash();
    return () => {
      if (thunderTimeoutRef.current) {
        clearTimeout(thunderTimeoutRef.current);
        thunderTimeoutRef.current = null;
      }
      flashOpacity.setValue(0);
      afterGlowOpacity.setValue(0);
    };
  }, [clarityRatio, effect, mood, flashOpacity, afterGlowOpacity]);

  useEffect(() => {
    Animated.timing(snowGroundOpacity, {
      toValue: effect === 'snow' ? 1 : 0,
      duration: effect === 'snow' ? 750 : 420,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [effect, snowGroundOpacity]);

  useEffect(() => {
    if (effect !== 'snow') {
      return;
    }
    const intervalId = setInterval(() => {
      setSnowAccumulation((prev) =>
        clamp(prev + SNOW_ACCUMULATION_STEP, 0, SNOW_ACCUMULATION_MAX)
      );
    }, SNOW_ACCUMULATION_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [effect]);

  useEffect(() => {
    if (effect === 'snow') {
      return;
    }
    const intervalId = setInterval(() => {
      setSnowAccumulation((prev) => clamp(prev - SNOW_MELT_STEP, 0, SNOW_ACCUMULATION_MAX));
    }, SNOW_MELT_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [effect]);

  const snowAccumulationRatio = SNOW_ACCUMULATION_MAX
    ? clamp(snowAccumulation / SNOW_ACCUMULATION_MAX, 0, 1)
    : 0;
  const snowGroundHeight = 18 + snowAccumulationRatio * 52;
  const snowGroundBottom = -8 - snowAccumulationRatio * 4;
  const snowGroundRadius = 22 + snowAccumulationRatio * 16;
  const snowGroundCoreAlpha = mood === 'cinematic'
    ? (0.12 + snowAccumulationRatio * 0.14) * (0.8 + clarityRatio * 0.35)
    : (0.24 + snowAccumulationRatio * 0.24) * (0.8 + clarityRatio * 0.35);
  const snowGroundHighlightAlpha = mood === 'cinematic'
    ? (0.05 + snowAccumulationRatio * 0.12) * (0.8 + clarityRatio * 0.35)
    : (0.12 + snowAccumulationRatio * 0.22) * (0.8 + clarityRatio * 0.35);
  const snowGroundColor = mood === 'cinematic'
    ? `rgba(198, 215, 235, ${snowGroundCoreAlpha})`
    : `rgba(244, 250, 255, ${snowGroundCoreAlpha})`;
  const snowImpactBottomOffset = Math.max(8, snowGroundBottom + snowGroundHeight - 6);

  if (useSkiaRenderer && !skiaFailed) {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <SkiaWeatherOverlay
          effect={effect}
          mood={mood}
          particleClarity={particleClarity}
          width={width}
          height={height}
          impactBottomOffset={impactBottomOffset}
          onRenderFail={() => setSkiaFailed(true)}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.moodTint,
            isCinematic ? styles.moodTintCinematic : styles.moodTintDreamy,
            { opacity: moodTintOpacity },
          ]}
        />
        {effect === 'snow' ? (
          <>
            <Animated.View
              style={[
                styles.snowGround,
                mood === 'cinematic' ? styles.snowGroundCinematic : styles.snowGroundDreamy,
                {
                  opacity: snowGroundOpacity,
                  height: snowGroundHeight,
                  bottom: snowGroundBottom,
                  borderTopLeftRadius: snowGroundRadius,
                  borderTopRightRadius: snowGroundRadius,
                  backgroundColor: snowGroundColor,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.snowGroundHighlight,
                {
                  opacity: snowGroundOpacity,
                  height: Math.max(8, snowGroundHeight * 0.5),
                  bottom: snowGroundBottom - 1,
                  borderTopLeftRadius: snowGroundRadius * 0.9,
                  borderTopRightRadius: snowGroundRadius * 0.9,
                  backgroundColor: `rgba(250, 254, 255, ${snowGroundHighlightAlpha})`,
                },
              ]}
            />
          </>
        ) : null}
        {effect === 'snow' &&
          snowLandingPuffs.map((particle, index) => (
            <AnimatedSnowLandingPuff
              key={`snow-puff-skia-${index}`}
              {...particle}
              bottomOffset={snowImpactBottomOffset}
            />
          ))}
        {effect === 'thunder' ? (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.thunderAfterglow,
              { opacity: afterGlowOpacity },
            ]}
          />
        ) : null}
        {effect === 'thunder' ? (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.thunderFlash,
              mood === 'cinematic' ? styles.thunderFlashCinematic : styles.thunderFlashDreamy,
              { opacity: flashOpacity },
            ]}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.moodTint,
          isCinematic ? styles.moodTintCinematic : styles.moodTintDreamy,
          { opacity: moodTintOpacity },
        ]}
      />
      {(effect === 'rain' || effect === 'thunder') &&
        rainParticles.map((particle, index) => (
          <AnimatedRainDrop key={`rain-${index}`} {...particle} viewportHeight={height} />
        ))}
      {effect === 'snow' &&
        snowFarParticles.map((particle, index) => (
          <AnimatedSnowFlake key={`snow-far-${index}`} {...particle} viewportHeight={height} />
        ))}
      {effect === 'snow' &&
        snowNearParticles.map((particle, index) => (
          <AnimatedSnowFlake key={`snow-${index}`} {...particle} viewportHeight={height} />
        ))}
      {effect === 'snow' ? (
        <>
          <Animated.View
            style={[
              styles.snowGround,
              mood === 'cinematic' ? styles.snowGroundCinematic : styles.snowGroundDreamy,
              {
                opacity: snowGroundOpacity,
                height: snowGroundHeight,
                bottom: snowGroundBottom,
                borderTopLeftRadius: snowGroundRadius,
                borderTopRightRadius: snowGroundRadius,
                backgroundColor: snowGroundColor,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.snowGroundHighlight,
              {
                opacity: snowGroundOpacity,
                height: Math.max(8, snowGroundHeight * 0.5),
                bottom: snowGroundBottom - 1,
                borderTopLeftRadius: snowGroundRadius * 0.9,
                borderTopRightRadius: snowGroundRadius * 0.9,
                backgroundColor: `rgba(250, 254, 255, ${snowGroundHighlightAlpha})`,
              },
            ]}
          />
        </>
      ) : null}
      {effect === 'snow' &&
        snowLandingPuffs.map((particle, index) => (
          <AnimatedSnowLandingPuff
            key={`snow-puff-${index}`}
            {...particle}
            bottomOffset={snowImpactBottomOffset}
          />
        ))}
      {(effect === 'rain' || effect === 'thunder') &&
        rainSplashes.map((particle, index) => (
          <AnimatedRainSplash
            key={`rain-splash-${index}`}
            {...particle}
            bottomOffset={impactBottomOffset - 4}
          />
        ))}
      {(effect === 'rain' || effect === 'thunder') &&
        rainSprays.map((particle, index) => (
          <AnimatedRainSpray
            key={`rain-spray-${index}`}
            {...particle}
            bottomOffset={impactBottomOffset - 2}
          />
        ))}
      {effect === 'thunder' ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.thunderAfterglow,
            { opacity: afterGlowOpacity },
          ]}
        />
      ) : null}
      {effect === 'thunder' ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.thunderFlash,
            mood === 'cinematic' ? styles.thunderFlashCinematic : styles.thunderFlashDreamy,
            { opacity: flashOpacity },
          ]}
        />
      ) : null}
    </View>
  );
}

type WeatherDebugPanelProps = {
  manualEffect: WeatherEffectOverride;
  weatherEffect: WeatherEffect;
  weatherRenderer: WeatherRenderer;
  onSetManualEffect: (value: WeatherEffectOverride) => void;
};

function WeatherDebugPanel({
  manualEffect,
  weatherEffect,
  weatherRenderer,
  onSetManualEffect,
}: WeatherDebugPanelProps) {
  return (
    <View style={styles.debugPanel}>
      <Text style={styles.debugTitle}>날씨 테스트</Text>
      <Text style={styles.debugSubtitle}>
        현재: {manualEffect === 'auto' ? `자동(${weatherEffect ?? 'clear'})` : manualEffect ?? 'clear'}
      </Text>
      <Text style={styles.debugSubtitle}>렌더러: {weatherRenderer}</Text>
      <View style={styles.debugButtonRow}>
        {([
          ['auto', '자동'],
          [null, '맑음'],
          ['rain', '비'],
          ['snow', '눈'],
          ['thunder', '천둥'],
        ] as const).map(([value, label]) => {
          const isActive = manualEffect === value;
          return (
            <Pressable
              key={label}
              onPress={() => onSetManualEffect(value)}
              style={[styles.debugButton, isActive ? styles.debugButtonActive : null]}>
              <Text style={[styles.debugButtonText, isActive ? styles.debugButtonTextActive : null]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function NativeWeatherLayer() {
  const { width, height } = useWindowDimensions();
  const [weatherEffect, setWeatherEffect] = useState<WeatherEffect>(null);
  const { manualEffect, weatherEnabled, weatherMood, weatherParticleClarity } = useWeatherControlState();
  const rendererOverride = process.env.EXPO_PUBLIC_WEATHER_RENDERER;
  const weatherRenderer: WeatherRenderer =
    rendererOverride === 'skia' || rendererOverride === 'legacy' ? rendererOverride : 'legacy';
  const resolvedEffect = weatherEnabled
    ? manualEffect === 'auto'
      ? weatherEffect
      : manualEffect
    : null;

  useEffect(() => {
    let cancelled = false;

    const loadWeather = async () => {
      try {
        const snapshot = await fetchWeatherSnapshot();
        if (!cancelled) {
          setWeatherEffect(snapshot.effect);
        }
      } catch (error) {
        console.log('Failed to fetch weather for native effect:', error);
      }
    };

    loadWeather();
    const interval = setInterval(loadWeather, WEATHER_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    updateWeatherLiveState({
      weatherEffect,
      weatherRenderer,
    });
  }, [weatherEffect, weatherRenderer]);

  return (
    <WeatherOverlay
      effect={resolvedEffect}
      mood={weatherMood}
      particleClarity={weatherParticleClarity}
      width={width}
      height={height}
      renderer={weatherRenderer}
    />
  );
}

export function NativeWeatherDebugPanel() {
  const { manualEffect, setManualEffect } = useWeatherControlState();
  const { weatherEffect, weatherRenderer } = useWeatherLiveState();

  if (!__DEV__) {
    return null;
  }

  return (
    <WeatherDebugPanel
      manualEffect={manualEffect}
      weatherEffect={weatherEffect}
      weatherRenderer={weatherRenderer}
      onSetManualEffect={setManualEffect}
    />
  );
}

const styles = StyleSheet.create({
  debugPanel: {
    position: 'absolute',
    top: 58,
    right: 12,
    zIndex: 40,
    width: 252,
    borderRadius: 12,
    padding: 10,
    gap: 6,
    backgroundColor: 'rgba(16, 22, 31, 0.76)',
  },
  debugTitle: {
    color: '#f1f6ff',
    fontSize: 12,
    fontWeight: '700',
  },
  debugSubtitle: {
    color: 'rgba(222, 234, 249, 0.9)',
    fontSize: 11,
  },
  debugButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  debugButton: {
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(167, 188, 214, 0.35)',
    backgroundColor: 'rgba(112, 134, 160, 0.22)',
  },
  debugButtonActive: {
    borderColor: 'rgba(178, 219, 255, 0.9)',
    backgroundColor: 'rgba(87, 171, 255, 0.35)',
  },
  debugButtonText: {
    color: '#dde9f7',
    fontSize: 11,
    fontWeight: '600',
  },
  debugButtonTextActive: {
    color: '#f4f9ff',
  },
  rainDrop: {
    position: 'absolute',
    top: -120,
    width: 2.2,
    borderRadius: 2.6,
    backgroundColor: 'rgba(176, 216, 255, 0.86)',
  },
  snowFlake: {
    position: 'absolute',
    top: -32,
    backgroundColor: 'rgba(246, 251, 255, 0.98)',
    shadowColor: '#ffffff',
    shadowOpacity: 0.75,
    shadowRadius: 2,
  },
  thunderFlash: {
    backgroundColor: 'rgba(222, 235, 251, 0.44)',
  },
  thunderFlashDreamy: {
    backgroundColor: 'rgba(237, 245, 255, 0.36)',
  },
  thunderFlashCinematic: {
    backgroundColor: 'rgba(204, 224, 248, 0.62)',
  },
  moodTint: {
    ...StyleSheet.absoluteFillObject,
  },
  moodTintDreamy: {
    backgroundColor: 'rgba(122, 174, 238, 0.08)',
  },
  moodTintCinematic: {
    backgroundColor: 'rgba(20, 31, 48, 0.16)',
  },
  snowGround: {
    position: 'absolute',
    right: -10,
    left: -10,
    bottom: -8,
    height: 34,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  snowGroundHighlight: {
    position: 'absolute',
    right: -6,
    left: -6,
    bottom: -8,
    height: 16,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  snowGroundDreamy: {
    backgroundColor: 'rgba(246, 251, 255, 0.34)',
  },
  snowGroundCinematic: {
    backgroundColor: 'rgba(198, 215, 235, 0.2)',
  },
  snowLandingPuff: {
    position: 'absolute',
    bottom: 14,
    backgroundColor: 'rgba(244, 251, 255, 0.92)',
    borderWidth: 0.9,
    borderColor: 'rgba(236, 247, 255, 0.82)',
    shadowColor: '#f3f9ff',
    shadowOpacity: 0.52,
    shadowRadius: 3.4,
  },
  rainSplash: {
    position: 'absolute',
    height: 2.4,
    backgroundColor: 'rgba(196, 225, 255, 0.88)',
  },
  rainSprayDrop: {
    position: 'absolute',
    backgroundColor: 'rgba(203, 230, 255, 0.9)',
  },
  thunderAfterglow: {
    backgroundColor: 'rgba(166, 195, 231, 0.18)',
  },
});
