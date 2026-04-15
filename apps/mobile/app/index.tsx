import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  NativeModules,
  PermissionsAndroid,
  Pressable,
  Text,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { embeddedWebUiFiles } from '../src/features/webui/embeddedWebUiBundle';
import { NativeWeatherLayer } from '../src/features/weather/components/NativeWeatherLayer';
import { useRestNotificationBridge } from '../src/features/notifications/hooks/useRestNotificationBridge';

const BASE_WIDTH = 390;
const MIN_SCALE = 0.9;
const MAX_SCALE = 1.08;
const PERMISSION_INTRO_FILE_URI = `${
  FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? ''
}native-permission-intro-v2.json`;

type NativePermissionState = 'granted' | 'denied' | 'undetermined';
type PermissionStep = 'notification' | 'location';
type LocationPermissionSnapshot = {
  granted: boolean;
  canAskAgain: boolean;
  status: NativePermissionState;
};
type GeolocationLike = {
  getCurrentPosition: (
    success: () => void,
    failure: () => void,
    options?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number }
  ) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isLoopbackHost(host: string) {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '[::1]'
  );
}

function resolveHybridApiOrigin() {
  const envOrigin = process.env.EXPO_PUBLIC_API_ORIGIN ?? process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envOrigin?.trim()) {
    const cleaned = envOrigin.trim().replace(/\/graphql\/?$/i, '').replace(/\/+$/, '');
    return cleaned;
  }

  const scriptUrl = NativeModules.SourceCode?.scriptURL as string | undefined;
  if (scriptUrl) {
    const hostMatch = scriptUrl.match(/^[a-z]+:\/\/([^/:?#]+)/i);
    const host = hostMatch?.[1];
    if (host && !isLoopbackHost(host)) {
      return `http://${host}:4000`;
    }
  }

  const expoHostUri =
    ((Constants.expoConfig as { hostUri?: string } | null)?.hostUri ??
      (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost) ??
    null;
  const expoHost = expoHostUri?.split(':')[0];
  if (expoHost && !isLoopbackHost(expoHost)) {
    return `http://${expoHost}:4000`;
  }

  return 'http://localhost:4000';
}

function readCallbackValue(url: URL, key: string) {
  const fromSearch = url.searchParams.get(key);
  if (fromSearch) {
    return fromSearch;
  }

  const hash = url.hash ?? '';
  const hashQueryIndex = hash.indexOf('?');
  if (hashQueryIndex >= 0) {
    const hashQuery = hash.slice(hashQueryIndex + 1);
    return new URLSearchParams(hashQuery).get(key);
  }

  return null;
}

function resolveAuthCallbackHashFromUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const looksLikeAuthCallback =
      parsed.protocol === 'mobile:' ||
      rawUrl.includes('/auth/callback') ||
      parsed.hash.includes('/auth/callback') ||
      (parsed.protocol === 'file:' && parsed.pathname.endsWith('/index.html'));
    if (!looksLikeAuthCallback) {
      return null;
    }

    const token = readCallbackValue(parsed, 'token');
    if (!token) {
      return null;
    }

    const userId = readCallbackValue(parsed, 'userId');
    const error = readCallbackValue(parsed, 'error');
    const params = new URLSearchParams();
    params.set('token', token);
    if (userId) {
      params.set('userId', userId);
    }
    if (error) {
      params.set('error', error);
    }

    return `#/auth/callback?${params.toString()}`;
  } catch {
    return null;
  }
}

async function hasSeenNativePermissionIntro() {
  try {
    const info = await FileSystem.getInfoAsync(PERMISSION_INTRO_FILE_URI);
    return info.exists;
  } catch {
    return false;
  }
}

async function markNativePermissionIntroAsSeen() {
  try {
    await FileSystem.writeAsStringAsync(
      PERMISSION_INTRO_FILE_URI,
      JSON.stringify({ seenAt: new Date().toISOString() }),
      { encoding: FileSystem.EncodingType.UTF8 }
    );
  } catch (error) {
    console.log('Failed to store native permission intro state:', error);
  }
}

function loadExpoLocationModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loadedModule = require('expo-location') as {
      getForegroundPermissionsAsync?: () => Promise<{ status?: string; granted?: boolean }>;
      requestForegroundPermissionsAsync?: () => Promise<{ status?: string; granted?: boolean }>;
    };
    return loadedModule;
  } catch {
    return null;
  }
}

async function getLocationPermissionState(): Promise<NativePermissionState> {
  const expoLocation = loadExpoLocationModule();
  if (expoLocation?.getForegroundPermissionsAsync) {
    try {
      const result = await expoLocation.getForegroundPermissionsAsync();
      if (result.granted || result.status === 'granted') {
        return 'granted';
      }
      if (result.status === 'denied') {
        return 'denied';
      }
      return 'undetermined';
    } catch (error) {
      console.log('Failed to check location permission via expo-location:', error);
      return 'undetermined';
    }
  }

  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      return granted ? 'granted' : 'undetermined';
    } catch (error) {
      console.log('Failed to check Android location permission:', error);
      return 'undetermined';
    }
  }

  return 'undetermined';
}

async function requestLocationPermission(): Promise<boolean> {
  const expoLocation = loadExpoLocationModule();
  if (expoLocation?.requestForegroundPermissionsAsync) {
    try {
      const result = await expoLocation.requestForegroundPermissionsAsync();
      return result.granted || result.status === 'granted';
    } catch (error) {
      console.log('Failed to request location permission via expo-location:', error);
      return false;
    }
  }

  if (Platform.OS === 'android') {
    try {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.log('Failed to request Android location permission:', error);
      return false;
    }
  }

  const geolocation = (globalThis.navigator as { geolocation?: GeolocationLike } | undefined)?.geolocation;
  if (geolocation?.getCurrentPosition) {
    return await new Promise<boolean>((resolve) => {
      geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
      );
    });
  }

  return false;
}

async function getLocationPermissionSnapshot(): Promise<LocationPermissionSnapshot> {
  const expoLocation = loadExpoLocationModule();
  if (expoLocation?.getForegroundPermissionsAsync) {
    try {
      const result = await expoLocation.getForegroundPermissionsAsync();
      const granted = Boolean(result.granted || result.status === 'granted');
      const status: NativePermissionState =
        result.status === 'granted' ? 'granted' : result.status === 'denied' ? 'denied' : 'undetermined';
      return {
        granted,
        canAskAgain: Boolean((result as { canAskAgain?: boolean }).canAskAgain),
        status,
      };
    } catch (error) {
      console.log('Failed to read location permission snapshot via expo-location:', error);
    }
  }

  const status = await getLocationPermissionState();
  return {
    granted: status === 'granted',
    canAskAgain: status !== 'denied',
    status,
  };
}

export default function WebViewScreen() {
  const pendingNotificationPathRef = useRef<string | null>(null);
  const isWebViewReadyRef = useRef(false);
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isPermissionIntroReady, setIsPermissionIntroReady] = useState(false);
  const [isPermissionIntroVisible, setIsPermissionIntroVisible] = useState(false);
  const [isRequestingNotificationPermission, setIsRequestingNotificationPermission] = useState(false);
  const [isRequestingLocationPermission, setIsRequestingLocationPermission] = useState(false);
  const [isNotificationGranted, setIsNotificationGranted] = useState(false);
  const [locationPermissionState, setLocationPermissionState] = useState<NativePermissionState>('undetermined');
  const [permissionStep, setPermissionStep] = useState<PermissionStep>('notification');

  const navigateWebViewByTargetPath = (targetPath: string) => {
    if (!targetPath.startsWith('/')) {
      return;
    }

    const hashPath = `#${targetPath}`;
    pendingNotificationPathRef.current = targetPath;

    if (!webViewRef.current || !isWebViewReadyRef.current) {
      return;
    }

    webViewRef.current.injectJavaScript(
      `(() => { window.location.hash = ${JSON.stringify(hashPath)}; })(); true;`
    );
    pendingNotificationPathRef.current = null;
  };

  const {
    handleRestNotificationBridgeMessage,
    requestRestNotificationPermission,
    getRestNotificationPermissionStatus,
    getRestNotificationPermissionSnapshot,
    getRestExpoPushTokenSnapshot,
  } = useRestNotificationBridge({
    onNavigate: navigateWebViewByTargetPath,
  });
  const [localFileUri, setLocalFileUri] = useState<string | null>(null);
  const [webViewUri, setWebViewUri] = useState<string | null>(null);
  const [isPreparingLocalFile, setIsPreparingLocalFile] = useState(true);
  const { width, fontScale } = useWindowDimensions();
  const hybridApiOrigin = useMemo(() => resolveHybridApiOrigin(), []);

  const uiScale = useMemo(() => {
    const effectiveWidth = width / clamp(fontScale, 1, 1.2);
    const rawScale = effectiveWidth / BASE_WIDTH;
    return clamp(rawScale, MIN_SCALE, MAX_SCALE);
  }, [fontScale, width]);

  const calendarLayoutVars = useMemo(() => {
    const normalizedFontScale = clamp(fontScale, 1, 1.2);
    const effectiveWidth = width / normalizedFontScale;
    const estimatedCellWidthPx = effectiveWidth / 7;
    const iconSizePx = Math.round(clamp(estimatedCellWidthPx * 0.12, 6, 8));
    const iconPaddingPx = 1;
    const iconGapPx = 1;
    const iconCircleWidthPx = iconSizePx + iconPaddingPx * 2 + 2;
    const iconSlotSingleWidthPx = Math.round(clamp(iconCircleWidthPx + 1, 9, 12));
    const iconSlotDoubleWidthPx = Math.round(clamp(iconCircleWidthPx * 2 + iconGapPx + 1, 18, 24));
    const cellMinHeightRem = clamp(5.15 + (normalizedFontScale - 1) * 0.75, 5.15, 5.8);
    const topRowHeightRem = clamp(1.08 + (normalizedFontScale - 1) * 0.24, 1.08, 1.24);
    const numberFontRem = clamp(estimatedCellWidthPx / 66, 0.74, 0.9);
    const dateSlotWidthCh = estimatedCellWidthPx < 46 ? 1.75 : 2;

    return {
      iconSizePx,
      iconPaddingPx,
      iconGapPx,
      iconSlotSingleWidthPx,
      iconSlotDoubleWidthPx,
      dateSlotWidthCh,
      cellMinHeightRem,
      topRowHeightRem,
      numberFontRem,
    };
  }, [fontScale, uiScale]);

  const applyScaleScript = useMemo(
    () =>
      `(() => {
        const root = document.documentElement;
        root.style.setProperty('--ui-scale', '${uiScale.toFixed(3)}');
        root.style.setProperty('--calendar-cell-min-h', '${calendarLayoutVars.cellMinHeightRem.toFixed(3)}rem');
        root.style.setProperty('--calendar-top-row-h', '${calendarLayoutVars.topRowHeightRem.toFixed(3)}rem');
        root.style.setProperty('--calendar-icon-size', '${calendarLayoutVars.iconSizePx}px');
        root.style.setProperty('--calendar-icon-padding', '${calendarLayoutVars.iconPaddingPx}px');
        root.style.setProperty('--calendar-icon-gap', '${calendarLayoutVars.iconGapPx}px');
        root.style.setProperty('--calendar-icon-slot-single-w', '${calendarLayoutVars.iconSlotSingleWidthPx}px');
        root.style.setProperty('--calendar-icon-slot-double-w', '${calendarLayoutVars.iconSlotDoubleWidthPx}px');
        root.style.setProperty('--calendar-date-slot-w', '${calendarLayoutVars.dateSlotWidthCh.toFixed(2)}ch');
        root.style.setProperty('--calendar-date-number-size', '${calendarLayoutVars.numberFontRem.toFixed(3)}rem');
      })(); true;`,
    [calendarLayoutVars, uiScale]
  );
  const webDebugBridgeScript = useMemo(
    () => `(() => {
      const post = (type, payload) => {
        try {
          window.ReactNativeWebView?.postMessage(JSON.stringify({ __wvDebug: true, type, payload }));
        } catch {}
      };
      window.addEventListener('error', (event) => {
        post('window-error', {
          message: event?.message,
          filename: event?.filename,
          lineno: event?.lineno,
          colno: event?.colno,
        });
      });
      window.addEventListener('unhandledrejection', (event) => {
        post('unhandledrejection', {
          reason:
            typeof event?.reason === 'string'
              ? event.reason
              : event?.reason?.message || String(event?.reason),
        });
      });
      const wrap = (level) => {
        const original = console[level];
        console[level] = (...args) => {
          post('console-' + level, {
            args: args.map((arg) => {
              if (typeof arg === 'string') return arg;
              try {
                return JSON.stringify(arg);
              } catch {
                return String(arg);
              }
            }),
          });
          original?.apply(console, args);
        };
      };
      wrap('log');
      wrap('warn');
      wrap('error');
      window.__HYBRID_API_ORIGIN__ = '${hybridApiOrigin}';
      post('bridge-ready', { href: location.href });
    })(); true;`,
    [hybridApiOrigin]
  );
  const injectedBeforeContentLoaded = useMemo(
    () => `${webDebugBridgeScript}\n${applyScaleScript}`,
    [webDebugBridgeScript, applyScaleScript]
  );

  useEffect(() => {
    let cancelled = false;

    const initializePermissionIntro = async () => {
      try {
        const [hasSeenIntro, notificationGranted, currentLocationPermissionState] = await Promise.all([
          hasSeenNativePermissionIntro(),
          getRestNotificationPermissionStatus(),
          getLocationPermissionState(),
        ]);
        if (cancelled) {
          return;
        }

        setIsNotificationGranted(notificationGranted);
        setLocationPermissionState(currentLocationPermissionState);

        const allGranted = notificationGranted && currentLocationPermissionState === 'granted';
        if (hasSeenIntro || allGranted) {
          if (!hasSeenIntro) {
            await markNativePermissionIntroAsSeen();
          }
          if (!cancelled) {
            setIsPermissionIntroVisible(false);
          }
        } else {
          setPermissionStep(notificationGranted ? 'location' : 'notification');
          setIsPermissionIntroVisible(true);
        }
      } catch (error) {
        console.log('Failed to initialize native permission intro:', error);
        if (!cancelled) {
          setIsPermissionIntroVisible(true);
        }
      } finally {
        if (!cancelled) {
          setIsPermissionIntroReady(true);
        }
      }
    };

    initializePermissionIntro();

    return () => {
      cancelled = true;
    };
  }, [getRestNotificationPermissionStatus]);

  const closePermissionIntro = async () => {
    await markNativePermissionIntroAsSeen();
    setIsPermissionIntroVisible(false);
  };

  const handleRequestNotificationPermission = async () => {
    setIsRequestingNotificationPermission(true);
    try {
      const granted = await requestRestNotificationPermission();
      setIsNotificationGranted(granted);
      if (!granted) {
        await Linking.openSettings().catch((error) => {
          console.log('Failed to open settings from notification permission handler:', error);
        });
      }
      setPermissionStep('location');
    } catch (error) {
      console.log('Failed to request notification permission from intro screen:', error);
    } finally {
      setIsRequestingNotificationPermission(false);
    }
  };

  const handleRequestLocationPermission = async () => {
    setIsRequestingLocationPermission(true);
    try {
      const granted = await requestLocationPermission();
      const nextState = granted ? 'granted' : await getLocationPermissionState();
      setLocationPermissionState(nextState);
      if (!granted) {
        await Linking.openSettings().catch((error) => {
          console.log('Failed to open settings from location permission handler:', error);
        });
      }
      await closePermissionIntro();
    } catch (error) {
      console.log('Failed to request location permission from intro screen:', error);
    } finally {
      setIsRequestingLocationPermission(false);
    }
  };

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
        currentHtml = currentHtml.replace(/\s+crossorigin(?=[\s>])/gi, '');
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
        setWebViewUri(fileUri);
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
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (webViewRef.current && canGoBack) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });

    return () => {
      subscription.remove();
    };
  }, [canGoBack]);

  useEffect(() => {
    if (!localFileUri || !webViewRef.current) {
      return;
    }

    if (!webViewUri) {
      setWebViewUri(localFileUri);
    }

    webViewRef.current.injectJavaScript(applyScaleScript);
  }, [localFileUri, webViewUri, applyScaleScript]);

  const source = webViewUri ? { uri: webViewUri } : null;

  const handleMessage = async (event: WebViewMessageEvent) => {
    const { data } = event.nativeEvent;

    try {
      const parsedData = JSON.parse(data);
      if (parsedData?.__wvDebug) {
        console.log('[WebView debug]', parsedData.type, parsedData.payload);
        return;
      }
      if (parsedData?.type === 'REST_NOTIFICATION_PERMISSION_STATUS_REQUEST') {
        const requestId =
          typeof parsedData?.requestId === 'string' && parsedData.requestId.trim()
            ? parsedData.requestId
            : null;
        const snapshot = await getRestNotificationPermissionSnapshot();
        const bridgeMessage = {
          type: 'REST_NOTIFICATION_PERMISSION_STATUS_RESULT',
          requestId,
          payload: snapshot,
        };
        webViewRef.current?.injectJavaScript(
          `window.dispatchEvent(new CustomEvent('focus-hybrid-native-bridge', { detail: ${JSON.stringify(
            bridgeMessage
          )} })); true;`
        );
        return;
      }

      if (parsedData?.type === 'REST_APP_OPEN_SETTINGS') {
        await Linking.openSettings().catch((error) => {
          console.log('Failed to open settings from web bridge:', error);
        });
        return;
      }

      if (parsedData?.type === 'REST_LOCATION_PERMISSION_STATUS_REQUEST') {
        const requestId =
          typeof parsedData?.requestId === 'string' && parsedData.requestId.trim()
            ? parsedData.requestId
            : null;
        const snapshot = await getLocationPermissionSnapshot();
        const bridgeMessage = {
          type: 'REST_LOCATION_PERMISSION_STATUS_RESULT',
          requestId,
          payload: snapshot,
        };
        webViewRef.current?.injectJavaScript(
          `window.dispatchEvent(new CustomEvent('focus-hybrid-native-bridge', { detail: ${JSON.stringify(
            bridgeMessage
          )} })); true;`
        );
        return;
      }

      if (parsedData?.type === 'REST_PUSH_TOKEN_REQUEST') {
        const requestId =
          typeof parsedData?.requestId === 'string' && parsedData.requestId.trim()
            ? parsedData.requestId
            : null;
        const snapshot = await getRestExpoPushTokenSnapshot();
        const bridgeMessage = {
          type: 'REST_PUSH_TOKEN_RESULT',
          requestId,
          payload: snapshot,
        };
        webViewRef.current?.injectJavaScript(
          `window.dispatchEvent(new CustomEvent('focus-hybrid-native-bridge', { detail: ${JSON.stringify(
            bridgeMessage
          )} })); true;`
        );
        return;
      }

      const isHandledBridgeMessage = await handleRestNotificationBridgeMessage(parsedData);
      if (isHandledBridgeMessage) {
        return;
      }
      console.log('Message from web-ui:', parsedData);
      Alert.alert('Message from Web', JSON.stringify(parsedData));
    } catch (error) {
      console.log('Failed to parse web message:', data, error);
      console.log('[WebView raw message]', data);
    }
  };

  const showPermissionIntro = isPermissionIntroReady && isPermissionIntroVisible;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {isPreparingLocalFile ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" />
        </View>
      ) : null}
      {!isPermissionIntroReady ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" />
        </View>
      ) : null}
      {source && !showPermissionIntro ? (
        <View style={styles.webViewContainer}>
          <WebView
            ref={webViewRef}
            source={source}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            allowsBackForwardNavigationGestures
            bounces={false}
            overScrollMode="never"
            injectedJavaScriptBeforeContentLoaded={injectedBeforeContentLoaded}
            allowingReadAccessToURL={`${FileSystem.cacheDirectory}web-ui/`}
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            onShouldStartLoadWithRequest={(request) => {
              console.log('WebView should start request:', request.url);

              if (request.url.startsWith('mobile://')) {
                const callbackHash = resolveAuthCallbackHashFromUrl(request.url);
                if (callbackHash && localFileUri) {
                  const nextLocalUri = `${localFileUri}${callbackHash}`;
                  setWebViewUri(nextLocalUri);
                }
                return false;
              }

              if (
                request.url.startsWith('file://') &&
                request.url.includes('#/auth/callback') &&
                request.url.includes('token=')
              ) {
                return true;
              }

              const callbackHash = resolveAuthCallbackHashFromUrl(request.url);
              if (!callbackHash || !localFileUri) {
                return true;
              }

              const nextLocalUri = `${localFileUri}${callbackHash}`;
              setWebViewUri(nextLocalUri);
              return false;
            }}
            onLoadStart={() => {
              console.log('WebView load start:', source?.uri);
              isWebViewReadyRef.current = false;
            }}
            onLoadEnd={() => {
              console.log('WebView load end:', source?.uri);
              isWebViewReadyRef.current = true;
              if (webViewRef.current) {
                webViewRef.current.injectJavaScript(applyScaleScript);
              }
              const pendingTargetPath = pendingNotificationPathRef.current;
              if (pendingTargetPath) {
                const hashPath = `#${pendingTargetPath}`;
                webViewRef.current?.injectJavaScript(
                  `(() => { window.location.hash = ${JSON.stringify(hashPath)}; })(); true;`
                );
                pendingNotificationPathRef.current = null;
              }
            }}
            onLoadProgress={(event) => {
              console.log('WebView load progress:', event.nativeEvent.progress);
            }}
            onNavigationStateChange={(navState) => {
              setCanGoBack(navState.canGoBack);
            }}
            onMessage={handleMessage}
            onHttpError={(event) => {
              console.log('WebView HTTP error:', event.nativeEvent.statusCode, event.nativeEvent.description);
            }}
            onContentProcessDidTerminate={() => {
              console.log('WebView content process terminated');
            }}
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
          <NativeWeatherLayer />
        </View>
      ) : null}
      {showPermissionIntro ? (
        <View style={styles.permissionIntroOverlay}>
          <View style={styles.permissionIntroCard}>
            {permissionStep === 'notification' ? (
              <View style={styles.permissionTextWrap}>
                <Text style={styles.permissionRowTitle}>푸시 알림 권한 설정</Text>
                <Text style={styles.permissionRowDescription}>
                  리마인드를 더 잘 도와드릴 수 있도록{'\n'}
                  푸시 알림을 켜둘까요?
                </Text>
              </View>
            ) : (
              <View style={styles.permissionTextWrap}>
                <Text style={styles.permissionRowTitle}>위치 권한 설정</Text>
                <Text style={styles.permissionRowDescription}>
                  캘린더에 날씨 효과를 보여드리기 위해{'\n'}
                  위치 권한이 필요해요.
                </Text>
              </View>
            )}

            <View style={styles.permissionFooterActions}>
              {permissionStep === 'notification' ? (
                <>
                  <Pressable
                    style={styles.permissionGhostButton}
                    onPress={() => {
                      setPermissionStep('location');
                    }}
                  >
                    <Text style={styles.permissionGhostButtonText}>아니요, 다음에요</Text>
                  </Pressable>
                  <Pressable
                    style={styles.permissionPrimaryButton}
                    onPress={handleRequestNotificationPermission}
                    disabled={isRequestingNotificationPermission}
                  >
                    <Text style={styles.permissionPrimaryButtonText}>
                      {isRequestingNotificationPermission ? '요청 중' : '좋아요, 할게요'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    style={styles.permissionGhostButton}
                    onPress={() => {
                      void closePermissionIntro();
                    }}
                  >
                    <Text style={styles.permissionGhostButtonText}>아니요, 다음에요</Text>
                  </Pressable>
                  <Pressable
                    style={styles.permissionPrimaryButton}
                    onPress={handleRequestLocationPermission}
                    disabled={isRequestingLocationPermission}
                  >
                    <Text style={styles.permissionPrimaryButtonText}>
                      {isRequestingLocationPermission ? '요청 중' : '좋아요, 할게요'}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>

            <Pressable
              style={styles.permissionSettingsLink}
              onPress={() => {
                Linking.openSettings().catch((error) => {
                  console.log('Failed to open settings from permission intro:', error);
                });
              }}
            >
              <Text style={styles.permissionSettingsLinkText}>권한은 설정에서 언제든 다시 변경할 수 있어요</Text>
            </Pressable>
          </View>
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
  permissionIntroOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 20,
    backgroundColor: '#F4F8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionIntroCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE8FF',
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 18,
    shadowColor: '#2F5FCB',
    shadowOpacity: 0.13,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  permissionTextWrap: {
    gap: 8,
  },
  permissionRowTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#14326F',
    letterSpacing: -0.3,
  },
  permissionRowDescription: {
    fontSize: 15,
    lineHeight: 24,
    color: '#3F5D99',
  },
  permissionFooterActions: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 8,
  },
  permissionGhostButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CFDBF8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#F6F9FF',
  },
  permissionGhostButtonText: {
    color: '#395A9A',
    fontWeight: '700',
    fontSize: 14,
  },
  permissionPrimaryButton: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#1F5FFF',
  },
  permissionPrimaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  permissionSettingsLink: {
    marginTop: 14,
    alignSelf: 'center',
  },
  permissionSettingsLinkText: {
    color: '#49669F',
    fontSize: 13,
    fontWeight: '500',
  },
});
