import { useState, type CSSProperties } from "react";
import fogArtwork from "../assets/paper-fog-character.png";

const FOG_PROFILES = [
  { scale: 0.48, yRatio: 0.2, phase: 0.45, speed: 13, alpha: 0.36, tilt: -3 },
  { scale: 0.32, yRatio: 0.54, phase: 0.86, speed: 17, alpha: 0.29, tilt: 4 },
  { scale: 0.4, yRatio: 0.84, phase: 0.16, speed: 11, alpha: 0.22, tilt: -1 },
] as const;

/** 안개가 화면 밖에서 재진입할 때 기본 높이 주변으로 경로를 조금 바꾼다. 그림이 화면 안에 있을 때는 높이를 바꾸지 않는다. */
function getPassYRatio(baseRatio: number, pass: number, seed: number) {
  const noise = Math.sin(seed * 12.9898 + pass * 17.71) * 43758.5453;
  return Math.max(0.05, Math.min(0.95, baseRatio + (noise - Math.floor(noise) - 0.5) * 0.12));
}

/** 한 덩어리를 화면 밖에서부터 한 방향으로 이동한다. 반복 경계에서만 다음 높이를 정한다. */
function DriftingFogPuff({ index, width, height, clarity, cinematic }: {
  index: number; width: number; height: number; clarity: number; cinematic: boolean;
}) {
  const [pass, setPass] = useState(0);
  const profile = FOG_PROFILES[index];
  const puffWidth = width * profile.scale;
  // 기울어진 그림의 끝까지 화면 밖에 둬서 반복·높이 변경이 보이지 않게 한다.
  const margin = 48;
  const distance = width + puffWidth + margin * 2;
  const duration = distance / (profile.speed * (cinematic ? 0.85 : 1));
  const opacity = profile.alpha * (0.65 + clarity / 100 * 0.5);
  const style = {
    width: puffWidth,
    top: height * getPassYRatio(profile.yRatio, pass, index + 1) - puffWidth * 0.42 / 2,
    "--fog-from": `${-puffWidth - margin}px`,
    "--fog-to": `${width + margin}px`,
    "--fog-alpha": opacity,
    "--fog-duration": `${duration}s`,
    "--fog-delay": `${-profile.phase * duration}s`,
    "--fog-tilt": `${profile.tilt}deg`,
  } as CSSProperties;

  return (
    <div className="paper-fog-puff" style={style} onAnimationIteration={() => setPass((previous) => previous + 1)}>
      <img src={fogArtwork} alt="" draggable={false} />
    </div>
  );
}

/** 배경 안개 세 덩어리를 크기·진입 시점을 달리해 표시한다. width·height는 종이 화면의 실제 크기다. */
export function PaperFogPuffs({ width, height, clarity, cinematic }: {
  width: number; height: number; clarity: number; cinematic: boolean;
}) {
  return FOG_PROFILES.map((_, index) => (
    <DriftingFogPuff key={`${index}:${width}:${height}`} index={index}
      width={width} height={height} clarity={clarity} cinematic={cinematic} />
  ));
}
