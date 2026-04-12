import type { ReactNode } from "react";
import { Button, type ButtonProps } from "./Button";

type PillActionButtonProps = Omit<ButtonProps, "size"> & {
  icon?: ReactNode;
  compact?: boolean;
};

export function PillActionButton({
  icon,
  compact = false,
  className,
  children,
  ...props
}: PillActionButtonProps) {
  return (
    <Button
      className={[
        compact
          ? "h-10 min-h-10 rounded-full border border-base-300/70 bg-base-300/45 px-3 text-xs text-base-content/85 shadow-none transition-colors duration-200 disabled:border-base-300/45 disabled:bg-base-200/25 disabled:text-base-content/40 disabled:shadow-none"
          : "h-10 min-h-10 rounded-full border-base-300/75 bg-base-200/55 px-4 text-sm text-base-content/85 shadow-none transition-colors duration-200 disabled:border-base-300/45 disabled:bg-base-200/25 disabled:text-base-content/40 disabled:shadow-none",
        className ?? "",
      ].join(" ")}
      {...props}
    >
      {icon}
      {children}
    </Button>
  );
}
