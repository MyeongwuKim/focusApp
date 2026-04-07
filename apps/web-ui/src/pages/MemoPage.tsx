import { useCallback, useEffect, useMemo, useRef } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { MemoEditorBody } from "../features/memo/components/MemoEditorBody";
import { MemoToolbar } from "../features/memo/components/MemoToolbar";
import { useDailyLogMemoMutation, useDailyLogQuery } from "../queries";
import { useAppStore } from "../stores";

type MemoPageProps = {
  dateKey?: string;
  className?: string;
};

function getTodayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

export function MemoPage({ dateKey, className }: MemoPageProps) {
  const selectedDateKey = useAppStore((state) => state.selectedDateKey);
  const resolvedDateKey = useMemo(
    () => dateKey ?? selectedDateKey ?? getTodayDateKey(),
    [dateKey, selectedDateKey]
  );
  const hydrateGuardRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const lastSavedMemoRef = useRef("<p></p>");

  const { dailyLogMemoQuery: memoQuery } = useDailyLogQuery({
    memoDateKey: resolvedDateKey,
  });
  const { upsertDailyLogMemoMutation } = useDailyLogMemoMutation(resolvedDateKey);
  const mutateMemoAsyncRef = useRef(upsertDailyLogMemoMutation.mutateAsync);

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
    mutateMemoAsyncRef.current = upsertDailyLogMemoMutation.mutateAsync;
  }, [upsertDailyLogMemoMutation.mutateAsync]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const nextMemo = memoQuery.data?.memo ?? "<p></p>";
    if (editor.getHTML() === nextMemo) {
      lastSavedMemoRef.current = nextMemo;
      return;
    }

    hydrateGuardRef.current = true;
    editor.commands.setContent(nextMemo, false);
    lastSavedMemoRef.current = nextMemo;
    queueMicrotask(() => {
      hydrateGuardRef.current = false;
    });
  }, [editor, memoQuery.data?.memo]);

  const saveCurrentMemo = useCallback(() => {
    if (!editor) {
      return;
    }

    const html = editor.getHTML();
    if (html === lastSavedMemoRef.current) {
      return;
    }

    void mutateMemoAsyncRef
      .current(html)
      .then(() => {
        lastSavedMemoRef.current = html;
      })
      .catch(() => {
        // 자동 저장 실패는 다음 입력 주기에 재시도
      });
  }, [editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleUpdate = () => {
      if (hydrateGuardRef.current) {
        return;
      }

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = window.setTimeout(() => {
        saveCurrentMemo();
      }, 450);
    };

    const handleBlur = () => {
      if (hydrateGuardRef.current) {
        return;
      }

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      saveCurrentMemo();
    };

    editor.on("update", handleUpdate);
    editor.on("blur", handleBlur);
    return () => {
      editor.off("update", handleUpdate);
      editor.off("blur", handleBlur);
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      saveCurrentMemo();
    };
  }, [editor, saveCurrentMemo]);

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
