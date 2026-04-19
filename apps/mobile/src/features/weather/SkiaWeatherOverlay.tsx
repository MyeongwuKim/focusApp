import { Component, type ReactNode, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group, Line } from '@shopify/react-native-skia';

type WeatherEffect = 'rain' | 'snow' | 'thunder' | null;
type WeatherMood = 'dreamy' | 'cinematic';

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

function wrap(value: number, max: number) {
  if (max <= 0) return 0;
  return ((value % max) + max) % max;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

  useEffect(() => {
    let rafId = 0;
    let last = 0;

    const loop = (timestamp: number) => {
      if (!last || timestamp - last >= 33) {
        setTimeMs(timestamp);
        last = timestamp;
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const clarityRatio = clamp(particleClarity, 0, 100) / 100;
  const clarityAlphaScale = 0.45 + clarityRatio * 1.2;
  const clarityCountScale = 0.7 + clarityRatio * 0.65;
  const clarityThicknessScale = 0.7 + clarityRatio * 0.95;
  const claritySpeedScale = 0.85 + clarityRatio * 0.35;

  const rainParticles = useMemo<RainParticle[]>(() => {
    const isCinematic = mood === 'cinematic';
    const baseCount = isCinematic ? 30 : 58;
    const count = Math.max(8, Math.round(baseCount * clarityCountScale));
    return Array.from({ length: count }, () => ({
      x: Math.random() * width,
      seed: Math.random() * 1000,
      speed: ((isCinematic ? 430 : 310) + Math.random() * (isCinematic ? 210 : 180)) * claritySpeedScale,
      length: (isCinematic ? 26 : 18) + Math.random() * (isCinematic ? 24 : 20),
      width: ((isCinematic ? 1.0 : 0.7) + Math.random() * (isCinematic ? 1.0 : 0.6)) * clarityThicknessScale,
      sway: (isCinematic ? 2 : 4) + Math.random() * (isCinematic ? 4 : 8),
      alpha: clamp(
        ((isCinematic ? 0.1 : 0.2) + Math.random() * (isCinematic ? 0.08 : 0.14)) * clarityAlphaScale,
        0.03,
        0.95
      ),
    }));
  }, [clarityAlphaScale, clarityCountScale, claritySpeedScale, clarityThicknessScale, mood, width]);

  const rainSplashes = useMemo<RainParticle[]>(() => {
    const isCinematic = mood === 'cinematic';
    const baseCount = isCinematic ? 8 : 20;
    const count = Math.max(4, Math.round(baseCount * clarityCountScale));
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
  }, [clarityAlphaScale, clarityCountScale, claritySpeedScale, mood, width]);

  const snowParticles = useMemo<SnowParticle[]>(() => {
    const isCinematic = mood === 'cinematic';
    const farBaseCount = isCinematic ? 12 : 32;
    const nearBaseCount = isCinematic ? 16 : 40;
    const farCount = Math.max(6, Math.round(farBaseCount * clarityCountScale));
    const nearCount = Math.max(8, Math.round(nearBaseCount * clarityCountScale));
    const far = Array.from({ length: farCount }, () => ({
      x: Math.random() * width,
      seed: Math.random() * 1000,
      speed: ((isCinematic ? 42 : 34) + Math.random() * (isCinematic ? 30 : 24)) * claritySpeedScale,
      radius: (isCinematic ? 0.9 : 1.5) + Math.random() * (isCinematic ? 1.8 : 2.4),
      sway: (isCinematic ? 3 : 6) + Math.random() * (isCinematic ? 5 : 9),
      alpha: clamp(
        ((isCinematic ? 0.05 : 0.13) + Math.random() * (isCinematic ? 0.06 : 0.12)) * clarityAlphaScale,
        0.02,
        0.7
      ),
      depth: 'far' as const,
    }));
    const near = Array.from({ length: nearCount }, () => ({
      x: Math.random() * width,
      seed: Math.random() * 1000,
      speed: ((isCinematic ? 68 : 54) + Math.random() * (isCinematic ? 38 : 32)) * claritySpeedScale,
      radius: (isCinematic ? 1.9 : 2.8) + Math.random() * (isCinematic ? 3.0 : 3.8),
      sway: (isCinematic ? 5 : 9) + Math.random() * (isCinematic ? 7 : 12),
      alpha: clamp(
        ((isCinematic ? 0.1 : 0.24) + Math.random() * (isCinematic ? 0.1 : 0.16)) * clarityAlphaScale,
        0.04,
        0.95
      ),
      depth: 'near' as const,
    }));
    return [...far, ...near];
  }, [clarityAlphaScale, clarityCountScale, claritySpeedScale, mood, width]);

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
                const wind = 0.035;
                const x =
                  particle.x +
                  Math.sin(t * 1.9 + particle.seed) * particle.sway +
                  y * wind * (mood === 'cinematic' ? 1.2 : 1);
                const p1 = { x, y };
                const p2 = { x: x + 5, y: y + particle.length };
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
                const y = wrap(t * particle.speed + particle.seed * 100, travel) - 70;
                const driftWave =
                  Math.sin(
                    y * 0.014 + t * (particle.depth === 'near' ? 1.3 : 0.9) + particle.seed
                  ) * particle.sway;
                const x = particle.x + driftWave;
                return (
                  <Circle
                    key={`snow-${index}`}
                    cx={x}
                    cy={y}
                    r={particle.radius}
                    color={
                      mood === 'cinematic'
                        ? `rgba(224,237,248,${particle.alpha})`
                        : `rgba(246,251,255,${particle.alpha})`
                    }
                  />
                );
              })
            : null}
        </Canvas>
      </SkiaErrorBoundary>
    </View>
  );
}
