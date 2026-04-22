import type { IconType } from "react-icons";
import { FiChevronRight } from "react-icons/fi";

type SettingsMenuItemProps = {
  icon: IconType;
  title: string;
  description: string;
  onClick: () => void;
};

export function SettingsMenuItem({ icon: Icon, title, description, onClick }: SettingsMenuItemProps) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-xl border border-base-300/80 bg-base-100/75 px-3 py-3.5 text-left"
      onClick={onClick}
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-base-200 text-base-content/80">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-sm font-semibold leading-tight text-base-content">{title}</span>
        <span className="block text-xs leading-tight text-base-content/60">{description}</span>
      </span>
      <FiChevronRight size={18} className="text-base-content/50" />
    </button>
  );
}
