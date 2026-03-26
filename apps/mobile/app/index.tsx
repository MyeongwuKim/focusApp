import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { embeddedWebUiFiles } from './embeddedWebUiBundle';

const BASE_WIDTH = 390;
const MIN_SCALE = 0.9;
const MAX_SCALE = 1.08;
const WEATHER_REFRESH_MS = 30 * 60 * 1000;
const SEOUL_WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=weather_code&forecast_days=1&timezone=auto';

type WeatherEffect = 'rain' | 'snow' | 'thunder' | null;
type WeatherMood = 'dreamy' | 'cinematic';

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

type Particle = {
  left: number;
  top?: number;
  delay: number;
  duration: number;
  size: number;
  opacity: number;
  drift: number;
};

function AnimatedRainDrop({
  left,
  delay,
  duration,
  size,
  opacity: baseOpacity,
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
    inputRange: [0, 0.5, 1],
    outputRange: [0, size * 0.08, 0],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.1, 0.9, 1],
    outputRange: [0, baseOpacity, baseOpacity, 0],
  });

  return (
    <Animated.View
      style={[
        styles.rainDrop,
        {
          left,
          height: size,
          width: Math.max(1.4, size * 0.085),
          opacity,
          transform: [{ translateY }, { translateX }],
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
    inputRange: [0, 0.5, 1],
    outputRange: [0, drift, -drift * 0.8],
  });
  const animatedOpacity = progress.interpolate({
    inputRange: [0, 0.08, 0.92, 1],
    outputRange: [0, opacity, opacity, 0],
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
          transform: [{ translateY }, { translateX }],
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
  delay,
  duration,
  size,
  opacity: baseOpacity,
}: Particle) {
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
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    />
  );
}

function WeatherOverlay({
  effect,
  mood,
  width,
  height,
}: {
  effect: WeatherEffect;
  mood: WeatherMood;
  width: number;
  height: number;
}) {
  const particles = useMemo<Particle[]>(() => {
    const isCinematic = mood === 'cinematic';
    const count = effect === 'snow' ? (isCinematic ? 28 : 34) : isCinematic ? 54 : 44;
    return Array.from({ length: count }, () => ({
      left: Math.random() * width,
      delay: Math.random() * 2200,
      duration:
        effect === 'snow'
          ? (isCinematic ? 4200 : 5200) + Math.random() * (isCinematic ? 2200 : 3000)
          : (isCinematic ? 700 : 840) + Math.random() * (isCinematic ? 620 : 820),
      size: effect === 'snow' ? 4 + Math.random() * 6 : 16 + Math.random() * 22,
      opacity:
        effect === 'snow'
          ? (isCinematic ? 0.28 : 0.4) + Math.random() * (isCinematic ? 0.42 : 0.55)
          : (isCinematic ? 0.45 : 0.35) + Math.random() * (isCinematic ? 0.48 : 0.5),
      drift: effect === 'snow' ? (isCinematic ? 5 : 7) + Math.random() * (isCinematic ? 7 : 12) : 0,
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
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const snowGroundOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (effect !== 'thunder') {
      flashOpacity.setValue(0);
      return;
    }

    const runFlash = () => {
      Animated.sequence([
        Animated.timing(flashOpacity, {
          toValue: mood === 'cinematic' ? 0.56 : 0.4,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flashOpacity, {
          toValue: 0,
          duration: 190,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(90),
        Animated.timing(flashOpacity, {
          toValue: mood === 'cinematic' ? 0.36 : 0.26,
          duration: 70,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flashOpacity, {
          toValue: 0,
          duration: 190,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    };

    runFlash();
    const interval = setInterval(
      runFlash,
      (mood === 'cinematic' ? 3600 : 4800) + Math.floor(Math.random() * 3200)
    );
    return () => {
      clearInterval(interval);
      flashOpacity.setValue(0);
    };
  }, [effect, mood, flashOpacity]);
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

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.weatherVignette,
          mood === 'cinematic' ? styles.weatherVignetteCinematic : styles.weatherVignetteDreamy,
        ]}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.weatherTopGlow,
          mood === 'cinematic' ? styles.weatherTopGlowCinematic : styles.weatherTopGlowDreamy,
        ]}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.weatherBottomHaze,
          mood === 'cinematic' ? styles.weatherBottomHazeCinematic : styles.weatherBottomHazeDreamy,
        ]}
      />
      {(effect === 'rain' || effect === 'thunder') &&
        particles.map((particle, index) => (
          <AnimatedRainDrop key={`rain-${index}`} {...particle} viewportHeight={height} />
        ))}
      {(effect === 'rain' || effect === 'thunder') &&
        rainGlassDrops.map((particle, index) => (
          <AnimatedRainGlassDrop key={`glass-${index}`} {...particle} viewportHeight={height} />
        ))}
      {effect === 'snow' &&
        particles.map((particle, index) => (
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
          <AnimatedSnowLandingPuff key={`snow-puff-${index}`} {...particle} />
        ))}
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

export default function WebViewScreen() {
  const [localFileUri, setLocalFileUri] = useState<string | null>(null);
  const [isPreparingLocalFile, setIsPreparingLocalFile] = useState(true);
  const [weatherEffect, setWeatherEffect] = useState<WeatherEffect>(null);
  const weatherMood: WeatherMood = 'dreamy';
  const webViewRef = useRef<WebView>(null);
  const { width, height } = useWindowDimensions();

  const uiScale = useMemo(() => {
    const rawScale = width / BASE_WIDTH;
    return clamp(rawScale, MIN_SCALE, MAX_SCALE);
  }, [width]);

  const applyScaleScript = useMemo(
    () =>
      `(() => { document.documentElement.style.setProperty('--ui-scale', '${uiScale.toFixed(3)}'); })(); true;`,
    [uiScale]
  );

  useEffect(() => {
    const prepareLocalHtmlFile = async () => {
      try {
        const baseDir = `${FileSystem.cacheDirectory}web-ui/`;
        const fileUri = `${baseDir}index.html`;

        for (const file of embeddedWebUiFiles) {
          const targetUri = `${baseDir}${file.path}`;
          const targetDir = targetUri.slice(0, targetUri.lastIndexOf('/') + 1);

          await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
          await FileSystem.writeAsStringAsync(targetUri, file.contentBase64, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }

        let currentHtml = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        currentHtml = currentHtml
          .replace(/<script\s+type="module"\s+crossorigin/gi, '<script defer')
          .replace(/<script\s+type="module"/gi, '<script defer')
          .replace(/\s+crossorigin(?=[\s>])/gi, '');
        await FileSystem.writeAsStringAsync(fileUri, currentHtml, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        const indexInfo = await FileSystem.getInfoAsync(fileUri);
        if (!indexInfo.exists) {
          Alert.alert('WebView Error', `index.html not found at ${fileUri}`);
          return;
        }

        console.log('Prepared local web-ui file:', fileUri);
        setLocalFileUri(fileUri);
      } catch (error) {
        console.log('Failed to prepare local web-ui file:', error);
        Alert.alert('WebView Error', 'Failed to prepare local web-ui file.');
      } finally {
        setIsPreparingLocalFile(false);
      }
    };

    prepareLocalHtmlFile();
  }, []);

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

  useEffect(() => {
    if (!localFileUri || !webViewRef.current) {
      return;
    }

    webViewRef.current.injectJavaScript(applyScaleScript);
  }, [localFileUri, applyScaleScript]);

  const source = localFileUri ? { uri: localFileUri } : null;
  const displayEffect = weatherEffect;

  const handleMessage = (event: WebViewMessageEvent) => {
    const { data } = event.nativeEvent;

    try {
      const parsedData = JSON.parse(data);
      console.log('Message from web-ui:', parsedData);
      Alert.alert('Message from Web', JSON.stringify(parsedData));
    } catch (error) {
      console.log('Failed to parse web message:', data, error);
      Alert.alert('Message from Web', data);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {isPreparingLocalFile ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" />
        </View>
      ) : null}
      {source ? (
        <View style={styles.webViewContainer}>
          <WebView
            ref={webViewRef}
            source={source}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            bounces={false}
            overScrollMode="never"
            injectedJavaScriptBeforeContentLoaded={applyScaleScript}
            allowingReadAccessToURL={`${FileSystem.cacheDirectory}web-ui/`}
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            onLoadEnd={() => {
              if (webViewRef.current) {
                webViewRef.current.injectJavaScript(applyScaleScript);
              }
            }}
            onMessage={handleMessage}
            onError={(event) => {
              const msg = event.nativeEvent.description || 'Unknown WebView error';
              console.log('WebView error:', msg);
              Alert.alert('WebView Error', msg);
            }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" />
              </View>
            )}
          />
          <WeatherOverlay effect={displayEffect} mood={weatherMood} width={width} height={height} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webViewContainer: {
    flex: 1,
  },
  rainDrop: {
    position: 'absolute',
    top: -120,
    width: 2.2,
    borderRadius: 2,
    backgroundColor: 'rgba(158, 209, 255, 0.95)',
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
    backgroundColor: 'rgba(228, 240, 255, 0.86)',
  },
  thunderFlashDreamy: {
    backgroundColor: 'rgba(228, 240, 255, 0.86)',
  },
  thunderFlashCinematic: {
    backgroundColor: 'rgba(224, 234, 255, 0.96)',
  },
  weatherVignette: {
    backgroundColor: 'rgba(11, 18, 32, 0.18)',
  },
  weatherVignetteDreamy: {
    backgroundColor: 'rgba(11, 18, 32, 0.14)',
  },
  weatherVignetteCinematic: {
    backgroundColor: 'rgba(7, 12, 24, 0.3)',
  },
  weatherTopGlow: {
    top: -240,
    height: '70%',
  },
  weatherTopGlowDreamy: {
    backgroundColor: 'rgba(173, 215, 255, 0.09)',
  },
  weatherTopGlowCinematic: {
    backgroundColor: 'rgba(151, 205, 255, 0.06)',
  },
  weatherBottomHaze: {
    top: '62%',
    height: '38%',
  },
  weatherBottomHazeDreamy: {
    backgroundColor: 'rgba(10, 18, 34, 0.2)',
  },
  weatherBottomHazeCinematic: {
    backgroundColor: 'rgba(7, 14, 28, 0.32)',
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
});
