import { useState, type MouseEvent } from "react";
import type { Editor } from "@tiptap/react";
import {
  FiBold,
  FiChevronDown,
  FiCheckSquare,
  FiDroplet,
  FiHash,
  FiItalic,
  FiList,
  FiType,
} from "react-icons/fi";
import { Button } from "../../../components/ui/Button";

const TEXT_STYLE_OPTIONS = [
  { key: "paragraph", label: "본문" },
  { key: "h1", label: "H1" },
  { key: "h2", label: "H2" },
  { key: "h3", label: "H3" },
  { key: "h4", label: "H4" },
  { key: "h5", label: "H5" },
  { key: "h6", label: "H6" },
] as const;

const TEXT_COLOR_OPTIONS = [
  { key: "default", label: "기본", value: null },
  { key: "gray", label: "회색", value: "#6b7280" },
  { key: "red", label: "빨강", value: "#ef4444" },
  { key: "amber", label: "노랑", value: "#f59e0b" },
  { key: "green", label: "초록", value: "#22c55e" },
  { key: "blue", label: "파랑", value: "#3b82f6" },
  { key: "violet", label: "보라", value: "#8b5cf6" },
] as const;

const HIGHLIGHT_COLOR_OPTIONS = [
  { key: "default", label: "없음", value: null },
  { key: "yellow", label: "노랑", value: "#fef3c7" },
  { key: "mint", label: "민트", value: "#bbf7d0" },
  { key: "sky", label: "하늘", value: "#bfdbfe" },
  { key: "pink", label: "분홍", value: "#fbcfe8" },
  { key: "violet", label: "보라", value: "#ddd6fe" },
] as const;

type MemoToolbarProps = {
  editor: Editor | null;
};

const toolbarButtonClassName = "h-8 min-h-8 min-w-0 rounded-lg px-2 text-xs";
const toolbarLabelClassName = "min-w-0 truncate";

function keepEditorSelection(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
}

function isSameColor(currentColor: unknown, optionColor: string | null) {
  if (!optionColor) {
    return !currentColor;
  }

  return currentColor === optionColor;
}

export function MemoToolbar({ editor }: MemoToolbarProps) {
  const [isHeadingMenuOpen, setIsHeadingMenuOpen] = useState(false);
  const [isFormatMenuOpen, setIsFormatMenuOpen] = useState(false);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const memoTextStyle = editor?.getAttributes("memoTextStyle") ?? {};
  const hasMemoTextStyle = Boolean(memoTextStyle.color || memoTextStyle.backgroundColor);

  const currentTextStyleLabel = (() => {
    if (!editor) {
      return "본문";
    }
    for (let level = 1; level <= 6; level += 1) {
      if (editor.isActive("heading", { level })) {
        return `H${level}`;
      }
    }
    return "본문";
  })();

  return (
    <div className="mb-2 grid shrink-0 grid-cols-6 gap-1.5 rounded-xl border border-base-300/80 bg-base-100/85 p-1.5">
      <Button
        size="xs"
        variant={editor?.isActive("heading") || isHeadingMenuOpen ? "primary" : "ghost"}
        className={`col-span-2 ${toolbarButtonClassName}`}
        onMouseDown={keepEditorSelection}
        onClick={() => {
          setIsHeadingMenuOpen((prev) => !prev);
          setIsFormatMenuOpen(false);
          setIsColorMenuOpen(false);
        }}
      >
        <FiType size={13} />
        <span className={toolbarLabelClassName}>{currentTextStyleLabel}</span>
        <FiChevronDown
          size={13}
          className={[
            "transition-transform duration-200",
            isHeadingMenuOpen ? "rotate-180" : "rotate-0",
          ].join(" ")}
        />
      </Button>
      <Button
        size="xs"
        variant={
          editor?.isActive("bold") ||
          editor?.isActive("italic") ||
          editor?.isActive("strike") ||
          isFormatMenuOpen
            ? "primary"
            : "ghost"
        }
        className={`col-span-2 ${toolbarButtonClassName}`}
        onMouseDown={keepEditorSelection}
        onClick={() => {
          setIsFormatMenuOpen((prev) => !prev);
          setIsHeadingMenuOpen(false);
          setIsColorMenuOpen(false);
        }}
      >
        <FiBold size={13} />
        <span className={toolbarLabelClassName}>서식</span>
        <FiChevronDown
          size={13}
          className={[
            "transition-transform duration-200",
            isFormatMenuOpen ? "rotate-180" : "rotate-0",
          ].join(" ")}
        />
      </Button>
      <Button
        size="xs"
        variant={isColorMenuOpen || hasMemoTextStyle ? "primary" : "ghost"}
        className={`col-span-2 ${toolbarButtonClassName}`}
        onMouseDown={keepEditorSelection}
        onClick={() => {
          setIsColorMenuOpen((prev) => !prev);
          setIsHeadingMenuOpen(false);
          setIsFormatMenuOpen(false);
        }}
      >
        <FiDroplet size={13} />
        <span className={toolbarLabelClassName}>색상</span>
        <FiChevronDown
          size={13}
          className={[
            "transition-transform duration-200",
            isColorMenuOpen ? "rotate-180" : "rotate-0",
          ].join(" ")}
        />
      </Button>
      <Button
        size="xs"
        variant={editor?.isActive("bulletList") ? "primary" : "ghost"}
        className={`col-span-2 ${toolbarButtonClassName}`}
        onMouseDown={keepEditorSelection}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <FiList size={13} />
        <span className={toolbarLabelClassName}>목록</span>
      </Button>
      <Button
        size="xs"
        variant={editor?.isActive("orderedList") ? "primary" : "ghost"}
        className={`col-span-2 ${toolbarButtonClassName}`}
        onMouseDown={keepEditorSelection}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <FiHash size={13} />
        <span className={toolbarLabelClassName}>번호</span>
      </Button>
      <Button
        size="xs"
        variant={editor?.isActive("taskList") ? "primary" : "ghost"}
        className={`col-span-2 ${toolbarButtonClassName}`}
        onMouseDown={keepEditorSelection}
        onClick={() => editor?.chain().focus().toggleTaskList().run()}
      >
        <FiCheckSquare size={13} />
        <span className={toolbarLabelClassName}>체크</span>
      </Button>

      <div
        className={[
          "col-span-6 overflow-hidden transition-all duration-200 ease-out",
          isHeadingMenuOpen ? "mt-0.5 max-h-44 opacity-100" : "max-h-0 opacity-0",
        ].join(" ")}
      >
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-base-300/70 bg-base-200/60 p-1.5">
          {TEXT_STYLE_OPTIONS.map((option) => {
            const isActive =
              option.key === "paragraph"
                ? !editor?.isActive("heading")
                : editor?.isActive("heading", {
                    level: Number(option.key.slice(1)),
                  });

            return (
              <Button
                key={option.key}
                size="xs"
                variant={isActive ? "primary" : "ghost"}
                className="h-7 min-h-7 rounded-md px-2.5"
                onMouseDown={keepEditorSelection}
                onClick={() => {
                  if (option.key === "paragraph") {
                    editor?.chain().focus().setParagraph().run();
                  } else {
                    editor
                      ?.chain()
                      .focus()
                      .toggleHeading({ level: Number(option.key.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 })
                      .run();
                  }
                  setIsHeadingMenuOpen(false);
                }}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div
        className={[
          "col-span-6 overflow-hidden transition-all duration-200 ease-out",
          isColorMenuOpen ? "mt-0.5 max-h-52 opacity-100" : "max-h-0 opacity-0",
        ].join(" ")}
      >
        <div className="space-y-2 rounded-lg border border-base-300/70 bg-base-200/60 p-2">
          <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-xs font-semibold text-base-content/70">글자색</span>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {TEXT_COLOR_OPTIONS.map((option) => {
                const isActive = isSameColor(memoTextStyle.color, option.value);
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-label={`글자색 ${option.label}`}
                    title={`글자색 ${option.label}`}
                    className={[
                      "flex h-7 w-7 items-center justify-center rounded-full border bg-base-100 transition",
                      isActive ? "border-primary ring-2 ring-primary/35" : "border-base-300",
                    ].join(" ")}
                    onMouseDown={keepEditorSelection}
                    onClick={() => editor?.chain().focus().setMemoTextColor(option.value).run()}
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-base-content/15"
                      style={{
                        backgroundColor: option.value ?? "transparent",
                      }}
                    >
                      {!option.value ? <span className="block h-full w-full rounded-full bg-base-content/20" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-xs font-semibold text-base-content/70">배경</span>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {HIGHLIGHT_COLOR_OPTIONS.map((option) => {
                const isActive = isSameColor(memoTextStyle.backgroundColor, option.value);
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-label={`배경 ${option.label}`}
                    title={`배경 ${option.label}`}
                    className={[
                      "flex h-7 w-7 items-center justify-center rounded-full border bg-base-100 transition",
                      isActive ? "border-primary ring-2 ring-primary/35" : "border-base-300",
                    ].join(" ")}
                    onMouseDown={keepEditorSelection}
                    onClick={() => editor?.chain().focus().setMemoHighlightColor(option.value).run()}
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-base-content/15"
                      style={{
                        backgroundColor: option.value ?? "transparent",
                      }}
                    >
                      {!option.value ? <span className="block h-full w-full rounded-full bg-base-content/20" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div
        className={[
          "col-span-6 overflow-hidden transition-all duration-200 ease-out",
          isFormatMenuOpen ? "mt-0.5 max-h-16 opacity-100" : "max-h-0 opacity-0",
        ].join(" ")}
      >
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-base-300/70 bg-base-200/60 p-1.5">
          <Button
            size="xs"
            variant={editor?.isActive("bold") ? "primary" : "ghost"}
            className="h-7 min-h-7 rounded-md px-2.5"
            onMouseDown={keepEditorSelection}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <FiBold size={12} />
            볼드
          </Button>
          <Button
            size="xs"
            variant={editor?.isActive("italic") ? "primary" : "ghost"}
            className="h-7 min-h-7 rounded-md px-2.5"
            onMouseDown={keepEditorSelection}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <FiItalic size={12} />
            기울임
          </Button>
          <Button
            size="xs"
            variant={editor?.isActive("strike") ? "primary" : "ghost"}
            className="h-7 min-h-7 rounded-md px-2.5"
            onMouseDown={keepEditorSelection}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          >
            <span className="line-through">S</span>
            취소선
          </Button>
        </div>
      </div>
    </div>
  );
}
