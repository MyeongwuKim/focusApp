import type { CSSProperties } from "react";
import {
  PAPER_FALLING_COLORS as colors, PAPER_RAIN_OUTLINE, PAPER_RAIN_SKETCH,
  PAPER_SNOW_OUTLINE, PAPER_SNOW_DETAIL,
} from "../paperFallingArtwork";

// 같은 화면 크기에서는 다시 렌더링해도 입자 경로가 바뀌지 않게 위치·크기·시작 시점을 고정한다.
const PROFILES = Array.from({ length: 48 }, (_, index) => {
  const seed = (offset: number) => {
    const noise = Math.sin((index + 1) * 12.9898 + offset * 78.233) * 43758.5453;
    return noise - Math.floor(noise);
  };
  return { x: seed(1), size: seed(2), phase: seed(3), speed: seed(4), alpha: seed(5), drift: seed(6) };
});

/** 물방울의 면과 어긋난 두 연필 선을 그린다. 흰 하이라이트 대신 옅은 내부 곡선만 남긴다. */
function PaperRainMark() {
  return (
    <svg viewBox="0 0 12 18" fill="none" aria-hidden="true">
      <path d={PAPER_RAIN_OUTLINE} fill={colors.rain} fillOpacity="0.55" stroke={colors.rainInk}
        strokeWidth="0.75" strokeOpacity="0.7" strokeLinejoin="round" />
      <path d={PAPER_RAIN_SKETCH} stroke={colors.rainInk} strokeWidth="0.45" strokeOpacity="0.28" strokeLinecap="round" />
      <path d="M 3.1 11.8 Q 2.8 14 4.6 14.8" stroke={colors.rainInk} strokeWidth="0.55"
        strokeOpacity="0.23" strokeLinecap="round" />
    </svg>
  );
}

/** 먼 눈은 작은 종이 점, 가까운 눈은 둥근 여섯 갈래로 표시한다. 과한 광택·그림자는 사용하지 않는다. */
function PaperSnowMark({ flake }: { flake: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {flake ? (
        <>
          <path d={PAPER_SNOW_OUTLINE} fill={colors.snow} fillOpacity="0.85" stroke={colors.snowInk}
            strokeWidth="0.75" strokeOpacity="0.7" strokeLinejoin="round" />
          <path d={PAPER_SNOW_DETAIL} stroke={colors.snowDetail} strokeWidth="0.7"
            strokeOpacity="0.4" strokeLinecap="round" />
        </>
      ) : <circle cx="8" cy="8" r="4.5" fill={colors.snow} stroke={colors.snowInk} strokeWidth="0.75" strokeOpacity="0.6" />}
    </svg>
  );
}

/**
 * 종이 화면 크기에 맞춰 비·눈을 낙하시킨다. clarity는 수와 선명도, cinematic은 수와 속도를 조절한다.
 * 입자는 화면 밖에서 반복하고 시작 시점을 분산한다. 실제 이동은 CSS가 담당해 매 프레임 상태를 갱신하지 않는다.
 */
export function PaperFallingMarks({ effect, width, height, clarity, cinematic }: {
  effect: "rain" | "snow"; width: number; height: number; clarity: number; cinematic: boolean;
}) {
  const snow = effect === "snow";
  const clarityRatio = clarity / 100;
  const count = Math.min(PROFILES.length, Math.max(10,
    Math.round(width / 390 * (snow ? 28 : 22) * (0.75 + clarityRatio * 0.35) * (cinematic ? 0.8 : 1))));
  return PROFILES.slice(0, count).map((profile, index) => {
    const size = snow ? 6 + profile.size * 7 : 10 + profile.size * 4;
    const duration = (snow ? 11 + profile.speed * 7 : 4.2 + profile.speed * 2) * (cinematic ? 0.85 : 1);
    const drift = snow ? (profile.drift - 0.5) * 45 : 9 + profile.drift * 7;
    const style = {
      left: width * profile.x, width: snow ? size : size * 2 / 3, height: size,
      "--fall-distance": `${height + 48}px`, "--fall-drift": `${drift}px`,
      "--fall-sway": `${snow ? (index % 2 ? -12 : 12) : drift * 0.45}px`,
      "--fall-duration": `${duration}s`, "--fall-delay": `${-profile.phase * duration}s`,
      "--fall-alpha": (snow ? 0.48 + profile.alpha * 0.2 : 0.48 + profile.alpha * 0.12) * (0.7 + clarityRatio * 0.3),
      "--fall-rotation": snow ? `${profile.drift * 60 - 30}deg` : "-7deg",
    } as CSSProperties;
    return (
      <div key={`${index}:${width}:${height}`} className={`paper-falling-mark paper-${effect}-mark`} style={style}>
        {snow ? <PaperSnowMark flake={size >= 8.5} /> : <PaperRainMark />}
      </div>
    );
  });
}
