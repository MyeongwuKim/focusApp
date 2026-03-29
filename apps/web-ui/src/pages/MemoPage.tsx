import { useEffect } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { MemoEditorBody } from "../features/memo/components/MemoEditorBody";
import { MemoToolbar } from "../features/memo/components/MemoToolbar";

const MEMO_STORAGE_KEY = "focus-hybrid:memo";

type MemoPageProps = {
  storageKey?: string;
  className?: string;
};

export function MemoPage({ storageKey = MEMO_STORAGE_KEY, className }: MemoPageProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: "메모를 입력하세요",
      }),
    ],
    content: "<p></p>",
    editorProps: {
      attributes: {
        class:
          "h-full overflow-y-auto px-3 py-2.5 text-sm leading-6 text-base-content focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      editor.commands.setContent(saved, false);
    }
  }, [editor, storageKey]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleUpdate = () => {
      window.localStorage.setItem(storageKey, editor.getHTML());
    };

    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
    };
  }, [editor, storageKey]);

  return (
    <section
      className={[
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-200/40 p-4",
        className ?? "",
      ].join(" ")}
    >
      <MemoToolbar editor={editor} />
      <MemoEditorBody editor={editor} />
    </section>
  );
}
