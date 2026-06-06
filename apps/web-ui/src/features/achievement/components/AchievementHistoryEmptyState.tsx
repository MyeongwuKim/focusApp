import { RobotCharacter } from "../../../components/RobotCharacter";

type HistoryEmptyVariant = "all" | "permanent" | "weekly";

type AchievementHistoryEmptyStateProps = {
  variant: HistoryEmptyVariant;
};

export function AchievementHistoryEmptyState({ variant }: AchievementHistoryEmptyStateProps) {
  const content =
    variant === "all"
      ? {
          title: "아직 업적 히스토리가 없어요.",
          description: "첫 달성 기록이 쌓이면 여기서 시간순으로 확인할 수 있어요.",
        }
      : variant === "permanent"
        ? {
            title: "누적 기록이 없어요.",
            description: "누적/연속 배지를 달성하면 누적 기록 히스토리에 남아요.",
          }
        : {
            title: "완료한 주간 도전 기록이 없어요.",
            description: "이번 주 도전 달성 시 주간 히스토리에 쌓여요.",
          };

  return (
    <article className="rounded-2xl border border-base-300/75 bg-base-200/45 px-4 py-7">
      <div className="flex flex-col items-center justify-center gap-2 text-center">
        <div className="w-28 opacity-85">
          <RobotCharacter
            className="h-auto w-full"
            ariaLabel="업적 히스토리 빈 상태 캐릭터"
            mood="sad"
          />
        </div>
        <p className="m-0 text-base font-semibold text-base-content/75">{content.title}</p>
        <p className="m-0 max-w-[280px] text-xs text-base-content/60">{content.description}</p>
      </div>
    </article>
  );
}
