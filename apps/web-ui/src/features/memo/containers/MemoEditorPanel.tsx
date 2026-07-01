import { useCallback, useEffect, useMemo, useRef } from "react";
import { Extension, type Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { MemoEditorBody } from "../components/MemoEditorBody";
import { MemoToolbar } from "../components/MemoToolbar";
import { MemoTextStyle } from "../extensions/memoTextStyle";
import { useDailyLogMemoMutation, useDailyLogQuery } from "../../../queries";
import { useAppStore } from "../../../stores";

type MemoEditorPanelProps = {
  dateKey?: string;
  className?: string;
};

function getTodayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function getEmptyTaskItemAtCursor(editor: Editor) {
  const { selection } = editor.state;
  if (!selection.empty) {
    return null;
  }

  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "taskItem") {
      if (node.textContent.trim().length > 0) {
        return null;
      }

      const listDepth = depth - 1;
      const listNode = $from.node(listDepth);
      return {
        depth,
        index: $from.index(listDepth),
        listNode,
        node,
        pos: $from.before(depth),
      };
    }
  }

  return null;
}

function exitEmptyTaskItem(editor: Editor) {
  if (!getEmptyTaskItemAtCursor(editor)) {
    return false;
  }

  return editor.commands.liftListItem("taskItem");
}

function deleteEmptyTaskItem(editor: Editor) {
  const taskItem = getEmptyTaskItemAtCursor(editor);
  if (!taskItem) {
    return false;
  }

  if (taskItem.listNode.childCount <= 1) {
    return editor.commands.liftListItem("taskItem");
  }

  return editor.commands.command(({ tr, dispatch }) => {
    if (dispatch) {
      const from = taskItem.pos;
      const to = taskItem.pos + taskItem.node.nodeSize;
      const selectionBias = taskItem.index > 0 ? -1 : 1;

      tr.delete(from, to);
      tr.setSelection(
        TextSelection.near(tr.doc.resolve(Math.min(from, tr.doc.content.size)), selectionBias)
      );
      tr.scrollIntoView();
    }

    return true;
  });
}

const EmptyTaskItemExit = Extension.create({
  name: "emptyTaskItemExit",
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      Enter: () => exitEmptyTaskItem(this.editor),
      Backspace: () => deleteEmptyTaskItem(this.editor),
      Delete: () => deleteEmptyTaskItem(this.editor),
    };
  },
});

export function MemoEditorPanel({ dateKey, className }: MemoEditorPanelProps) {
  const selectedDateKey = useAppStore((state) => state.selectedDateKey);
  const resolvedDateKey = useMemo(
    () => dateKey ?? selectedDateKey ?? getTodayDateKey(),
    [dateKey, selectedDateKey]
  );
  const hydrateGuardRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const lastSavedMemoRef = useRef("<p></p>");
  const hasLocalMemoChangesRef = useRef(false);
  const isSavingMemoRef = useRef(false);
  const queuedMemoSaveRef = useRef<string | null>(null);
  const flushQueuedMemoSaveRef = useRef<(() => void) | null>(null);

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
      EmptyTaskItemExit,
      MemoTextStyle,
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
      if (!isSavingMemoRef.current && queuedMemoSaveRef.current === null) {
        hasLocalMemoChangesRef.current = false;
      }
      return;
    }

    if (hasLocalMemoChangesRef.current || isSavingMemoRef.current || queuedMemoSaveRef.current !== null) {
      return;
    }

    hydrateGuardRef.current = true;
    editor.commands.setContent(nextMemo, false);
    lastSavedMemoRef.current = nextMemo;
    hasLocalMemoChangesRef.current = false;
    queueMicrotask(() => {
      hydrateGuardRef.current = false;
    });
  }, [editor, memoQuery.data?.memo]);

  const flushQueuedMemoSave = useCallback(() => {
    if (!editor || isSavingMemoRef.current) {
      return;
    }

    const queuedMemo = queuedMemoSaveRef.current;
    if (queuedMemo === null || queuedMemo === lastSavedMemoRef.current) {
      queuedMemoSaveRef.current = null;
      if (editor.getHTML() === lastSavedMemoRef.current) {
        hasLocalMemoChangesRef.current = false;
      }
      return;
    }

    queuedMemoSaveRef.current = null;
    isSavingMemoRef.current = true;
    let didSaveFail = false;

    void mutateMemoAsyncRef
      .current(queuedMemo)
      .then(() => {
        lastSavedMemoRef.current = queuedMemo;
        if (editor.getHTML() === queuedMemo && queuedMemoSaveRef.current === null) {
          hasLocalMemoChangesRef.current = false;
        }
      })
      .catch(() => {
        didSaveFail = true;
        if (queuedMemoSaveRef.current === null) {
          queuedMemoSaveRef.current = queuedMemo;
        }
      })
      .finally(() => {
        isSavingMemoRef.current = false;
        const hasNewerQueuedMemo = queuedMemoSaveRef.current !== null && queuedMemoSaveRef.current !== queuedMemo;
        if (
          queuedMemoSaveRef.current !== null &&
          queuedMemoSaveRef.current !== lastSavedMemoRef.current &&
          (!didSaveFail || hasNewerQueuedMemo)
        ) {
          flushQueuedMemoSaveRef.current?.();
        }
      });
  }, [editor]);

  useEffect(() => {
    flushQueuedMemoSaveRef.current = flushQueuedMemoSave;
  }, [flushQueuedMemoSave]);

  const saveCurrentMemo = useCallback(() => {
    if (!editor) {
      return;
    }

    const html = editor.getHTML();
    if (html === lastSavedMemoRef.current && !isSavingMemoRef.current) {
      queuedMemoSaveRef.current = null;
      hasLocalMemoChangesRef.current = false;
      return;
    }

    queuedMemoSaveRef.current = html;
    flushQueuedMemoSave();
  }, [editor, flushQueuedMemoSave]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleUpdate = () => {
      if (hydrateGuardRef.current) {
        return;
      }

      hasLocalMemoChangesRef.current = true;

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
        "flex min-h-0 max-h-full flex-1 flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-200/40 p-4",
        className ?? "",
      ].join(" ")}
    >
      <MemoToolbar editor={editor} />
      <MemoEditorBody editor={editor} />
    </section>
  );
}
