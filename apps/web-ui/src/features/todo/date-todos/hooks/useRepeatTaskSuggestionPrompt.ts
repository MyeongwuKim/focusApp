import { useTaskSuggestionMutation } from "../../../../queries";
import { confirm, toast } from "../../../../stores";
import { formatDateKey } from "../../../../utils/holidays";

/**
 * 일회성 할 일 입력을 서버의 반복 문구 집계에 전달하고, 기준을 채운 후보에만 관리 할 일 저장 여부를 묻는다.
 * 집계 실패는 원래 할 일 추가를 막지 않으며, 거절·팝업 닫기는 모두 저장용 횟수 초기화와 14일 숨김으로 처리한다.
 */
export function useRepeatTaskSuggestionPrompt() {
  const {
    recordTaskSuggestionUsageMutation,
    dismissTaskSuggestionMutation,
    acceptTaskSuggestionMutation,
  } = useTaskSuggestionMutation();

  const promptTaskSuggestion = async (label: string) => {
    let suggestion;
    try {
      suggestion = await recordTaskSuggestionUsageMutation.mutateAsync({
        content: label,
        usageDateKey: formatDateKey(new Date()),
      });
    } catch (error) {
      console.error("Failed to count repeated task text", error);
      return;
    }

    if (!suggestion.shouldSuggest || !suggestion.suggestionId) {
      return;
    }

    const selected = await confirm({
      title: "자주 적는 할 일이에요",
      message: `‘${suggestion.displayText}’을 저장한 할 일로 보관할까요?`,
      buttons: [
        { label: "14일간 묻지 않기", value: "dismiss", tone: "neutral" },
        { label: "저장", value: "accept", tone: "primary" },
      ],
    });

    if (selected === "accept") {
      try {
        await acceptTaskSuggestionMutation.mutateAsync({ suggestionId: suggestion.suggestionId });
        toast.show({
          type: "positive",
          title: "저장한 할 일에 추가됨",
          message: "다음부터 저장한 할 일에서 바로 불러올 수 있어요.",
          duration: 2000,
        });
      } catch (error) {
        console.error("Failed to save repeated task text", error);
        toast.show({
          type: "error",
          title: "저장 실패",
          message: "할 일은 추가됐지만 관리 목록에는 저장하지 못했어요.",
          duration: 2200,
        });
      }
      return;
    }

    try {
      await dismissTaskSuggestionMutation.mutateAsync({ suggestionId: suggestion.suggestionId });
    } catch (error) {
      console.error("Failed to snooze repeated task suggestion", error);
    }
  };

  return { promptTaskSuggestion };
}
