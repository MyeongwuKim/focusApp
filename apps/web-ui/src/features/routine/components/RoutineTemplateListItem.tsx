import { memo } from "react";
import { type RoutineTemplate } from "../../../api/routineTemplateApi";
import { Button } from "../../../components/ui/Button";

type RoutineTemplateListItemProps = {
  template: RoutineTemplate;
  isActive: boolean;
  isSavingTemplate: boolean;
  onSelectTemplate: (templateId: string) => void;
  onOpenTemplateMenu: (template: RoutineTemplate) => void | Promise<void>;
};

export const RoutineTemplateListItem = memo(function RoutineTemplateListItem({
  template,
  isActive,
  isSavingTemplate,
  onSelectTemplate,
  onOpenTemplateMenu,
}: RoutineTemplateListItemProps) {
  return (
    <div
      className={[
        "w-full rounded-lg border px-2.5 py-2 transition-colors",
        isActive
          ? "border-primary/65 bg-primary/10 text-primary"
          : "border-base-300/70 bg-base-100 text-base-content/80 hover:border-base-content/25",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelectTemplate(template.id)}>
          <p className="m-0 truncate text-sm font-semibold">{template.name}</p>
          <p className="m-0 mt-0.5 text-xs text-base-content/60">{template.items.length}개 항목</p>
        </button>
        <Button
          variant="ghost"
          size="xs"
          className="h-7 min-h-7 rounded-md px-2 text-sm text-base-content/60"
          onClick={(event) => {
            event.stopPropagation();
            void onOpenTemplateMenu(template);
          }}
          aria-label="루틴 메뉴"
          disabled={isSavingTemplate}
        >
          :
        </Button>
      </div>
    </div>
  );
});
