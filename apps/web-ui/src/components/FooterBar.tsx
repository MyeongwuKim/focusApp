import { FiAlertCircle, FiCheckCircle, FiHelpCircle, FiInfo } from "react-icons/fi";
import { confirm, toast } from "../stores";

type FooterBarProps = {
  onGoToday: () => void;
};

export function FooterBar({ onGoToday }: FooterBarProps) {
  const handleConfirmYesNo = async () => {
    const result = await confirm({
      title: "일정을 저장할까요?",
      message: "현재 변경사항을 반영합니다.",
      buttons: [
        { label: "아니오", value: "no", tone: "neutral" },
        { label: "예", value: "yes", tone: "primary" },
      ],
    });

    if (result === "yes") {
      toast.positive("저장을 진행할게요.", "선택 결과");
      return;
    }
    if (result === "no") {
      toast.error("저장을 취소했어요.", "선택 결과");
      return;
    }
    toast.error("모달을 닫았어요.", "선택 결과");
  };

  const handleConfirmSingle = async () => {
    const result = await confirm({
      title: "안내",
      message: "확인을 누르면 닫힙니다.",
      buttons: [{ label: "확인", value: "ok", tone: "primary" }],
    });

    if (result === "ok") {
      toast.positive("확인 완료", "선택 결과");
      return;
    }
    toast.error("모달을 닫았어요.", "선택 결과");
  };

  return (
    <footer className="mt-0 shrink-0 border-t border-base-300/70 bg-base-200/75 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-sm rounded-full border-emerald-300 bg-emerald-50 px-3 text-emerald-700 shadow-none"
            onClick={() =>
              toast.positive("잘 저장되었어요. 계속 진행해볼까요?", "완료")
            }
          >
            <FiCheckCircle size={14} />
            성공
          </button>
          <button
            type="button"
            className="btn btn-sm rounded-full border-rose-300 bg-rose-50 px-3 text-rose-700 shadow-none"
            onClick={() => toast.error("잠시 후 다시 시도해 주세요.", "오류")}
          >
            <FiAlertCircle size={14} />
            에러
          </button>
          <button
            type="button"
            className="btn btn-sm rounded-full border-sky-300 bg-sky-50 px-3 text-sky-700 shadow-none"
            onClick={handleConfirmYesNo}
          >
            <FiHelpCircle size={14} />
            확인(예/아니오)
          </button>
          <button
            type="button"
            className="btn btn-sm rounded-full border-indigo-300 bg-indigo-50 px-3 text-indigo-700 shadow-none"
            onClick={handleConfirmSingle}
          >
            <FiInfo size={14} />
            확인(1개)
          </button>
        </div>
        <button
          type="button"
          className="btn h-11 min-h-11 rounded-full border-base-300 bg-base-100 px-7 text-base text-base-content shadow-sm"
          onClick={onGoToday}
        >
          오늘
        </button>
      </div>
    </footer>
  );
}
