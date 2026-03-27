import { useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  FiBold,
  FiChevronDown,
  FiCheckSquare,
  FiHash,
  FiItalic,
  FiList,
  FiType,
} from "react-icons/fi";

const TEXT_STYLE_OPTIONS = [
  { key: "paragraph", label: "본문" },
  { key: "h1", label: "H1" },
  { key: "h2", label: "H2" },
  { key: "h3", label: "H3" },
  { key: "h4", label: "H4" },
  { key: "h5", label: "H5" },
  { key: "h6", label: "H6" },
] as const;

type MemoToolbarProps = {
  editor: Editor | null;
};

export function MemoToolbar({ editor }: MemoToolbarProps) {
  const [isHeadingMenuOpen, setIsHeadingMenuOpen] = useState(false);
  const [isFormatMenuOpen, setIsFormatMenuOpen] = useState(false);

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
    <div className="mb-2 flex shrink-0 flex-wrap gap-1.5 rounded-xl border border-base-300/80 bg-base-100/85 p-1.5">
      <button
        type="button"
        className={[
          "btn btn-xs h-8 min-h-8 rounded-lg px-3",
          editor?.isActive("heading") || isHeadingMenuOpen ? "btn-primary" : "btn-ghost",
        ].join(" ")}
        onClick={() => {
          setIsHeadingMenuOpen((prev) => !prev);
          setIsFormatMenuOpen(false);
        }}
      >
        <FiType size={13} />
        텍스트 {currentTextStyleLabel}
        <FiChevronDown
          size={13}
          className={[
            "transition-transform duration-200",
            isHeadingMenuOpen ? "rotate-180" : "rotate-0",
          ].join(" ")}
        />
      </button>
      <button
        type="button"
        className={[
          "btn btn-xs h-8 min-h-8 rounded-lg px-3",
          (editor?.isActive("bold") ||
            editor?.isActive("italic") ||
            editor?.isActive("strike") ||
            isFormatMenuOpen)
            ? "btn-primary"
            : "btn-ghost",
        ].join(" ")}
        onClick={() => {
          setIsFormatMenuOpen((prev) => !prev);
          setIsHeadingMenuOpen(false);
        }}
      >
        <FiBold size={13} />
        서식
        <FiChevronDown
          size={13}
          className={[
            "transition-transform duration-200",
            isFormatMenuOpen ? "rotate-180" : "rotate-0",
          ].join(" ")}
        />
      </button>
      <button
        type="button"
        className={[
          "btn btn-xs h-8 min-h-8 rounded-lg px-2.5",
          editor?.isActive("bulletList") ? "btn-primary" : "btn-ghost",
        ].join(" ")}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <FiList size={13} />
        목록
      </button>
      <button
        type="button"
        className={[
          "btn btn-xs h-8 min-h-8 rounded-lg px-2.5",
          editor?.isActive("orderedList") ? "btn-primary" : "btn-ghost",
        ].join(" ")}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <FiHash size={13} />
        번호
      </button>
      <button
        type="button"
        className={[
          "btn btn-xs h-8 min-h-8 rounded-lg px-2.5",
          editor?.isActive("taskList") ? "btn-primary" : "btn-ghost",
        ].join(" ")}
        onClick={() => editor?.chain().focus().toggleTaskList().run()}
      >
        <FiCheckSquare size={13} />
        체크
      </button>

      <div
        className={[
          "w-full overflow-hidden transition-all duration-200 ease-out",
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
              <button
                key={option.key}
                type="button"
                className={[
                  "btn btn-xs h-7 min-h-7 rounded-md px-2.5",
                  isActive ? "btn-primary" : "btn-ghost",
                ].join(" ")}
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
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={[
          "w-full overflow-hidden transition-all duration-200 ease-out",
          isFormatMenuOpen ? "mt-0.5 max-h-16 opacity-100" : "max-h-0 opacity-0",
        ].join(" ")}
      >
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-base-300/70 bg-base-200/60 p-1.5">
          <button
            type="button"
            className={[
              "btn btn-xs h-7 min-h-7 rounded-md px-2.5",
              editor?.isActive("bold") ? "btn-primary" : "btn-ghost",
            ].join(" ")}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <FiBold size={12} />
            볼드
          </button>
          <button
            type="button"
            className={[
              "btn btn-xs h-7 min-h-7 rounded-md px-2.5",
              editor?.isActive("italic") ? "btn-primary" : "btn-ghost",
            ].join(" ")}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <FiItalic size={12} />
            기울임
          </button>
          <button
            type="button"
            className={[
              "btn btn-xs h-7 min-h-7 rounded-md px-2.5",
              editor?.isActive("strike") ? "btn-primary" : "btn-ghost",
            ].join(" ")}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          >
            <span className="line-through">S</span>
            취소선
          </button>
        </div>
      </div>
    </div>
  );
}
