import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import { SkiaPaperRainMark, SkiaPaperSnowMark } from './components/PaperWeatherMarks';
import { SkiaPaperFogMark } from './components/PaperFogMarks';
import { PAPER_FOG_Y_RATIOS, PAPER_WEATHER_COLORS } from './paperWeatherArtwork';
import { getPaperFogFrame } from './paperFogMotion';

type WeatherEffect = 'rain' | 'snow' | 'thunder' | 'fog' | null;
type WeatherMood = 'dreamy' | 'cinematic';
type PerfTier = 'high' | 'balanced' | 'low';

type RainParticle = {
  x: number;
  seed: number;
  speed: number;
  /** 낙하 입자에서는 물방울 높이, 바닥 입자에서는 퍼지는 물결의 크기다. */
  length: number;
  sway: number;
  alpha: number;
};

type SnowParticle = {
  x: number;
  seed: number;
  speed: number;
  radius: number;
  sway: number;
  alpha: number;
  depth: 'far' | 'near';
};

type FogSprite = {
  /** 첫 통과의 시작 위치(0~1). 띠마다 진입 시점을 다르게 한다. */
  xPhase: number;
  /** 매 통과마다 다음 높이를 결정하는 난수 시드다. */
  seed: number;
  yRatio: number;
  scale: number;
  speed: number;
  alpha: number;
  /** true이면 작은 진한 안개 덩어리이며, 큰 옅은 덩어리보다 조금 빠르게 이동한다. */
  foreground: boolean;
};

function wrap(value: number, max: number) {
  if (max <= 0) return 0;
  return ((value % max) + max) % max;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function seededNoise(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

class SkiaErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

/** 비·눈의 낙하와 안개 띠의 가로 이동을 갱신해 스케치북에 맞춘 종이 모양으로 표시한다. */
export function SkiaWeatherOverlay({
  effect,
  mood,
  particleClarity,
  width,
  height,
  impactBottomOffset,
  onRenderFail,
}: {
  effect: WeatherEffect;
  mood: WeatherMood;
  particleClarity: number;
  width: number;
  height: number;
  impactBottomOffset: number;
  onRenderFail: () => void;
}) {
  const [timeMs, setTimeMs] = useState(0);
  const [perfTier, setPerfTier] = useState<PerfTier>('high');
  /** 안개를 켠 뒤 첫 프레임의 시각. 성능 단계가 바뀌어도 경과 시간의 기준을 유지한다. */
  const fogTimeOriginRef = useRef<number | null>(null);

  useEffect(() => {
    fogTimeOriginRef.current = null;
    if (effect === 'fog') setTimeMs(0);
  }, [effect]);

  useEffect(() => {
    const tierScale =
      effect === 'snow'
        ? perfTier === 'high'
          ? 1
          : perfTier === 'balanced'
            ? 1.12
            : 1.28
        : perfTier === 'high'
          ? 1
          : perfTier === 'balanced'
            ? 1.25
            : 1.55;
    const baseIntervalMs =
      effect === 'rain' || effect === 'thunder' ? 33 : effect === 'snow' ? 24 : 66;
    const frameIntervalMs = Math.round(baseIntervalMs * tierScale);
    let rafId = 0;
    let last = 0;
    let emaFrameMs = 16.7;
    let lastTierCheck = 0;
    let currentTier = perfTier;

    const loop = (timestamp: number) => {
      if (last) {
        const delta = timestamp - last;
        emaFrameMs = emaFrameMs * 0.9 + delta * 0.1;
      }

      if (!lastTierCheck || timestamp - lastTierCheck > 1200) {
        let nextTier = currentTier;
        if (currentTier === 'high' && emaFrameMs > 24) {
          nextTier = 'balanced';
        } else if (currentTier === 'balanced' && emaFrameMs > 30) {
          nextTier = 'low';
        } else if (currentTier === 'balanced' && emaFrameMs < 20) {
          nextTier = 'high';
        } else if (currentTier === 'low' && emaFrameMs < 25) {
          nextTier = 'balanced';
        }

        if (nextTier !== currentTier) {
          currentTier = nextTier;
          setPerfTier(nextTier);
        }
        lastTierCheck = timestamp;
      }

      if (!last || timestamp - last >= frameIntervalMs) {
        if (effect === 'fog') {
          fogTimeOriginRef.current ??= timestamp;
          setTimeMs(timestamp - fogTimeOriginRef.current);
        } else {
          setTimeMs(timestamp);
        }
        last = timestamp;
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [effect, perfTier]);

  const clarityRatio = clamp(particleClarity, 0, 100) / 100;
  const perfCountScale = perfTier === 'high' ? 1 : perfTier === 'balanced' ? 0.8 : 0.62;
  const clarityAlphaScale = 0.45 + clarityRatio * 1.2;
  const baseClarityCountScale = 0.7 + clarityRatio * 0.65;
  const rainClarityCountScale = baseClarityCountScale * perfCountScale;
  const snowClarityCountScale = baseClarityCountScale * 0.72;
  const clarityThicknessScale = 0.7 + clarityRatio * 0.95;
  const claritySpeedScale = 0.85 + clarityRatio * 0.35;

  const rainParticles = useMemo<RainParticle[]>(() => {
    const isCinematic = mood === 'cinematic';
    const baseCount = isCinematic ? 16 : 24;
    const count = Math.max(8, Math.round(baseCount * rainClarityCountScale));
    return Array.from({ length: count }, () => ({
      x: Math.random() * width,
      seed: Math.random() * 1000,
      speed: ((isCinematic ? 190 : 145) + Math.random() * 95) * claritySpeedScale,
      length: (isCinematic ? 9 : 10) + Math.random() * 5,
      sway: (isCinematic ? 0.6 : 0.8) + Math.random() * (isCinematic ? 1.2 : 1.8),
      alpha: clamp(
        ((isCinematic ? 0.2 : 0.28) + Math.random() * 0.14) * clarityAlphaScale,
        0.03,
        0.95
      ),
    }));
  }, [clarityAlphaScale, rainClarityCountScale, claritySpeedScale, mood, width]);

  const rainSplashes = useMemo<RainParticle[]>(() => {
    const isCinematic = mood === 'cinematic';
    const baseCount = isCinematic ? 4 : 7;
    const count = Math.max(4, Math.round(baseCount * rainClarityCountScale));
    return Array.from({ length: count }, () => ({
      x: Math.random() * width,
      seed: Math.random() * 1000,
      speed: ((isCinematic ? 1.4 : 1.0) + Math.random() * (isCinematic ? 1.9 : 2.4)) * claritySpeedScale,
      length: (isCinematic ? 7 : 10) + Math.random() * (isCinematic ? 8 : 12),
      sway: (isCinematic ? 3 : 5) + Math.random() * (isCinematic ? 7 : 12),
      alpha: clamp(
        ((isCinematic ? 0.07 : 0.14) + Math.random() * (isCinematic ? 0.08 : 0.14)) * clarityAlphaScale,
        0.04,
        0.9
      ),
    }));
  }, [clarityAlphaScale, rainClarityCountScale, claritySpeedScale, mood, width]);

  const snowParticles = useMemo<SnowParticle[]>(() => {
    const isCinematic = mood === 'cinematic';
    const farBaseCount = isCinematic ? 8 : 12;
    const nearBaseCount = isCinematic ? 10 : 16;
    const farCount = Math.max(6, Math.round(farBaseCount * snowClarityCountScale));
    const nearCount = Math.max(8, Math.round(nearBaseCount * snowClarityCountScale));
    const far = Array.from({ length: farCount }, (_, index) => {
      const seedBase = index * 19.31 + (isCinematic ? 80 : 120);
      const r1 = seededNoise(seedBase + 0.11);
      const r2 = seededNoise(seedBase + 0.73);
      const r3 = seededNoise(seedBase + 1.37);
      const r4 = seededNoise(seedBase + 2.19);
      const r5 = seededNoise(seedBase + 2.81);
      const r6 = seededNoise(seedBase + 3.49);
      return {
        x: r1 * width,
        seed: r2 * 1000,
        speed: ((isCinematic ? 28 : 24) + r3 * (isCinematic ? 18 : 16)) * claritySpeedScale,
        radius: (isCinematic ? 0.9 : 1.4) + r4 * (isCinematic ? 1.2 : 1.8),
        sway: (isCinematic ? 2.2 : 3.2) + r5 * (isCinematic ? 3.4 : 5.2),
        alpha: clamp(
          ((isCinematic ? 0.05 : 0.11) + r6 * (isCinematic ? 0.05 : 0.09)) * clarityAlphaScale,
          0.02,
          0.58
        ),
        depth: 'far' as const,
      };
    });
    const near = Array.from({ length: nearCount }, (_, index) => {
      const seedBase = index * 23.47 + (isCinematic ? 170 : 220);
      const r1 = seededNoise(seedBase + 0.07);
      const r2 = seededNoise(seedBase + 0.67);
      const r3 = seededNoise(seedBase + 1.41);
      const r4 = seededNoise(seedBase + 2.05);
      const r5 = seededNoise(seedBase + 2.73);
      const r6 = seededNoise(seedBase + 3.59);
      return {
        x: r1 * width,
        seed: r2 * 1000,
        speed: ((isCinematic ? 44 : 38) + r3 * (isCinematic ? 20 : 18)) * claritySpeedScale,
        radius: (isCinematic ? 4 : 4.5) + r4 * 2.5,
        sway: (isCinematic ? 8 : 12) + r5 * 10,
        alpha: clamp(
          ((isCinematic ? 0.24 : 0.32) + r6 * 0.14) * clarityAlphaScale,
          0.04,
          0.82
        ),
        depth: 'near' as const,
      };
    });
    return [...far, ...near];
  }, [clarityAlphaScale, snowClarityCountScale, claritySpeedScale, mood, width]);

  const fogSprites = useMemo<FogSprite[]>(() => {
    const isCinematic = mood === 'cinematic';
    const fogAlphaScale = 0.7 + clarityRatio * 0.55;
    const spriteCount = PAPER_FOG_Y_RATIOS.length;

    return Array.from({ length: spriteCount }, (_, index) => {
      const seed = (index + 1) * 17.71;
      const r1 = seededNoise(seed + 0.13);
      const r3 = seededNoise(seed + 1.77);
      const r5 = seededNoise(seed + 3.44);
      const r6 = seededNoise(seed + 4.21);
      const r7 = seededNoise(seed + 5.08);

      const yRatio = PAPER_FOG_Y_RATIOS[index] + (r1 - 0.5) * 0.035;
      const foreground = index % 2 === 1;
      const alphaBase = foreground
        ? (isCinematic ? 0.48 : 0.56) + r5 * 0.08
        : (isCinematic ? 0.3 : 0.36) + r5 * 0.055;
      const alpha = clamp(alphaBase * fogAlphaScale, 0.08, foreground ? 0.74 : 0.5);

      return {
        xPhase: (index + r3 * 0.4) / spriteCount,
        seed,
        yRatio,
        scale: foreground ? 0.3 + r6 * 0.09 : 0.4 + r6 * 0.12,
        speed: (foreground ? 18 : isCinematic ? 11 : 13) + r7 * 5,
        alpha,
        foreground,
      };
    });
  }, [clarityRatio, mood]);

  if (!effect) {
    return null;
  }

  const t = timeMs / 1000;
  const rainLayer = effect === 'rain' || effect === 'thunder';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <SkiaErrorBoundary onError={onRenderFail}>
        <Canvas style={StyleSheet.absoluteFill}>
          {rainLayer
            ? rainParticles.map((particle, index) => {
                const travel = height + 260;
                const y = wrap(t * particle.speed + particle.seed * 120, travel) - 130;
                const wind = mood === 'cinematic' ? 0.032 : 0.04;
                const x =
                  particle.x +
                  Math.sin(t * 1.7 + particle.seed) * particle.sway +
                  y * wind;
                return (
                  <SkiaPaperRainMark
                    key={`rain-drop-${index}`}
                    x={x}
                    y={y}
                    size={particle.length * clarityThicknessScale}
                    opacity={particle.alpha}
                    rotation={-0.12}
                  />
                );
              })
            : null}

          {rainLayer
            ? rainSplashes.map((particle, index) => {
                const cycle = wrap(t * particle.speed + particle.seed, 1);
                const pulse = cycle < 0.32 ? cycle / 0.32 : 0;
                if (!pulse) {
                  return null;
                }
                const ringRadius = 1 + pulse * particle.length;
                const sprayLift = pulse * (particle.length * 0.7);
                const opacity = particle.alpha * (1 - pulse);
                const baseY = height - impactBottomOffset;
                const baseX = particle.x + Math.sin(t * 1.3 + particle.seed) * 6;
                return (
                  <Group key={`rain-splash-${index}`}>
                    <Group transform={[{ translateX: baseX }, { translateY: baseY }, { scaleY: 0.28 }]} opacity={opacity}>
                      <Circle r={ringRadius} color={PAPER_WEATHER_COLORS.rainInk} style="stroke" strokeWidth={1.2} />
                    </Group>
                    <Circle
                      cx={baseX - particle.sway * pulse}
                      cy={baseY - sprayLift}
                      r={Math.max(0.8, particle.length * 0.08)}
                      color={PAPER_WEATHER_COLORS.rainInk}
                      opacity={opacity * 0.86}
                    />
                    <Circle
                      cx={baseX + particle.sway * pulse}
                      cy={baseY - sprayLift * 0.9}
                      r={Math.max(0.8, particle.length * 0.08)}
                      color={PAPER_WEATHER_COLORS.rainInk}
                      opacity={opacity * 0.86}
                    />
                  </Group>
                );
              })
            : null}

          {effect === 'snow'
            ? snowParticles.map((particle, index) => {
                const travel = height + 140;
                const wrappedY = wrap(t * particle.speed + particle.seed * 100, travel);
                const y = wrappedY - 70;
                const cycle = wrappedY / travel;
                const fadeIn = clamp(cycle / 0.08, 0, 1);
                const fadeOut = clamp((1 - cycle) / 0.16, 0, 1);
                const edgeFade = fadeIn * fadeOut;
                const finalAlpha = Math.max(0.001, particle.alpha * edgeFade);
                const driftWave =
                  Math.sin(t * (particle.depth === 'near' ? 1.05 : 0.74) + particle.seed * 0.015) *
                  particle.sway;
                const x = particle.x + driftWave;
                return (
                  <SkiaPaperSnowMark
                    key={`snow-${index}`}
                    x={x}
                    y={y}
                    size={particle.radius * 2}
                    opacity={finalAlpha}
                    rotation={Math.sin(t * 0.65 + particle.seed) * 0.35}
                    flake={particle.depth === 'near'}
                  />
                );
              })
            : null}

          {effect === 'fog'
            ? fogSprites.map((sprite, index) => {
                const drawW = width * sprite.scale;
                const { x, y, opacity } = getPaperFogFrame({
                  elapsedSeconds: t,
                  width: drawW,
                  viewportWidth: width,
                  viewportHeight: height,
                  initialPhase: sprite.xPhase,
                  speed: sprite.speed,
                  yRatio: sprite.yRatio,
                  seed: sprite.seed,
                  alpha: sprite.alpha,
                });

                return (
                  <SkiaPaperFogMark key={`fog-strip-${index}`} x={x} y={y} width={drawW} opacity={opacity} foreground={sprite.foreground} />
                );
              })
            : null}
        </Canvas>
      </SkiaErrorBoundary>
    </View>
  );
}
