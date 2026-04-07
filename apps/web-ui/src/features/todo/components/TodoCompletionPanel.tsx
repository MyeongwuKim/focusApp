import { FiCheckCircle } from "react-icons/fi";

type TodoCompletionPanelProps = {
  isVisible: boolean;
  onClose: () => void;
};

export function TodoCompletionPanel({ isVisible, onClose }: TodoCompletionPanelProps) {
  return (
    <div
      className={[
        "absolute inset-0 z-50 transition-opacity duration-220 ease-out",
        isVisible ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      <button
        type="button"
        className="absolute inset-0 flex items-center justify-center bg-base-100/92 px-6 text-center backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="완료 패널 닫기"
      >
        <div
          className={[
            "space-y-2 transition-[transform,opacity] duration-220 ease-out",
            isVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-95 opacity-90",
          ].join(" ")}
        >
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <FiCheckCircle size={36} />
          </div>
          <h3 className="m-0 text-xl font-bold text-base-content">참 잘했어요!</h3>
          <p className="m-0 text-sm text-base-content/70">오늘 할 일을 전부 완료했어요.</p>
          <p className="m-0 text-[11px] text-base-content/45">화면을 누르면 닫혀요</p>
        </div>
      </button>
    </div>
  );
}
