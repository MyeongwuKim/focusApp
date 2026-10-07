import { Image as NativeImage } from 'react-native';
import { Group, Path } from '@shopify/react-native-skia';
import {
  PAPER_FOG_DETAIL_PATH,
  PAPER_FOG_HEIGHT_RATIO,
  PAPER_FOG_PATH,
  PAPER_WEATHER_COLORS as colors,
} from '../paperWeatherArtwork';

type FogMarkProps = {
  /** 안개 그림의 화면 너비. 높이는 PAPER_FOG_HEIGHT_RATIO에 맞춰 계산한다. */
  width: number;
  /** true이면 작은 진한 덩어리, false이면 큰 옅은 덩어리로 표시한다. */
  foreground?: boolean;
};

/** Skia 실패 시 같은 크림색 면과 연필선을 가진 이미지를 표시한다. 이동과 전체 투명도는 부모가 담당한다. */
export function PaperFogMark({ width, foreground = false }: FogMarkProps) {
  return (
    <NativeImage
      source={foreground ? require('../assets/fog/paper_fog_puff_front.png') : require('../assets/fog/paper_fog_puff_back.png')}
      resizeMode="stretch"
      style={{ width, height: width * PAPER_FOG_HEIGHT_RATIO }}
    />
  );
}

/**
 * 크림색의 몽글몽글한 안개 덩어리에 연필 윤곽과 짧은 안쪽 곡선을 그린다.
 * x·y는 그림의 왼쪽 위 화면 좌표다. 100×74 좌표를 width에 맞춰 확대하며
 * 이동·재진입·전체 투명도는 상위 오버레이에서 계산한다.
 */
export function SkiaPaperFogMark({
  x,
  y,
  width,
  opacity,
  foreground = false,
}: FogMarkProps & { x: number; y: number; opacity: number }) {
  const ink = foreground ? colors.fogFront : colors.fog;
  return (
    <Group opacity={opacity} transform={[{ translateX: x }, { translateY: y }, { scale: width / 100 }]}>
      <Path path={PAPER_FOG_PATH} color={colors.fogFill} />
      <Path
        path={PAPER_FOG_PATH}
        color={ink}
        opacity={0.65}
        style="stroke"
        strokeWidth={0.65}
        strokeCap="round"
        strokeJoin="round"
      />
      <Path
        path={PAPER_FOG_DETAIL_PATH}
        color={ink}
        style="stroke"
        strokeWidth={0.95}
        strokeCap="round"
        strokeJoin="round"
      />
    </Group>
  );
}
