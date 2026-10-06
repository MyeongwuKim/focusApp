import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { WebUiVersionProgress } from "../webUiVersionWorker";

const UNDERLINE_TOP_RATIO = 0.532;
const UNDERLINE_WIDTH_RATIO = 0.34;
const UNDERLINE_ASPECT_RATIO = 2172 / 724;
const VISUAL_CENTER_OFFSET = 16;
const UNDERLINE_ROTATION = "-2deg";

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

/** 로딩 내부 용어를 사용자가 보는 노트 준비 문구로 바꾼다. */
export function resolveLaunchStatusCopy(statusMessage: string) {
  switch (statusMessage) {
    case "초기 번들 준비중...":
      return "노트를 펼치는 중…";
    case "버전 체크중...":
      return "오늘의 기록을 불러오는 중…";
    case "앱 번들 설치중...":
      return "새 페이지를 정리하는 중…";
    case "앱 시작중...":
      return "오늘을 기록할 준비가 됐어요";
    default:
      return statusMessage;
  }
}

type FocusLaunchOverlayProps = {
  statusMessage: string;
  progressPercent: number;
  showProgress?: boolean;
  isReady: boolean;
  onExitComplete: () => void;
};

/**
 * 정적 스플래시와 같은 전면 노트 배경 위에서 WebView 준비 상태를 보여준다.
 * 스프링의 시각적 무게를 보정해 체크·밑줄·안내 문구의 중심을 오른쪽으로 맞춘다.
 * 체크 아래의 노란 크레파스 밑줄은 progressPercent에 맞춰 왼쪽부터 드러내고,
 * 준비가 끝나면 화면 전체를 부드럽게 밀어내며 onExitComplete를 호출한다.
 */
export function FocusLaunchOverlay({
  statusMessage,
  progressPercent,
  showProgress = true,
  isReady,
  onExitComplete,
}: FocusLaunchOverlayProps) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const introProgress = useRef(new Animated.Value(0)).current;
  const drawingProgress = useRef(new Animated.Value(0)).current;
  const exitProgress = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const hasStartedExitRef = useRef(false);

  useEffect(() => {
    Animated.spring(introProgress, {
      toValue: 1,
      damping: 16,
      stiffness: 115,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [introProgress]);

  useEffect(() => {
    Animated.timing(drawingProgress, {
      toValue: Math.max(0, Math.min(progressPercent, 100)) / 100,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [drawingProgress, progressPercent]);

  useEffect(() => {
    if (!isReady || hasStartedExitRef.current) {
      return;
    }

    hasStartedExitRef.current = true;
    Animated.sequence([
      Animated.timing(drawingProgress, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.delay(130),
      Animated.parallel([
        Animated.timing(exitProgress, {
          toValue: 1,
          duration: 460,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 360,
          delay: 170,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (finished) {
        onExitComplete();
      }
    });
  }, [drawingProgress, exitProgress, isReady, onExitComplete, overlayOpacity]);

  const underlineFullWidth = viewportWidth * UNDERLINE_WIDTH_RATIO;
  const underlineLeft =
    (viewportWidth - underlineFullWidth) / 2 + VISUAL_CENTER_OFFSET;
  const underlineTop = viewportHeight * UNDERLINE_TOP_RATIO;
  const underlineHeight = underlineFullWidth / UNDERLINE_ASPECT_RATIO;
  const underlineWidth = drawingProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, underlineFullWidth],
    extrapolate: "clamp",
  });
  const displayStatusMessage = resolveLaunchStatusCopy(statusMessage);

  return (
    <Animated.View style={[styles.launchOverlay, { opacity: overlayOpacity }]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            transform: [
              {
                translateX: exitProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -18],
                }),
              },
              {
                scale: exitProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.015],
                }),
              },
            ],
          },
        ]}
      >
        <Image
          source={require("../../../../assets/images/splash-full-base.png")}
          style={styles.fullArtwork}
          resizeMode="stretch"
          accessibilityIgnoresInvertColors
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.underlineWindow,
            {
              left: underlineLeft,
              top: underlineTop,
              width: underlineWidth,
              height: underlineHeight,
              transform: [{ rotate: UNDERLINE_ROTATION }],
            },
          ]}
        >
          <Image
            source={require("../../../../assets/images/splash-underline.png")}
            style={{ width: underlineFullWidth, height: underlineHeight }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
      </Animated.View>

      <Animated.View
        style={[
          styles.launchCopy,
          {
            opacity: introProgress.interpolate({
              inputRange: [0, 0.55, 1],
              outputRange: [0, 0, 1],
            }),
            transform: [
              { translateX: VISUAL_CENTER_OFFSET },
              {
                translateY: exitProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 10],
                }),
              },
            ],
          },
        ]}
      >
        {showProgress ? (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={displayStatusMessage}
            accessibilityValue={{ min: 0, max: 100, now: progressPercent }}
          >
            <Text style={styles.launchStatusText}>{displayStatusMessage}</Text>
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  launchOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    overflow: "hidden",
    backgroundColor: "#F8EDCA",
  },
  fullArtwork: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  underlineWindow: {
    position: "absolute",
    overflow: "hidden",
  },
  launchCopy: {
    position: "absolute",
    top: "60%",
    right: 0,
    left: 0,
    alignItems: "center",
    minHeight: 32,
  },
  launchStatusText: {
    color: "rgba(91, 70, 43, 0.78)",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.25,
    textAlign: "center",
  },
});
