import type { Editor } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";

type MemoEditorBodyProps = {
  editor: Editor | null;
};

export function MemoEditorBody({ editor }: MemoEditorBodyProps) {
  return (
    <div className="memo-editor min-h-0 flex-1 rounded-xl border border-base-300/80 bg-base-100/90">
      <EditorContent editor={editor} className="h-full w-full" />
    </div>
  );
}
