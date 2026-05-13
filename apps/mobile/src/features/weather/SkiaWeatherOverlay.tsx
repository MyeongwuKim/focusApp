import { Component, type ReactNode, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group, Image, Line, Rect, useImage } from '@shopify/react-native-skia';

type WeatherEffect = 'rain' | 'snow' | 'thunder' | 'fog' | null;
type WeatherMood = 'dreamy' | 'cinematic';
type PerfTier = 'high' | 'balanced' | 'low';

type RainParticle = {
  x: number;
  seed: number;
  speed: number;
  length: number;
  width: number;
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
  textureIndex: number;
  xPhase: number;
  direction: 1 | -1;
  yRatio: number;
  scale: number;
  speed: number;
  sway: number;
  alpha: number;
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
  const fogTexture01 = useImage(require('./assets/fog/fog_tex_01.png'));
  const fogTexture02 = useImage(require('./assets/fog/fog_tex_02.png'));
  const fogTexture03 = useImage(require('./assets/fog/fog_tex_03.png'));
  const fogTextures = [fogTexture01, fogTexture02, fogTexture03];
  const isFogTexturesReady = fogTextures.every(Boolean);

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
        setTimeMs(timestamp);
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
    const baseCount = isCinematic ? 30 : 58;
    const count = Math.max(8, Math.round(baseCount * rainClarityCountScale));
    return Array.from({ length: count }, () => ({
      x: Math.random() * width,
      seed: Math.random() * 1000,
      speed: ((isCinematic ? 430 : 310) + Math.random() * (isCinematic ? 210 : 180)) * claritySpeedScale,
      length: (isCinematic ? 26 : 18) + Math.random() * (isCinematic ? 24 : 20),
      width: ((isCinematic ? 1.0 : 0.7) + Math.random() * (isCinematic ? 1.0 : 0.6)) * clarityThicknessScale,
      sway: (isCinematic ? 0.6 : 0.8) + Math.random() * (isCinematic ? 1.2 : 1.8),
      alpha: clamp(
        ((isCinematic ? 0.1 : 0.2) + Math.random() * (isCinematic ? 0.08 : 0.14)) * clarityAlphaScale,
        0.03,
        0.95
      ),
    }));
  }, [clarityAlphaScale, rainClarityCountScale, claritySpeedScale, clarityThicknessScale, mood, width]);

  const rainSplashes = useMemo<RainParticle[]>(() => {
    const isCinematic = mood === 'cinematic';
    const baseCount = isCinematic ? 8 : 20;
    const count = Math.max(4, Math.round(baseCount * rainClarityCountScale));
    return Array.from({ length: count }, () => ({
      x: Math.random() * width,
      seed: Math.random() * 1000,
      speed: ((isCinematic ? 1.4 : 1.0) + Math.random() * (isCinematic ? 1.9 : 2.4)) * claritySpeedScale,
      length: (isCinematic ? 7 : 10) + Math.random() * (isCinematic ? 8 : 12),
      width: 1,
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
    const farBaseCount = isCinematic ? 8 : 16;
    const nearBaseCount = isCinematic ? 12 : 20;
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
        radius: (isCinematic ? 1.7 : 2.4) + r4 * (isCinematic ? 2.2 : 2.8),
        sway: (isCinematic ? 3.6 : 5.0) + r5 * (isCinematic ? 4.4 : 6.2),
        alpha: clamp(
          ((isCinematic ? 0.09 : 0.19) + r6 * (isCinematic ? 0.08 : 0.12)) * clarityAlphaScale,
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
    const fogAlphaScale = 0.86 + clarityRatio * 0.5;
    const spriteCount = isCinematic ? 14 : 18;
    const span = Math.max(width, 360) * 3.2 + 1800;

    return Array.from({ length: spriteCount }, (_, index) => {
      const seed = (index + 1) * 17.71;
      const r1 = seededNoise(seed + 0.13);
      const r2 = seededNoise(seed + 0.91);
      const r3 = seededNoise(seed + 1.77);
      const r4 = seededNoise(seed + 2.66);
      const r5 = seededNoise(seed + 3.44);
      const r6 = seededNoise(seed + 4.21);
      const r7 = seededNoise(seed + 5.08);
      const r8 = seededNoise(seed + 6.14);

      const yRatio = 0.07 + r1 * 0.86;
      const centerWeight = 1 - Math.min(1, Math.abs(yRatio - 0.5) * 1.35);
      const alphaBase = (isCinematic ? 0.13 : 0.18) + r5 * (isCinematic ? 0.08 : 0.11);
      const alpha = clamp(alphaBase * fogAlphaScale * (0.86 + centerWeight * 0.34), 0.06, 0.3);

      return {
        textureIndex: Math.min(2, Math.floor(r2 * 3)),
        xPhase: r3 * span,
        direction: r4 > 0.5 ? 1 : -1,
        yRatio,
        scale: (isCinematic ? 0.78 : 0.9) + r6 * (isCinematic ? 0.56 : 0.72),
        speed: (isCinematic ? 0.9 : 1.1) + r7 * (isCinematic ? 1.8 : 2.2),
        sway: (isCinematic ? 4 : 5.5) + r8 * (isCinematic ? 8 : 11),
        alpha,
      };
    });
  }, [clarityRatio, mood, width]);

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
                const p1 = { x, y };
                const p2 = { x: x + particle.length * 0.18, y: y + particle.length };
                return (
                  <Line
                    key={`rain-streak-${index}`}
                    p1={p1}
                    p2={p2}
                    color={
                      mood === 'cinematic'
                        ? `rgba(168,206,244,${particle.alpha})`
                        : `rgba(196,229,255,${particle.alpha})`
                    }
                    strokeWidth={particle.width}
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
                    <Circle
                      cx={baseX}
                      cy={baseY}
                      r={ringRadius}
                      color={
                        mood === 'cinematic'
                          ? `rgba(171,209,245,${opacity})`
                          : `rgba(198,231,255,${opacity})`
                      }
                    />
                    <Circle
                      cx={baseX - particle.sway * pulse}
                      cy={baseY - sprayLift}
                      r={Math.max(0.8, particle.length * 0.08)}
                      color={
                        mood === 'cinematic'
                          ? `rgba(176,208,234,${opacity * 0.86})`
                          : `rgba(211,236,255,${opacity * 0.86})`
                      }
                    />
                    <Circle
                      cx={baseX + particle.sway * pulse}
                      cy={baseY - sprayLift * 0.9}
                      r={Math.max(0.8, particle.length * 0.08)}
                      color={
                        mood === 'cinematic'
                          ? `rgba(176,208,234,${opacity * 0.86})`
                          : `rgba(211,236,255,${opacity * 0.86})`
                      }
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
                  <Circle
                    key={`snow-${index}`}
                    cx={x}
                    cy={y}
                    r={particle.radius}
                    color={
                      mood === 'cinematic'
                        ? `rgba(224,237,248,${finalAlpha})`
                        : `rgba(246,251,255,${finalAlpha})`
                    }
                  />
                );
              })
            : null}

          {effect === 'fog' && isFogTexturesReady ? (
            <>
              <Rect
                x={0}
                y={0}
                width={width}
                height={height}
                color={mood === 'cinematic' ? 'rgba(188,205,224,0.06)' : 'rgba(222,234,248,0.085)'}
              />
              {fogSprites.map((sprite, index) => {
                const texture = fogTextures[sprite.textureIndex];
                if (!texture) {
                  return null;
                }
                const texW = texture.width();
                const texH = texture.height();
                if (texW <= 0 || texH <= 0) {
                  return null;
                }

                const drawW = width * sprite.scale;
                const drawH = drawW * (texH / texW);
                const travel = width + drawW * 2.4;
                const progress = wrap(t * sprite.speed + sprite.xPhase, travel);
                const x = sprite.direction === 1 ? progress - drawW * 1.2 : width - progress - drawW * 1.2;
                const yBase = height * sprite.yRatio - drawH * 0.5;
                const y = yBase + Math.sin(t * 0.24 + sprite.xPhase * 0.013) * sprite.sway;

                return (
                  <Group key={`fog-sprite-${index}`} opacity={sprite.alpha}>
                    <Image image={texture} x={x} y={y} width={drawW} height={drawH} fit="fill" />
                  </Group>
                );
              })}
            </>
          ) : null}
        </Canvas>
      </SkiaErrorBoundary>
    </View>
  );
}
