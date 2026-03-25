type FooterBarProps = {
  onGoToday: () => void;
};

export function FooterBar({ onGoToday }: FooterBarProps) {
  return (
    <footer className="mt-0 shrink-0 border-t border-base-300/70 bg-base-200/75 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-end">
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
