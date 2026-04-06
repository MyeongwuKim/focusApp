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
  width,
  height,
  impactBottomOffset,
  onRenderFail,
}: {
  effect: WeatherEffect;
  mood: WeatherMood;
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

  const rainParticles = useMemo<RainParticle[]>(() => {
    const isCinematic = mood === 'cinematic';
    const count = isCinematic ? 96 : 84;
    return Array.from({ length: count }, () => ({
      x: Math.random() * width,
      seed: Math.random() * 1000,
      speed: (isCinematic ? 460 : 390) + Math.random() * (isCinematic ? 240 : 210),
      length: 12 + Math.random() * 24,
      width: 0.8 + Math.random() * 1.4,
      sway: 2 + Math.random() * 6,
      alpha: (isCinematic ? 0.35 : 0.42) + Math.random() * 0.38,
    }));
  }, [mood, width]);

  const rainSplashes = useMemo<RainParticle[]>(() => {
    const isCinematic = mood === 'cinematic';
    const count = isCinematic ? 20 : 28;
    return Array.from({ length: count }, () => ({
      x: Math.random() * width,
      seed: Math.random() * 1000,
      speed: 0.8 + Math.random() * 1.8,
      length: 8 + Math.random() * 10,
      width: 1,
      sway: 4 + Math.random() * 10,
      alpha: (isCinematic ? 0.2 : 0.26) + Math.random() * 0.28,
    }));
  }, [mood, width]);

  const snowParticles = useMemo<SnowParticle[]>(() => {
    const isCinematic = mood === 'cinematic';
    const farCount = isCinematic ? 28 : 34;
    const nearCount = isCinematic ? 36 : 44;
    const far = Array.from({ length: farCount }, () => ({
      x: Math.random() * width,
      seed: Math.random() * 1000,
      speed: (isCinematic ? 34 : 40) + Math.random() * 24,
      radius: 1.1 + Math.random() * 2.1,
      sway: 4 + Math.random() * 6,
      alpha: (isCinematic ? 0.16 : 0.2) + Math.random() * 0.18,
      depth: 'far' as const,
    }));
    const near = Array.from({ length: nearCount }, () => ({
      x: Math.random() * width,
      seed: Math.random() * 1000,
      speed: (isCinematic ? 52 : 60) + Math.random() * 34,
      radius: 2.2 + Math.random() * 3.1,
      sway: 7 + Math.random() * 10,
      alpha: (isCinematic ? 0.24 : 0.3) + Math.random() * 0.25,
      depth: 'near' as const,
    }));
    return [...far, ...near];
  }, [mood, width]);

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
                    color={`rgba(188,223,255,${particle.alpha})`}
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
                    <Circle cx={baseX} cy={baseY} r={ringRadius} color={`rgba(188,223,255,${opacity})`} />
                    <Circle
                      cx={baseX - particle.sway * pulse}
                      cy={baseY - sprayLift}
                      r={Math.max(0.8, particle.length * 0.08)}
                      color={`rgba(204,232,255,${opacity * 0.92})`}
                    />
                    <Circle
                      cx={baseX + particle.sway * pulse}
                      cy={baseY - sprayLift * 0.9}
                      r={Math.max(0.8, particle.length * 0.08)}
                      color={`rgba(204,232,255,${opacity * 0.92})`}
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
                    color={`rgba(242,249,255,${particle.alpha})`}
                  />
                );
              })
            : null}
        </Canvas>
      </SkiaErrorBoundary>
    </View>
  );
}
