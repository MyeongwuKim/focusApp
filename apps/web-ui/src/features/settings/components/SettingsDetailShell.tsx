import type { ReactNode } from "react";

type SettingsDetailShellProps = {
  description?: string;
  children: ReactNode;
};

export function SettingsDetailShell({ description, children }: SettingsDetailShellProps) {
  return (
    <section className="space-y-5 rounded-2xl border border-base-300 bg-base-200/50 p-4">
      {description ? <p className="m-0 text-left text-sm leading-relaxed text-base-content/72">{description}</p> : null}

      {children}
    </section>
  );
}
