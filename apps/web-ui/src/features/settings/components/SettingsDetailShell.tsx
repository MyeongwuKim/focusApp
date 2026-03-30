import type { ReactNode } from "react";

type SettingsDetailShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function SettingsDetailShell({ title, description, children }: SettingsDetailShellProps) {
  return (
    <section className="space-y-5 rounded-2xl border border-base-300 bg-base-200/50 p-4">
      <div>
        <div className="relative flex h-10 items-center justify-center">
          <h2 className="m-0 text-center text-base font-semibold text-base-content">{title}</h2>
        </div>
        <p className="mt-1 text-center text-sm text-base-content/70">{description}</p>
      </div>

      {children}
    </section>
  );
}
