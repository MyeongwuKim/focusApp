import { RobotCharacter } from "./RobotCharacter";

export function AppErrorFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200/60 px-5">
      <section className="w-full max-w-md rounded-3xl border border-base-300 bg-base-100 p-8 text-center shadow-xl">
        <div className="mx-auto w-36">
          <RobotCharacter className="h-auto w-full" ariaLabel="오류 상태 캐릭터" showAlertBadge />
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
