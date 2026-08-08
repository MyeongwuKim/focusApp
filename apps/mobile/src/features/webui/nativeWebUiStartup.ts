import { Alert, BackHandler, NativeModules, Platform } from "react-native";
import { resolveNativeErrorCode } from "../../shared/nativeErrors";
import { readUnknownRecord } from "../../shared/nativeValues";

function resolveWebUiStartupErrorMessage(error: unknown) {
  const code = resolveNativeErrorCode(error, "WEB_UI_STARTUP_FAILED").trim().toUpperCase();
  if (code.startsWith("WEB_UI_MANIFEST_")) {
    return "버전 정보를 가져오는데 실패했습니다. 다시 실행해주세요.";
  }
  if (code === "WEB_UI_BUNDLE_EXTRACT_FAILED" || code === "WEB_UI_INDEX_MISSING_IN_ZIP") {
    return "R2 번들 압축 해제에 실패했습니다. 다시 실행해주세요.";
  }
  if (code.startsWith("WEB_UI_BUNDLE_")) {
    return "웹 번들 다운로드에 실패했습니다. 다시 실행해주세요.";
  }
  return "앱 시작에 실패했습니다. 다시 실행해주세요.";
}

function closeAppFromFatalStartupError() {
  const exitAndroidApp = () => {
    if (Platform.OS !== "android") return;
    setTimeout(() => BackHandler.exitApp(), 0);
    setTimeout(() => BackHandler.exitApp(), 250);
  };

  const nativeModulesRecord = readUnknownRecord(NativeModules);
  const nativeAppControl = readUnknownRecord(nativeModulesRecord?.NativeAppControl);
  const rnExitApp = readUnknownRecord(nativeModulesRecord?.RNExitApp);
  const exitApp = nativeAppControl?.exitApp ?? rnExitApp?.exitApp;
  if (typeof exitApp === "function") {
    try {
      exitApp();
    } finally {
      exitAndroidApp();
    }
    return;
  }
  exitAndroidApp();
}

export function showWebUiStartupErrorAlert(error: unknown) {
  Alert.alert(
    "앱 시작 오류",
    resolveWebUiStartupErrorMessage(error),
    [{ text: "확인", onPress: closeAppFromFatalStartupError }],
    { cancelable: false }
  );
}
