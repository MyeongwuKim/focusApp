import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { getPaperFogYRatio, PAPER_FOG_TRAVEL_MARGIN } from '../paperFogMotion';
import { PAPER_FOG_HEIGHT_RATIO } from '../paperWeatherArtwork';

/**
 * 기본 렌더러에서 안개를 왼쪽 화면 밖부터 오른쪽 화면 밖까지 반복 이동한다.
 * 첫 이동은 initialPhase부터 시작하고, 퇴장 후 pass를 증가시켜 다음 띠의 높이를 바꾼다.
 * 반환한 translateX·translateY·opacity는 Animated.View에 연결하고 top은 띠의 상단 위치로 사용한다.
 */
export function usePaperFogDrift({
  width,
  viewportWidth,
  viewportHeight,
  baseYRatio,
  seed,
  initialPhase,
  duration,
  delay,
  alpha,
}: {
  width: number;
  viewportWidth: number;
  viewportHeight: number;
  baseYRatio: number;
  seed: number;
  /** 첫 통과의 시작 위치(0~1). duration은 한 번의 전체 통과 시간이며 단위는 밀리초다. */
  initialPhase: number;
  duration: number;
  delay: number;
  alpha: number;
}) {
  const progress = useRef(new Animated.Value(initialPhase)).current;
  /** 화면 밖으로 완전히 퇴장한 횟수. 다음 진입의 높이를 계산할 때만 변경한다. */
  const [pass, setPass] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let completedPasses = 0;
    let animation: Animated.CompositeAnimation | null = null;
    setPass(0);
    progress.setValue(initialPhase);

    /** 첫 통과의 남은 구간 또는 새 통과 전체를 선형 이동하며, 퇴장 후 높이를 바꿔 다시 시작한다. */
    const startPass = (phase = 0) => {
      if (cancelled) return;
      progress.setValue(phase);
      animation = Animated.timing(progress, {
        toValue: 1,
        duration: duration * (1 - phase),
        easing: Easing.linear,
        useNativeDriver: true,
      });
      animation.start(({ finished }) => {
        if (!finished || cancelled) return;
        completedPasses += 1;
        setPass(completedPasses);
        startPass();
      });
    };

    const timeout = setTimeout(() => startPass(initialPhase), delay);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      animation?.stop();
    };
  }, [delay, duration, initialPhase, progress]);

  return {
    translateX: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [-width - PAPER_FOG_TRAVEL_MARGIN, viewportWidth + PAPER_FOG_TRAVEL_MARGIN],
    }),
    translateY: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -4, 0] }),
    opacity: progress.interpolate({ inputRange: [0, 0.06, 0.94, 1], outputRange: [0, alpha, alpha, 0] }),
    top: viewportHeight * getPaperFogYRatio(baseYRatio, pass, seed) - width * PAPER_FOG_HEIGHT_RATIO * 0.5,
  };
}
