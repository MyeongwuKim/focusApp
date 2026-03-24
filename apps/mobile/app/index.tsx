import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { embeddedWebUiFiles } from './embeddedWebUiBundle';

export default function WebViewScreen() {
  const [localFileUri, setLocalFileUri] = useState<string | null>(null);
  const [isPreparingLocalFile, setIsPreparingLocalFile] = useState(true);

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
    <SafeAreaView style={styles.container}>
      {isPreparingLocalFile ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" />
        </View>
      ) : null}
      {source ? (
        <WebView
          source={source}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          allowingReadAccessToURL={`${FileSystem.cacheDirectory}web-ui/`}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
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
