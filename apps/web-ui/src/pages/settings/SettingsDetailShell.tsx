import type { ReactNode } from "react";
import { FiChevronLeft } from "react-icons/fi";

type SettingsDetailShellProps = {
  title: string;
  description: string;
  onBack: () => void;
  children: ReactNode;
};

export function SettingsDetailShell({ title, description, onBack, children }: SettingsDetailShellProps) {
  return (
    <section className="space-y-5 rounded-2xl border border-base-300 bg-base-200/50 p-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-sm btn-ghost btn-circle"
          onClick={onBack}
          aria-label="설정 홈으로 돌아가기"
        >
          <FiChevronLeft size={18} />
        </button>
        <div>
          <h2 className="m-0 text-base font-semibold text-base-content">{title}</h2>
          <p className="mt-1 text-sm text-base-content/70">{description}</p>
        </div>
      </div>

      {children}
    </section>
  );
}

