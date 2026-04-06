import { useEffect, useMemo, useRef } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MemoEditorBody } from "../features/memo/components/MemoEditorBody";
import { MemoToolbar } from "../features/memo/components/MemoToolbar";
import { fetchDailyLogMemo, upsertDailyLogMemo } from "../api/dailyLogApi";
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
  const queryClient = useQueryClient();
  const hydrateGuardRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  const memoQuery = useQuery({
    queryKey: ["daily-log-memo", resolvedDateKey] as const,
    queryFn: () => fetchDailyLogMemo(resolvedDateKey),
  });

  const upsertMemoMutation = useMutation({
    mutationFn: (memo: string) => upsertDailyLogMemo({ dateKey: resolvedDateKey, memo }),
    onSuccess: (data) => {
      queryClient.setQueryData(["daily-log-memo", resolvedDateKey], data ? { ...data } : null);
    },
  });

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

    const nextMemo = memoQuery.data?.memo ?? "<p></p>";
    if (editor.getHTML() === nextMemo) {
      return;
    }

    hydrateGuardRef.current = true;
    editor.commands.setContent(nextMemo, false);
    queueMicrotask(() => {
      hydrateGuardRef.current = false;
    });
  }, [editor, memoQuery.data?.memo]);

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
        const html = editor.getHTML();
        void upsertMemoMutation.mutateAsync(html);
      }, 450);
    };

    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [editor, upsertMemoMutation]);

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
