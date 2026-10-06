import type { Editor } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";

type MemoEditorBodyProps = {
  editor: Editor | null;
};

export function MemoEditorBody({ editor }: MemoEditorBodyProps) {
  return (
    <div className="memo-editor min-h-0 flex-1 overflow-hidden">
      <EditorContent editor={editor} className="h-full w-full" />
    </div>
  );
}
