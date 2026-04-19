type BackendConnectionBannerProps = {
  state: "idle" | "checking" | "ready" | "error";
  errorMessage: string | null;
  onRetry: () => void;
};

export function BackendConnectionBanner({ state, errorMessage, onRetry }: BackendConnectionBannerProps) {
  if (state === "checking") {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex justify-center px-4">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-2xl border border-info/35 bg-base-100/95 px-3 py-2 text-sm text-base-content shadow-lg backdrop-blur">
          <span className="loading loading-spinner loading-xs text-info" />
          서버 연결 확인 중...
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-error/45 bg-base-100/95 px-3 py-2 shadow-[0_14px_36px_rgba(2,6,23,0.28)] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-sm font-semibold text-error">서버 연결 안됨</p>
              <p className="m-0 truncate text-xs text-base-content/70">
                {errorMessage ?? "네트워크 상태를 확인해 주세요."}
              </p>
            </div>
            <button type="button" className="btn btn-xs btn-error rounded-lg" onClick={onRetry}>
              재시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
