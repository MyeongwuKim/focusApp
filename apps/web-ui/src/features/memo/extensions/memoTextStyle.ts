import { Mark, mergeAttributes } from "@tiptap/core";

type MemoTextStyleAttrs = {
  backgroundColor?: string | null;
  color?: string | null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    memoTextStyle: {
      removeEmptyMemoTextStyle: () => ReturnType;
      setMemoHighlightColor: (backgroundColor: string | null) => ReturnType;
      setMemoTextColor: (color: string | null) => ReturnType;
    };
  }
}

function hasMemoTextStyleAttrs(attrs?: MemoTextStyleAttrs) {
  return Boolean(attrs?.color || attrs?.backgroundColor);
}

export const MemoTextStyle = Mark.create({
  name: "memoTextStyle",
  priority: 102,

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.style.color || null,
        renderHTML: (attributes) => (attributes.color ? { style: `color: ${attributes.color}` } : {}),
      },
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || null,
        renderHTML: (attributes) =>
          attributes.backgroundColor ? { style: `background-color: ${attributes.backgroundColor}` } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[style]",
        getAttrs: (element) => {
          const span = element as HTMLElement;
          return span.style.color || span.style.backgroundColor ? {} : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setMemoTextColor:
        (color: string | null) =>
        ({ commands }) => {
          const didSetMark = commands.setMark(this.name, { color });
          commands.removeEmptyMemoTextStyle();
          return didSetMark;
        },
      setMemoHighlightColor:
        (backgroundColor: string | null) =>
        ({ commands }) => {
          const didSetMark = commands.setMark(this.name, { backgroundColor });
          commands.removeEmptyMemoTextStyle();
          return didSetMark;
        },
      removeEmptyMemoTextStyle:
        () =>
        ({ state, tr, dispatch }) => {
          if (!dispatch) {
            return true;
          }

          const { selection } = tr;
          const markType = this.type;

          if (selection.empty) {
            const marks = tr.storedMarks ?? state.storedMarks ?? selection.$from.marks();
            const currentMark = marks.find((mark) => mark.type === markType);
            if (currentMark && !hasMemoTextStyleAttrs(currentMark.attrs)) {
              tr.removeStoredMark(markType);
            }
            return true;
          }

          tr.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
            if (!node.isText) {
              return true;
            }

            const currentMark = node.marks.find((mark) => mark.type === markType);
            if (currentMark && !hasMemoTextStyleAttrs(currentMark.attrs)) {
              tr.removeMark(pos, pos + node.nodeSize, markType);
            }

            return true;
          });

          return true;
        },
    };
  },
});
