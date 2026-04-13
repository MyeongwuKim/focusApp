import { getApiOrigin } from "../api/graphqlEndpoint";
import { SiKakaotalk, SiNaver } from "react-icons/si";

function buildOAuthStartUrl(provider: "kakao" | "naver") {
  const apiOrigin = getApiOrigin() || "http://localhost:4000";
  const redirectTo =
    window.location.protocol === "file:"
      ? "mobile://auth/callback"
      : `${window.location.origin}/#/auth/callback`;
  const url = new URL(`${apiOrigin}/auth/${provider}/start`);
  url.searchParams.set("redirectTo", redirectTo);
  return url.toString();
}

export function LoginPage() {
  return (
    <main className="app-root bg-gradient-to-b from-base-200 via-base-100 to-base-200">
      <section className="app-shell mx-auto flex h-full w-full items-center justify-center overflow-hidden border border-base-300 bg-base-100/95 px-5 shadow-xl backdrop-blur">
        <div className="w-full max-w-sm rounded-2xl border border-base-300 bg-base-100 p-6 shadow-lg">
          <h1 className="text-center text-2xl font-semibold">로그인</h1>
          <p className="mt-2 text-center text-sm text-base-content/70">
            카카오 또는 네이버 계정으로 시작할 수 있어요.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <a
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E6C200] bg-[#FEE500] px-4 py-3 text-sm font-semibold text-[#1A1A1A] transition hover:brightness-95"
              href={buildOAuthStartUrl("kakao")}
            >
              <SiKakaotalk size={18} />
              카카오로 로그인
            </a>
            <a
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#029C38] bg-[#03C75A] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95"
              href={buildOAuthStartUrl("naver")}
            >
              <SiNaver size={16} />
              네이버로 로그인
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
