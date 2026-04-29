export function AppErrorFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200/60 px-5">
      <section className="w-full max-w-md rounded-3xl border border-base-300 bg-base-100 p-8 text-center shadow-xl">
        <div className="mx-auto w-36">
          <svg viewBox="0 0 160 160" role="img" aria-label="오류 상태 캐릭터" className="h-auto w-full">
            <defs>
              <linearGradient id="shell-grad" x1="0%" x2="100%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="#F8FAFC" />
                <stop offset="100%" stopColor="#D1D5DB" />
              </linearGradient>
              <linearGradient id="face-grad" x1="0%" x2="100%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="#374151" />
                <stop offset="100%" stopColor="#1F2937" />
              </linearGradient>
              <radialGradient id="eye-grad" cx="45%" cy="35%" r="70%">
                <stop offset="0%" stopColor="#A5F3FC" />
                <stop offset="100%" stopColor="#22D3EE" />
              </radialGradient>
            </defs>
            <line x1="54" y1="34" x2="54" y2="52" stroke="#6B7280" strokeWidth="3" strokeLinecap="round" />
            <line x1="106" y1="34" x2="106" y2="52" stroke="#6B7280" strokeWidth="3" strokeLinecap="round" />
            <circle cx="54" cy="30" r="6.5" fill="#E5E7EB" stroke="#4B5563" strokeWidth="2" />
            <circle cx="106" cy="30" r="6.5" fill="#E5E7EB" stroke="#4B5563" strokeWidth="2" />
            <circle cx="54" cy="52" r="3.2" fill="#D1D5DB" stroke="#6B7280" strokeWidth="1.6" />
            <circle cx="106" cy="52" r="3.2" fill="#D1D5DB" stroke="#6B7280" strokeWidth="1.6" />

            <ellipse cx="80" cy="86" rx="55" ry="42" fill="url(#shell-grad)" stroke="#9CA3AF" strokeWidth="2.2" />
            <path
              d="M38 74c8-14 24-22 43-22"
              fill="none"
              stroke="#FFFFFF"
              strokeOpacity="0.65"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <rect x="42" y="60" width="76" height="44" rx="17" fill="url(#face-grad)" />

            <path d="M56 72l8 3" stroke="#E5E7EB" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M104 72l-8 3" stroke="#E5E7EB" strokeWidth="2.6" strokeLinecap="round" />

            <ellipse cx="63" cy="82" rx="7.2" ry="6.4" fill="url(#eye-grad)" />
            <ellipse cx="97" cy="82" rx="7.2" ry="6.4" fill="url(#eye-grad)" />
            <circle cx="65" cy="80" r="2" fill="#ECFEFF" />
            <circle cx="99" cy="80" r="2" fill="#ECFEFF" />

            <path
              d="M66 96l4-2.2 4 2.2 4-2.2 4 2.2 4-2.2 4 2.2 4-2.2"
              fill="none"
              stroke="#67E8F9"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <circle cx="124" cy="42" r="11" fill="#F59E0B" />
            <text x="124" y="46" textAnchor="middle" fontSize="13" fontWeight="700" fill="#111827">
              !
            </text>
          </svg>
        </div>
        <h1 className="mt-4 text-lg font-bold text-base-content">예기치 못한 오류가 발생했습니다.</h1>
        <p className="mt-2 text-sm text-base-content/70">잠시후 다시 시도해주세요.</p>
        <button
          type="button"
          className="btn btn-primary mt-6 w-full"
          onClick={() => {
            window.location.reload();
          }}
        >
          새로고침
        </button>
      </section>
    </div>
  );
}
