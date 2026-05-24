import { type RoutineTemplate } from "../../../api/routineTemplateApi";
import { RoutineTemplateListItem } from "./RoutineTemplateListItem";

type RoutineTemplateListPanelProps = {
  routineTemplates: RoutineTemplate[];
  selectedTemplateKey: string | null;
  isSavingTemplate: boolean;
  onSelectTemplate: (templateId: string) => void;
  onOpenTemplateMenu: (template: RoutineTemplate) => void | Promise<void>;
};

export function RoutineTemplateListPanel({
  routineTemplates,
  selectedTemplateKey,
  isSavingTemplate,
  onSelectTemplate,
  onOpenTemplateMenu,
}: RoutineTemplateListPanelProps) {
  return (
    <section className="flex min-h-0 flex-[0.95] flex-col rounded-xl border border-base-300/80 bg-base-100/75 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="m-0 text-sm font-semibold text-base-content">루틴</p>
        <span className="rounded-md border border-base-300/80 bg-base-200/45 px-2 py-0.5 text-[11px] text-base-content/70">
          {routineTemplates.length}개
        </span>
      </div>
      <div className="no-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        {routineTemplates.map((template) => {
          const isActive = selectedTemplateKey === template.id;
          return (
            <RoutineTemplateListItem
              key={template.id}
              template={template}
              isActive={isActive}
              isSavingTemplate={isSavingTemplate}
              onSelectTemplate={onSelectTemplate}
              onOpenTemplateMenu={onOpenTemplateMenu}
            />
          );
        })}
        {routineTemplates.length === 0 ? (
          <p className="m-0 rounded-lg border border-base-300/60 bg-base-200/45 px-2.5 py-2 text-xs text-base-content/60">
            저장된 템플릿이 없어요.
          </p>
        ) : null}
      </div>
    </section>
  );
}
