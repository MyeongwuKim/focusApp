import { FiArchive, FiFileText, FiLayers } from "react-icons/fi";

type AppFeatureIconName = "tasks" | "routine" | "memo";

type AppFeatureIconProps = {
  name: AppFeatureIconName;
  size?: number;
};

const FEATURE_ICON = {
  tasks: FiArchive,
  routine: FiLayers,
  memo: FiFileText,
} satisfies Record<AppFeatureIconName, typeof FiArchive>;

/** 메뉴와 오늘 할 일의 빠른 실행 버튼에서 같은 기능을 동일한 선형 아이콘으로 표시한다. */
export function AppFeatureIcon({ name, size = 15 }: AppFeatureIconProps) {
  const Icon = FEATURE_ICON[name];
  return <Icon aria-hidden="true" size={size} />;
}
