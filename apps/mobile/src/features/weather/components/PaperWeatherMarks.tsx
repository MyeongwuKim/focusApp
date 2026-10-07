import { StyleSheet, View } from 'react-native';
import { Circle, Group, Path } from '@shopify/react-native-skia';
import {
  PAPER_RAIN_PATH,
  PAPER_SNOW_DETAIL_PATH,
  PAPER_SNOW_PATH,
  PAPER_WEATHER_COLORS as colors,
} from '../paperWeatherArtwork';

/** 기본 렌더러의 물방울 모양. 정사각형의 한 모서리를 뾰족하게 하고 연필색 테두리를 두른다. */
export function PaperRainMark({ size }: { size: number }) {
  const side = size * 0.65;
  return (
    <View
      style={[
        styles.drop,
        { width: side, height: side, borderRadius: side * 0.55, borderTopLeftRadius: side * 0.12 },
      ]}>
      <View style={[styles.glint, { height: side * 0.28, left: side * 0.2, top: side * 0.38 }]} />
    </View>
  );
}

/** 기본 렌더러의 눈. 작은 입자는 종이 점으로, 큰 입자는 세 선이 겹친 여섯 갈래로 표시한다. */
export function PaperSnowMark({ size }: { size: number }) {
  if (size < 7) {
    return <View style={[styles.snowDot, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  const thickness = Math.max(2.4, size * 0.25);
  return (
    <View style={{ width: size, height: size }}>
      {[0, 60, 120].map((angle) => (
        <View
          key={angle}
          style={[
            styles.snowArm,
            { width: thickness, height: size, left: (size - thickness) / 2, transform: [{ rotate: `${angle}deg` }] },
          ]}
        />
      ))}
    </View>
  );
}

type CanvasMarkProps = {
  /** 화면에서 입자 중심을 놓을 좌표. 낙하와 흔들림은 상위 오버레이에서 계산한다. */
  x: number;
  y: number;
  /** 물방울은 높이, 눈송이는 지름이며 단위는 화면 포인트다. */
  size: number;
  opacity: number;
  /** 중심을 기준으로 회전할 각도. Skia에서 사용하는 라디안 단위다. */
  rotation: number;
};

/** Skia 화면에 비대칭 물방울과 짧은 종이색 하이라이트를 그린다. 이동·투명도는 전달받는다. */
export function SkiaPaperRainMark({ x, y, size, opacity, rotation }: CanvasMarkProps) {
  return (
    <Group opacity={opacity} transform={[{ translateX: x }, { translateY: y }, { rotate: rotation }, { scale: size / 18 }]}>
      <Group transform={[{ translateX: -6 }, { translateY: -9 }]}>
        <Path path={PAPER_RAIN_PATH} color={colors.rain} />
        <Path path={PAPER_RAIN_PATH} color={colors.rainInk} style="stroke" strokeWidth={1} strokeJoin="round" />
        <Path path="M 3.4 11.4 Q 3 13.8 4.8 14.7" color={colors.highlight} style="stroke" strokeWidth={1.2} strokeCap="round" />
      </Group>
    </Group>
  );
}

/** Skia의 먼 눈은 테두리 있는 점으로, 가까운 눈은 안쪽 연필 선이 있는 종이 눈송이로 그린다. */
export function SkiaPaperSnowMark({ x, y, size, opacity, rotation, flake }: CanvasMarkProps & { flake: boolean }) {
  return (
    <Group opacity={opacity} transform={[{ translateX: x }, { translateY: y }, { rotate: rotation }]}>
      {flake ? (
        <Group transform={[{ scale: size / 16 }, { translateX: -8 }, { translateY: -8 }]}>
          <Path path={PAPER_SNOW_PATH} color={colors.snow} />
          <Path path={PAPER_SNOW_PATH} color={colors.snowInk} style="stroke" strokeWidth={0.85} strokeJoin="round" />
          <Path path={PAPER_SNOW_DETAIL_PATH} color={colors.snowDetail} style="stroke" strokeWidth={0.75} strokeCap="round" />
        </Group>
      ) : (
        <>
          <Circle r={size / 2} color={colors.snow} />
          <Circle r={size / 2} color={colors.snowInk} style="stroke" strokeWidth={0.65} />
        </>
      )}
    </Group>
  );
}

const styles = StyleSheet.create({
  drop: {
    alignSelf: 'center',
    backgroundColor: colors.rain,
    borderWidth: 0.8,
    borderColor: colors.rainInk,
    transform: [{ rotate: '45deg' }],
  },
  glint: { position: 'absolute', width: 1.2, borderRadius: 2, backgroundColor: colors.highlight },
  snowDot: { backgroundColor: colors.snow, borderWidth: 0.65, borderColor: colors.snowInk },
  snowArm: {
    position: 'absolute',
    borderRadius: 3,
    backgroundColor: colors.snow,
    borderWidth: 0.65,
    borderColor: colors.snowInk,
  },
});
