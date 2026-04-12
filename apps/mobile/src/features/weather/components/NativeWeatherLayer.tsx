import Constants from 'expo-constants';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SkiaWeatherOverlay } from '../SkiaWeatherOverlay';

const WEATHER_REFRESH_MS = 30 * 60 * 1000;
const FOOTER_IMPACT_OFFSET = 72;
const SEOUL_WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=weather_code&forecast_days=1&timezone=auto';

type WeatherEffect = 'rain' | 'snow' | 'thunder' | null;
type WeatherMood = 'dreamy' | 'cinematic';

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

async function fetchWeatherEffect(): Promise<WeatherEffect> {
  const response = await fetch(SEOUL_WEATHER_URL);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }
  const data = (await response.json()) as { current?: { weather_code?: number } };
  const weatherCode = data.current?.weather_code;
  if (typeof weatherCode !== 'number') {
    throw new Error('Missing weather_code');
  }
  return weatherCodeToEffect(weatherCode);
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

function AnimatedRainGlassDrop({
  left,
  top = 0,
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

  const travelDistance = Math.min(140, viewportHeight * 0.22) + size;
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-size * 0.4, travelDistance],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, drift, drift * 0.4],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0.92, 1.03, 1.08],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.1, 0.88, 1],
    outputRange: [0, baseOpacity, baseOpacity * 0.82, 0],
  });

  return (
    <Animated.View
      style={[
        styles.rainGlassDrop,
        {
          left,
          top,
          width: size * 0.56,
          height: size,
          borderRadius: size * 0.5,
          opacity,
          transform: [{ translateY }, { translateX }, { scale }],
        },
      ]}>
      <View
        style={[
          styles.rainGlassHighlight,
          {
            width: size * 0.17,
            borderRadius: size * 0.08,
          },
        ]}
      />
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
    outputRange: [0, -8, -14],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0.45, 1, 1.28],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, baseOpacity, 0],
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
          transform: [{ translateY }, { scale }],
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
  width,
  height,
  renderer,
}: {
  effect: WeatherEffect;
  mood: WeatherMood;
  width: number;
  height: number;
  renderer: 'legacy' | 'skia';
}) {
  const useSkiaRenderer = renderer === 'skia';
  const [skiaFailed, setSkiaFailed] = useState(false);
  const impactBottomOffset = Math.max(14, FOOTER_IMPACT_OFFSET - height * 0.01);
  const rainParticles = useMemo<Particle[]>(() => {
    if (effect !== 'rain' && effect !== 'thunder') {
      return [];
    }
    const isCinematic = mood === 'cinematic';
    const count = isCinematic ? 80 : 68;
    return Array.from({ length: count }, () => ({
      left: Math.random() * width,
      delay: Math.random() * 2200,
      duration: (isCinematic ? 580 : 760) + Math.random() * (isCinematic ? 520 : 760),
      size: 18 + Math.random() * 30,
      opacity: (isCinematic ? 0.26 : 0.32) + Math.random() * (isCinematic ? 0.36 : 0.38),
      drift: (Math.random() - 0.5) * (isCinematic ? 20 : 26),
      width: 1 + Math.random() * 1.4,
    }));
  }, [effect, mood, width]);
  const snowFarParticles = useMemo<Particle[]>(() => {
    if (effect !== 'snow') {
      return [];
    }
    const isCinematic = mood === 'cinematic';
    const count = isCinematic ? 26 : 34;
    return Array.from({ length: count }, () => ({
      left: Math.random() * width,
      delay: Math.random() * 2600,
      duration: (isCinematic ? 6600 : 7600) + Math.random() * (isCinematic ? 3400 : 4200),
      size: 2 + Math.random() * 4,
      opacity: (isCinematic ? 0.16 : 0.22) + Math.random() * (isCinematic ? 0.22 : 0.26),
      drift: (isCinematic ? 6 : 8) + Math.random() * (isCinematic ? 8 : 10),
    }));
  }, [effect, mood, width]);
  const snowNearParticles = useMemo<Particle[]>(() => {
    if (effect !== 'snow') {
      return [];
    }
    const isCinematic = mood === 'cinematic';
    const count = isCinematic ? 30 : 38;
    return Array.from({ length: count }, () => ({
      left: Math.random() * width,
      delay: Math.random() * 2200,
      duration: (isCinematic ? 4600 : 5600) + Math.random() * (isCinematic ? 2600 : 3400),
      size: 4 + Math.random() * 8,
      opacity: (isCinematic ? 0.32 : 0.38) + Math.random() * (isCinematic ? 0.42 : 0.5),
      drift: (isCinematic ? 10 : 12) + Math.random() * (isCinematic ? 12 : 16),
    }));
  }, [effect, mood, width]);
  const rainGlassDrops = useMemo<Particle[]>(() => {
    if (effect !== 'rain' && effect !== 'thunder') {
      return [];
    }
    const isCinematic = mood === 'cinematic';
    const count = isCinematic ? 16 : 22;
    return Array.from({ length: count }, () => ({
      left: Math.random() * width,
      top: 24 + Math.random() * Math.max(80, height * 0.52),
      delay: Math.random() * 3200,
      duration: (isCinematic ? 2200 : 2600) + Math.random() * (isCinematic ? 2000 : 2400),
      size: (isCinematic ? 9 : 11) + Math.random() * (isCinematic ? 10 : 12),
      opacity: (isCinematic ? 0.18 : 0.22) + Math.random() * (isCinematic ? 0.2 : 0.24),
      drift: (Math.random() - 0.5) * (isCinematic ? 8 : 12),
    }));
  }, [effect, mood, width, height]);
  const snowLandingPuffs = useMemo<Particle[]>(() => {
    if (effect !== 'snow') {
      return [];
    }
    const isCinematic = mood === 'cinematic';
    const count = isCinematic ? 12 : 18;
    return Array.from({ length: count }, () => ({
      left: Math.random() * width,
      delay: Math.random() * 2600,
      duration: (isCinematic ? 1300 : 1500) + Math.random() * 1300,
      size: (isCinematic ? 7 : 9) + Math.random() * 10,
      opacity: (isCinematic ? 0.2 : 0.24) + Math.random() * 0.25,
      drift: 0,
    }));
  }, [effect, mood, width]);
  const rainSplashes = useMemo<Particle[]>(() => {
    if (effect !== 'rain' && effect !== 'thunder') {
      return [];
    }
    const isCinematic = mood === 'cinematic';
    const count = isCinematic ? 20 : 28;
    return Array.from({ length: count }, () => ({
      left: Math.random() * width,
      delay: Math.random() * 1600,
      duration: (isCinematic ? 900 : 1100) + Math.random() * 900,
      size: (isCinematic ? 7 : 9) + Math.random() * 8,
      opacity: (isCinematic ? 0.14 : 0.2) + Math.random() * 0.24,
      drift: 0,
    }));
  }, [effect, mood, width]);
  const rainSprays = useMemo<Particle[]>(() => {
    if (effect !== 'rain' && effect !== 'thunder') {
      return [];
    }
    const isCinematic = mood === 'cinematic';
    const count = isCinematic ? 14 : 20;
    return Array.from({ length: count }, () => ({
      left: Math.random() * width,
      delay: Math.random() * 1800,
      duration: (isCinematic ? 760 : 880) + Math.random() * 760,
      size: (isCinematic ? 5 : 6) + Math.random() * 6,
      opacity: (isCinematic ? 0.16 : 0.2) + Math.random() * 0.2,
      drift: 4 + Math.random() * 8,
    }));
  }, [effect, mood, width]);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const afterGlowOpacity = useRef(new Animated.Value(0)).current;
  const snowGroundOpacity = useRef(new Animated.Value(0)).current;
  const thunderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (effect !== 'thunder') {
      flashOpacity.setValue(0);
      return;
    }

    const scheduleNextFlash = () => {
      const strikeCount = Math.random() > 0.66 ? 3 : Math.random() > 0.35 ? 2 : 1;
      const flashSequence: Animated.CompositeAnimation[] = [];

      for (let i = 0; i < strikeCount; i += 1) {
        const intensityBase = mood === 'cinematic' ? 0.52 : 0.4;
        const intensity = intensityBase + Math.random() * (mood === 'cinematic' ? 0.24 : 0.18);
        flashSequence.push(
          Animated.timing(flashOpacity, {
            toValue: intensity,
            duration: 60 + Math.floor(Math.random() * 45),
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(flashOpacity, {
            toValue: 0,
            duration: 130 + Math.floor(Math.random() * 130),
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(afterGlowOpacity, {
            toValue: Math.max(0.08, intensity * 0.24),
            duration: 70 + Math.floor(Math.random() * 50),
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(afterGlowOpacity, {
            toValue: 0,
            duration: 260 + Math.floor(Math.random() * 260),
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          })
        );
        if (i < strikeCount - 1) {
          flashSequence.push(Animated.delay(55 + Math.floor(Math.random() * 85)));
        }
      }

      Animated.sequence(flashSequence).start(({ finished }) => {
        if (!finished || effect !== 'thunder') {
          return;
        }
        const nextDelay =
          (mood === 'cinematic' ? 2200 : 3200) + Math.floor(Math.random() * 6200);
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
  }, [effect, mood, flashOpacity, afterGlowOpacity]);

  useEffect(() => {
    Animated.timing(snowGroundOpacity, {
      toValue: effect === 'snow' ? 1 : 0,
      duration: effect === 'snow' ? 750 : 420,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [effect, snowGroundOpacity]);

  if (!effect) {
    return null;
  }

  if (useSkiaRenderer && !skiaFailed) {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <SkiaWeatherOverlay
          effect={effect}
          mood={mood}
          width={width}
          height={height}
          impactBottomOffset={impactBottomOffset}
          onRenderFail={() => setSkiaFailed(true)}
        />
        {effect === 'snow' ? (
          <Animated.View
            style={[
              styles.snowGround,
              mood === 'cinematic' ? styles.snowGroundCinematic : styles.snowGroundDreamy,
              { opacity: snowGroundOpacity },
            ]}
          />
        ) : null}
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
      {(effect === 'rain' || effect === 'thunder') &&
        rainParticles.map((particle, index) => (
          <AnimatedRainDrop key={`rain-${index}`} {...particle} viewportHeight={height} />
        ))}
      {(effect === 'rain' || effect === 'thunder') &&
        rainGlassDrops.map((particle, index) => (
          <AnimatedRainGlassDrop key={`glass-${index}`} {...particle} viewportHeight={height} />
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
        <Animated.View
          style={[
            styles.snowGround,
            mood === 'cinematic' ? styles.snowGroundCinematic : styles.snowGroundDreamy,
            { opacity: snowGroundOpacity },
          ]}
        />
      ) : null}
      {effect === 'snow' &&
        snowLandingPuffs.map((particle, index) => (
          <AnimatedSnowLandingPuff
            key={`snow-puff-${index}`}
            {...particle}
            bottomOffset={impactBottomOffset}
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

export function NativeWeatherLayer() {
  const { width, height } = useWindowDimensions();
  const [weatherEffect, setWeatherEffect] = useState<WeatherEffect>(null);
  const [weatherRenderer] = useState<'legacy' | 'skia'>(
    Constants.executionEnvironment === 'storeClient' ? 'legacy' : 'skia'
  );
  const weatherMood: WeatherMood = 'dreamy';

  useEffect(() => {
    let cancelled = false;

    const loadWeather = async () => {
      try {
        const effect = await fetchWeatherEffect();
        if (!cancelled) {
          setWeatherEffect(effect);
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

  return (
    <>
      <WeatherOverlay
        effect={weatherEffect}
        mood={weatherMood}
        width={width}
        height={height}
        renderer={weatherRenderer}
      />
    </>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(229, 239, 255, 0.92)',
  },
  thunderFlashDreamy: {
    backgroundColor: 'rgba(226, 238, 255, 0.82)',
  },
  thunderFlashCinematic: {
    backgroundColor: 'rgba(224, 236, 255, 0.97)',
  },
  rainGlassDrop: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(198, 228, 255, 0.34)',
    backgroundColor: 'rgba(189, 223, 255, 0.14)',
  },
  rainGlassHighlight: {
    position: 'absolute',
    top: '12%',
    left: '22%',
    height: '45%',
    backgroundColor: 'rgba(246, 252, 255, 0.36)',
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
  snowGroundDreamy: {
    backgroundColor: 'rgba(241, 248, 255, 0.28)',
  },
  snowGroundCinematic: {
    backgroundColor: 'rgba(223, 236, 250, 0.24)',
  },
  snowLandingPuff: {
    position: 'absolute',
    bottom: 14,
    backgroundColor: 'rgba(247, 252, 255, 0.82)',
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
    backgroundColor: 'rgba(191, 216, 248, 0.2)',
  },
});
