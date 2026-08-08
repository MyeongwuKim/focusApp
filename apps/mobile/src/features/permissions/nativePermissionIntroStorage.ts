import * as FileSystem from "expo-file-system/legacy";

const NOTIFICATION_PERMISSION_INTRO_FILE_URI = `${
  FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? ""
}native-notification-permission-intro-v1.json`;

export async function hasSeenNativePermissionIntro() {
  try {
    return (await FileSystem.getInfoAsync(NOTIFICATION_PERMISSION_INTRO_FILE_URI)).exists;
  } catch {
    return false;
  }
}

export async function markNativePermissionIntroAsSeen() {
  try {
    await FileSystem.writeAsStringAsync(
      NOTIFICATION_PERMISSION_INTRO_FILE_URI,
      JSON.stringify({ seenAt: new Date().toISOString() }),
      { encoding: FileSystem.EncodingType.UTF8 }
    );
  } catch (error) {
    console.log("Failed to store native permission intro state:", error);
  }
}
