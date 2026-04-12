import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  NativeModules,
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
    if (host) {
      return `http://${host}:4000`;
    }
  }

  const expoHostUri =
    ((Constants.expoConfig as { hostUri?: string } | null)?.hostUri ??
      (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost) ??
    null;
  const expoHost = expoHostUri?.split(':')[0];
  if (expoHost) {
    return `http://${expoHost}:4000`;
  }

  return 'http://localhost:4000';
}

export default function WebViewScreen() {
  const pendingNotificationPathRef = useRef<string | null>(null);
  const isWebViewReadyRef = useRef(false);
  const webViewRef = useRef<WebView>(null);

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

  const { handleRestNotificationBridgeMessage } = useRestNotificationBridge({
    onNavigate: navigateWebViewByTargetPath,
  });
  const [localFileUri, setLocalFileUri] = useState<string | null>(null);
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
    if (!localFileUri || !webViewRef.current) {
      return;
    }

    webViewRef.current.injectJavaScript(applyScaleScript);
  }, [localFileUri, applyScaleScript]);

  const source = localFileUri ? { uri: localFileUri } : null;

  const handleMessage = async (event: WebViewMessageEvent) => {
    const { data } = event.nativeEvent;

    try {
      const parsedData = JSON.parse(data);
      if (parsedData?.__wvDebug) {
        console.log('[WebView debug]', parsedData.type, parsedData.payload);
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
            injectedJavaScriptBeforeContentLoaded={injectedBeforeContentLoaded}
            allowingReadAccessToURL={`${FileSystem.cacheDirectory}web-ui/`}
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            onLoadStart={() => {
              console.log('WebView load start:', source.uri);
              isWebViewReadyRef.current = false;
            }}
            onLoadEnd={() => {
              console.log('WebView load end:', source.uri);
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
});
