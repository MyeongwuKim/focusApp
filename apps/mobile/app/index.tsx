import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function WebViewScreen() {
  const [localFileUri, setLocalFileUri] = useState<string | null>(null);
  const [isPreparingLocalFile, setIsPreparingLocalFile] = useState(true);
  const webViewRef = useRef<WebView>(null);
  const { width } = useWindowDimensions();

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
    if (!localFileUri || !webViewRef.current) {
      return;
    }

    webViewRef.current.injectJavaScript(applyScaleScript);
  }, [localFileUri, applyScaleScript]);

  const source = localFileUri ? { uri: localFileUri } : null;

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
});
