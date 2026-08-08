import { Image, StyleSheet, Text, View } from "react-native";
import type { WebUiVersionProgress } from "../webUiVersionWorker";

const LAUNCH_PROGRESS_BAR_WIDTH = 168;

export function resolveLaunchProgressPercent(statusMessage: WebUiVersionProgress) {
  switch (statusMessage) {
    case "초기 번들 준비중...":
      return 22;
    case "버전 체크중...":
      return 46;
    case "앱 번들 설치중...":
      return 78;
    case "앱 시작중...":
      return 100;
    default:
      return 0;
  }
}

export function FocusLaunchOverlay({
  statusMessage,
  progressPercent,
  showProgress = true,
}: {
  statusMessage: string;
  progressPercent: number;
  showProgress?: boolean;
}) {
  const progressWidth =
    (LAUNCH_PROGRESS_BAR_WIDTH * Math.max(0, Math.min(progressPercent, 100))) / 100;

  return (
    <View style={styles.launchOverlay}>
      <View style={styles.launchLogoFrame}>
        <Image
          source={require("../../../../assets/images/splash-icon.png")}
          style={styles.launchLogo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
      {showProgress ? (
        <View
          style={styles.launchProgressGroup}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={statusMessage}
          accessibilityValue={{ min: 0, max: 100, now: progressPercent }}>
          <View style={styles.launchProgressTrack}>
            <View style={[styles.launchProgressFill, { width: progressWidth }]} />
          </View>
          <Text style={styles.launchStatusText}>{statusMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  launchOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    backgroundColor: "#0B1220",
    alignItems: "center",
    justifyContent: "center",
  },
  launchLogoFrame: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  launchLogo: {
    width: 200,
    height: 200,
  },
  launchStatusText: {
    marginTop: 10,
    color: "rgba(226, 232, 240, 0.86)",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  launchProgressGroup: {
    position: "absolute",
    top: "50%",
    marginTop: 108,
    width: LAUNCH_PROGRESS_BAR_WIDTH,
    alignItems: "center",
  },
  launchProgressTrack: {
    width: LAUNCH_PROGRESS_BAR_WIDTH,
    height: 4,
    borderRadius: 99,
    backgroundColor: "rgba(148, 163, 184, 0.24)",
    overflow: "hidden",
  },
  launchProgressFill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: "#2CE6A6",
  },
});
