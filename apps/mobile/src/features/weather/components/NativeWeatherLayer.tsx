import { useEffect, useMemo, useRef, useState } from 'react';
import * as ExpoLocation from 'expo-location';
import {
  Animated,
  AppState,
  type AppStateStatus,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SkiaWeatherOverlay } from '../SkiaWeatherOverlay';
import { PAPER_FOG_HEIGHT_RATIO, PAPER_FOG_Y_RATIOS, PAPER_WEATHER_COLORS } from '../paperWeatherArtwork';
import { PaperRainMark, PaperSnowMark } from './PaperWeatherMarks';
import { PaperFogMark } from './PaperFogMarks';
import { usePaperFogDrift } from '../hooks/usePaperFogDrift';
import { PAPER_FOG_TRAVEL_MARGIN } from '../paperFogMotion';
import type { WebWeatherVisualState } from '../hooks/useWebWeatherBridge';

const WEATHER_REFRESH_MS = 30 * 60 * 1000;
const FOOTER_IMPACT_OFFSET = 52;
const GROUND_EFFECT_LOWER_OFFSET = 26;
const SEOUL_WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=weather_code&forecast_days=1&timezone=auto';

type WeatherEffect = 'rain' | 'snow' | 'thunder' | 'fog' | null;
type WeatherMood = 'dreamy' | 'cinematic';
type WeatherRenderer = 'legacy' | 'skia';

type WeatherControlState = {
  weatherEnabled: boolean;
  weatherMood: WeatherMood;
  weatherParticleClarity: number;
};

const DEFAULT_WEATHER_CONTROL_STATE: WeatherControlState = {
  weatherEnabled: true,
  weatherMood: 'dreamy',
  weatherParticleClarity: 70,
};

let weatherControlState: WeatherControlState = DEFAULT_WEATHER_CONTROL_STATE;
const weatherControlListeners = new Set<(state: WeatherControlState) => void>();

function updateWeatherControlState(patch: Partial<WeatherControlState>) {
  weatherControlState = {
    ...weatherControlState,
    ...patch,
  };
  weatherControlListeners.forEach((listener) => listener(weatherControlState));
}

function useWeatherControlState() {
  const [state, setState] = useState<WeatherControlState>(weatherControlState);

  useEffect(() => {
    weatherControlListeners.add(setState);
    return () => {
      weatherControlListeners.delete(setState);
    };
  }, []);

  return {
    weatherEnabled: state.weatherEnabled,
    weatherMood: state.weatherMood,
    weatherParticleClarity: state.weatherParticleClarity,
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

type Particle = {
  left: number;
  top?: number;
  delay: number;
  duration: number;
  size: number;
  opacity: number;
  drift: number;
  width?: number;
  /** 안개 입자에만 사용한다. true이면 작은 진한 안개 덩어리로 표시한다. */
  foreground?: boolean;
  /** 안개가 다음에 진입할 높이를 결정하는 난수 시드다. */
  seed?: number;
  /** 안개 첫 통과의 시작 위치(0~1). 띠별 진입 시점을 분산한다. */
  initialPhase?: number;
};

const EMPTY_PARTICLES: Particle[] = [];
const PARTICLE_CACHE_MAX_ENTRIES = 96;
const particleCache = new Map<string, Particle[]>();

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getCachedParticles(key: string, builder: () => Particle[]) {
  const cached = particleCache.get(key);
  if (cached) {
    return cached;
  }

  const created = builder();
  particleCache.set(key, created);

  if (particleCache.size > PARTICLE_CACHE_MAX_ENTRIES) {
    const oldestKey = particleCache.keys().next().value;
    if (oldestKey) {
      particleCache.delete(oldestKey);
    }
  }

  return created;
}

function weatherCodeToEffect(code: number): WeatherEffect {
  if (code >= 95 && code <= 99) {
    return 'thunder';
  }
  if (code === 3 || code === 45 || code === 48) {
    return 'fog';
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return 'snow';
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return 'rain';
  }
  return null;
}

function loadExpoLocationModule() {
  return ExpoLocation;
}

async function hasLocationPermissionGranted(): Promise<boolean> {
  const expoLocation = loadExpoLocationModule();
  if (!expoLocation?.getForegroundPermissionsAsync) {
    return false;
  }

  try {
    const result = await expoLocation.getForegroundPermissionsAsync();
    return Boolean(result.granted || result.status === 'granted');
  } catch (error) {
    console.log('Failed to check location permission for native weather:', error);
    return false;
  }
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

/** 종이 물방울을 화면 아래로 이동한다. 지연 후 반복하며 해제 시 예약과 애니메이션을 멈춘다. */
function AnimatedRainDrop({
  left,
  delay,
  duration,
  size,
  opacity: baseOpacity,
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
    outputRange: [-120, viewportHeight + 120],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [0, drift * 0.35, drift, drift * 1.2],
  });
  const rotate = '-7deg';
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
          width: size,
          opacity,
          transform: [{ translateY }, { translateX }, { rotate }],
        },
      ]}>
      <PaperRainMark size={size} />
    </Animated.View>
  );
}

/** 종이 눈 입자를 좌우로 흔들며 낙하시킨다. size가 큰 입자는 여섯 갈래 모양으로 표시한다. */
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
          opacity: animatedOpacity,
          transform: [{ translateY }, { translateX }, { rotate }, { scale }],
        },
      ]}>
      <PaperSnowMark size={size} />
    </Animated.View>
  );
}

function AnimatedSnowLandingPuff({
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
  const speckDirection = useRef(Math.random() > 0.5 ? 1 : -1).current;

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
    outputRange: [1, -4, -10],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0.35, 0.95, 1.22],
  });
  const scaleX = progress.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0.45, 1.06, 1.34],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 0.55, 1],
    outputRange: [0, baseOpacity * 0.95, baseOpacity * 0.5, 0],
  });
  const spread = Math.max(size * 0.14, drift * 0.55);
  const speckX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, spread * speckDirection],
  });
  const speckLift = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -(size * 0.36), -(size * 0.72)],
  });
  const speckOpacity = progress.interpolate({
    inputRange: [0, 0.12, 0.7, 1],
    outputRange: [0, baseOpacity * 0.6, baseOpacity * 0.24, 0],
  });
  const speckScale = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0.72, 0.96, 1.05],
  });
  const speckSize = Math.max(1.2, size * 0.16);

  return (
    <>
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
      <Animated.View
        style={[
          styles.snowLandingSpeck,
          {
            left,
            bottom: bottomOffset + 1,
            width: speckSize,
            height: speckSize,
            borderRadius: speckSize * 0.5,
            opacity: speckOpacity,
            transform: [{ translateY: speckLift }, { translateX: speckX }, { scale: speckScale }],
          },
        ]}
      />
    </>
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

/** Skia 실패 시 안개 그림을 표시한다. 화면 통과와 다음 그림의 높이 변경은 usePaperFogDrift에 맡긴다. */
function AnimatedFogPatch({
  top = 0,
  delay,
  duration,
  opacity: baseOpacity,
  width: customWidth,
  seed = 0,
  initialPhase = 0,
  foreground = false,
  viewportWidth,
  viewportHeight,
}: Particle & { viewportWidth: number; viewportHeight: number }) {
  const fogWidth = customWidth ?? viewportWidth * 1.5;
  const fogHeight = fogWidth * PAPER_FOG_HEIGHT_RATIO;
  const { translateX, translateY, opacity, top: animatedTop } = usePaperFogDrift({
    width: fogWidth,
    viewportWidth,
    viewportHeight,
    baseYRatio: (top + fogHeight * 0.5) / Math.max(1, viewportHeight),
    seed,
    initialPhase,
    duration,
    delay,
    alpha: baseOpacity,
  });

  return (
    <Animated.View
      style={[
        styles.fogPatchWrap,
        {
          left: 0,
          top: animatedTop,
          height: fogHeight,
          width: fogWidth,
          opacity,
          transform: [{ translateX }, { translateY }],
        },
      ]}
    >
      <PaperFogMark width={fogWidth} foreground={foreground} />
    </Animated.View>
  );
}

/** 무드·선명도에 맞춰 날씨 입자를 구성하고, Skia 렌더링 실패 시 기본 애니메이션으로 표시한다. */
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
  const useSkiaRenderer = renderer === 'skia' || effect === 'fog';
  const [skiaFailed, setSkiaFailed] = useState(false);
  const impactBottomOffset = Math.max(2, FOOTER_IMPACT_OFFSET - height * 0.01 - GROUND_EFFECT_LOWER_OFFSET);
  const isCinematic = mood === 'cinematic';
  const clarityRatio = clamp(particleClarity, 0, 100) / 100;
  const clarityAlphaScale = 0.45 + clarityRatio * 1.2;
  const clarityCountScale = 0.7 + clarityRatio * 0.65;
  const clarityThicknessScale = 0.7 + clarityRatio * 0.95;
  const claritySpeedScale = 0.85 + clarityRatio * 0.35;
  const moodTintOpacity = 0.8 + (1 - clarityRatio) * 0.6;
  const normalizedWidth = Math.round(width);
  const normalizedClarity = clamp(Math.round(particleClarity), 0, 100);
  const profileBaseKey = `${effect ?? 'clear'}:${mood}:${normalizedClarity}:${normalizedWidth}`;

  const rainParticles = useMemo<Particle[]>(() => {
    if (effect !== 'rain' && effect !== 'thunder') {
      return EMPTY_PARTICLES;
    }
    return getCachedParticles(`${profileBaseKey}:paper-rain`, () => {
      const baseCount = isCinematic ? 16 : 24;
      const count = Math.max(8, Math.round(baseCount * clarityCountScale));
      return Array.from({ length: count }, () => ({
        left: Math.random() * width,
        delay: Math.random() * 2200,
        duration:
          ((isCinematic ? 3200 : 4200) + Math.random() * 1800) / claritySpeedScale,
        size: ((isCinematic ? 9 : 10) + Math.random() * 5) * clarityThicknessScale,
        opacity: clamp(
          ((isCinematic ? 0.2 : 0.28) + Math.random() * 0.14) * clarityAlphaScale,
          0.03,
          0.95
        ),
        drift: (isCinematic ? 8.5 : 11.5) + (Math.random() - 0.5) * (isCinematic ? 1.8 : 2.6),
      }));
    });
  }, [clarityAlphaScale, clarityCountScale, claritySpeedScale, clarityThicknessScale, effect, isCinematic, profileBaseKey, width]);
  const snowFarParticles = useMemo<Particle[]>(() => {
    if (effect !== 'snow') {
      return EMPTY_PARTICLES;
    }
    return getCachedParticles(`${profileBaseKey}:snow-far`, () => {
      const baseCount = isCinematic ? 8 : 12;
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
    });
  }, [clarityAlphaScale, clarityCountScale, claritySpeedScale, effect, isCinematic, profileBaseKey, width]);
  const snowNearParticles = useMemo<Particle[]>(() => {
    if (effect !== 'snow') {
      return EMPTY_PARTICLES;
    }
    return getCachedParticles(`${profileBaseKey}:snow-near`, () => {
      const baseCount = isCinematic ? 10 : 16;
      const count = Math.max(8, Math.round(baseCount * clarityCountScale));
      return Array.from({ length: count }, () => ({
        left: Math.random() * width,
        delay: Math.random() * 2200,
        duration:
          ((isCinematic ? 10000 : 13000) + Math.random() * 5000) / claritySpeedScale,
        size: (isCinematic ? 8 : 9) + Math.random() * 5,
        opacity: clamp(
          ((isCinematic ? 0.24 : 0.32) + Math.random() * 0.14) * clarityAlphaScale,
          0.04,
          0.95
        ),
        drift: (isCinematic ? 6 : 12) + Math.random() * (isCinematic ? 6 : 14),
      }));
    });
  }, [clarityAlphaScale, clarityCountScale, claritySpeedScale, effect, isCinematic, profileBaseKey, width]);
  const snowLandingPuffs = useMemo<Particle[]>(() => {
    if (effect !== 'snow') {
      return EMPTY_PARTICLES;
    }
    return getCachedParticles(`${profileBaseKey}:snow-puff`, () => {
      const baseCount = isCinematic ? 4 : 7;
      const count = Math.max(3, Math.round(baseCount * clarityCountScale));
      return Array.from({ length: count }, () => ({
        left: Math.random() * width,
        delay: Math.random() * 2200,
        duration:
          ((isCinematic ? 980 : 1220) + Math.random() * (isCinematic ? 780 : 980)) / claritySpeedScale,
        size: (isCinematic ? 6 : 9) + Math.random() * (isCinematic ? 7 : 11),
        opacity: clamp(
          ((isCinematic ? 0.08 : 0.13) + Math.random() * (isCinematic ? 0.08 : 0.1)) * clarityAlphaScale,
          0.05,
          0.62
        ),
        drift: (isCinematic ? 1.8 : 2.4) + Math.random() * (isCinematic ? 1.8 : 2.6),
      }));
    });
  }, [clarityAlphaScale, clarityCountScale, claritySpeedScale, effect, isCinematic, profileBaseKey, width]);
  const rainSplashes = useMemo<Particle[]>(() => {
    if (effect !== 'rain' && effect !== 'thunder') {
      return EMPTY_PARTICLES;
    }
    return getCachedParticles(`${profileBaseKey}:rain-splash`, () => {
      const baseCount = isCinematic ? 4 : 7;
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
    });
  }, [clarityAlphaScale, clarityCountScale, claritySpeedScale, effect, isCinematic, profileBaseKey, width]);
  const rainSprays = useMemo<Particle[]>(() => {
    if (effect !== 'rain' && effect !== 'thunder') {
      return EMPTY_PARTICLES;
    }
    return getCachedParticles(`${profileBaseKey}:rain-spray`, () => {
      const baseCount = isCinematic ? 3 : 5;
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
    });
  }, [clarityAlphaScale, clarityCountScale, claritySpeedScale, effect, isCinematic, profileBaseKey, width]);
  const fogPatches = useMemo<Particle[]>(() => {
    if (effect !== 'fog' || (useSkiaRenderer && !skiaFailed)) {
      return EMPTY_PARTICLES;
    }
    return getCachedParticles(`${profileBaseKey}:${Math.round(height)}:paper-puff-fog`, () => {
      const count = PAPER_FOG_Y_RATIOS.length;
      const fogAlphaScale = 0.7 + clarityRatio * 0.55;
      return Array.from({ length: count }, (_, index) => {
        const foreground = index % 2 === 1;
        const fogWidth = width * (foreground ? 0.3 + Math.random() * 0.09 : 0.4 + Math.random() * 0.12);
        const speed = (foreground ? 18 : isCinematic ? 11 : 13) + Math.random() * 5;
        const alphaBase = foreground
          ? (isCinematic ? 0.48 : 0.56) + Math.random() * 0.08
          : (isCinematic ? 0.3 : 0.36) + Math.random() * 0.055;
        return {
          left: 0,
          top: height * (PAPER_FOG_Y_RATIOS[index] + (Math.random() - 0.5) * 0.035) - fogWidth * PAPER_FOG_HEIGHT_RATIO * 0.5,
          delay: Math.random() * 800,
          duration: (width + fogWidth + PAPER_FOG_TRAVEL_MARGIN * 2) / speed * 1000,
          size: fogWidth * PAPER_FOG_HEIGHT_RATIO,
          opacity: clamp(
            alphaBase * fogAlphaScale,
            0.08,
            foreground ? 0.74 : 0.5
          ),
          drift: 0,
          width: fogWidth,
          foreground,
          seed: (index + 1) * 17.71,
          initialPhase: (index + Math.random() * 0.4) / count,
        };
      });
    });
  }, [clarityRatio, effect, height, isCinematic, profileBaseKey, skiaFailed, useSkiaRenderer, width]);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const afterGlowOpacity = useRef(new Animated.Value(0)).current;
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

  const snowImpactBottomOffset = Math.max(1, impactBottomOffset - 14);

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
            bottomOffset={snowImpactBottomOffset}
          />
        ))}
      {(effect === 'rain' || effect === 'thunder') &&
        rainSprays.map((particle, index) => (
          <AnimatedRainSpray
            key={`rain-spray-${index}`}
            {...particle}
            bottomOffset={snowImpactBottomOffset}
          />
        ))}
      {effect === 'fog' &&
        fogPatches.map((particle, index) => (
          <AnimatedFogPatch key={`fog-${index}`} {...particle} viewportWidth={width} viewportHeight={height} />
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

/**
 * 위치 날씨와 앱 설정으로 효과를 결정한다. renderWeatherInWeb이면 비·눈·안개는 직접 그리지 않고
 * onWeatherVisualStateChange로 결과를 전달해 웹의 종이 배경과 콘텐츠 사이에서 표시하게 한다.
 */
export function NativeWeatherLayer({
  renderWeatherInWeb = false,
  onWeatherVisualStateChange,
}: {
  renderWeatherInWeb?: boolean;
  onWeatherVisualStateChange?: (state: WebWeatherVisualState) => void;
}) {
  const { width, height } = useWindowDimensions();
  const [weatherEffect, setWeatherEffect] = useState<WeatherEffect>(null);
  const [overlayResetKey, setOverlayResetKey] = useState(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const [isAppActive, setIsAppActive] = useState(appStateRef.current === 'active');
  const overlayOpacity = useRef(new Animated.Value(appStateRef.current === 'active' ? 1 : 0)).current;
  const overlayFadeAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const { weatherEnabled, weatherMood, weatherParticleClarity } = useWeatherControlState();
  const rendererOverride = process.env.EXPO_PUBLIC_WEATHER_RENDERER;
  const weatherRenderer: WeatherRenderer =
    rendererOverride === 'skia' || rendererOverride === 'legacy' ? rendererOverride : 'legacy';
  const resolvedEffect = weatherEnabled && isAppActive ? weatherEffect : null;
  const effectiveRenderer: WeatherRenderer =
    resolvedEffect === 'fog' || resolvedEffect === 'snow' ? 'skia' : weatherRenderer;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      const nextIsActive = nextState === 'active';
      setIsAppActive(nextIsActive);

      if (nextIsActive && previousState !== 'active') {
        particleCache.clear();
        setOverlayResetKey((prev) => prev + 1);
        overlayFadeAnimationRef.current?.stop();
        overlayOpacity.setValue(0);
        overlayFadeAnimationRef.current = Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });
        overlayFadeAnimationRef.current.start(() => {
          overlayFadeAnimationRef.current = null;
        });
        return;
      }

      if (!nextIsActive) {
        overlayFadeAnimationRef.current?.stop();
        overlayOpacity.setValue(0);
      }
    });

    return () => {
      subscription.remove();
      overlayFadeAnimationRef.current?.stop();
    };
  }, [overlayOpacity]);

  useEffect(() => {
    let cancelled = false;

    const loadWeather = async () => {
      if (!weatherEnabled || !isAppActive) {
        if (!cancelled) {
          setWeatherEffect(null);
        }
        return;
      }

      const hasLocationPermission = await hasLocationPermissionGranted();
      if (!hasLocationPermission) {
        if (!cancelled) {
          setWeatherEffect(null);
        }
        return;
      }

      try {
        const snapshot = await fetchWeatherSnapshot();
        if (!cancelled) {
          setWeatherEffect(snapshot.effect);
        }
      } catch (error) {
        console.log('Failed to fetch weather for native effect:', error);
      }
    };

    void loadWeather();
    const interval = setInterval(() => {
      void loadWeather();
    }, WEATHER_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAppActive, weatherEnabled]);

  const webEffect = resolvedEffect === 'fog' || resolvedEffect === 'rain' || resolvedEffect === 'snow' ? resolvedEffect : null;
  // 설정과 앱 활성 상태를 반영한 최종 효과만 웹 배경에 전달한다.
  useEffect(() => {
    onWeatherVisualStateChange?.({
      effect: webEffect,
      mood: weatherMood,
      particleClarity: weatherParticleClarity,
    });
  }, [onWeatherVisualStateChange, webEffect, weatherMood, weatherParticleClarity]);

  if (renderWeatherInWeb && webEffect !== null) return null;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}>
      <WeatherOverlay
        key={`weather-overlay-${overlayResetKey}`}
        effect={resolvedEffect}
        mood={weatherMood}
        particleClarity={weatherParticleClarity}
        width={width}
        height={height}
        renderer={effectiveRenderer}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rainDrop: {
    position: 'absolute',
    top: -120,
    justifyContent: 'center',
  },
  snowFlake: {
    position: 'absolute',
    top: -32,
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
    backgroundColor: 'rgba(237, 216, 167, 0.015)',
  },
  moodTintCinematic: {
    backgroundColor: 'rgba(99, 91, 76, 0.035)',
  },
  snowLandingPuff: {
    position: 'absolute',
    bottom: 14,
    backgroundColor: PAPER_WEATHER_COLORS.snow,
    borderWidth: 0.9,
    borderColor: PAPER_WEATHER_COLORS.snowInk,
  },
  snowLandingSpeck: {
    position: 'absolute',
    backgroundColor: PAPER_WEATHER_COLORS.snow,
  },
  rainSplash: {
    position: 'absolute',
    height: 2.4,
    backgroundColor: PAPER_WEATHER_COLORS.rainInk,
  },
  rainSprayDrop: {
    position: 'absolute',
    backgroundColor: PAPER_WEATHER_COLORS.rainInk,
  },
  fogPatchWrap: {
    position: 'absolute',
  },
  thunderAfterglow: {
    backgroundColor: 'rgba(166, 195, 231, 0.18)',
  },
});
