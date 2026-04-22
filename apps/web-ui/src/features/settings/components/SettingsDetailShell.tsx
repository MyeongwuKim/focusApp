import type { ReactNode } from "react";

type SettingsDetailShellProps = {
  description?: string;
  children: ReactNode;
};

export function SettingsDetailShell({ description, children }: SettingsDetailShellProps) {
  return (
    <section className="mt-1 rounded-2xl border border-base-300 bg-base-200/50 p-4">
      {description ? (
        <p className="m-0 px-0.5 text-left text-sm leading-relaxed text-base-content/72">{description}</p>
      ) : null}

      <div className={description ? "mt-6 space-y-5" : "space-y-5"}>{children}</div>
    </section>
  );
}
