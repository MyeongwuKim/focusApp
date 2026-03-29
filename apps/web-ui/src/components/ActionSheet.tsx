import { useEffect } from "react";
import type { ActionSheetItemTone } from "../stores";
import { useActionSheetStore } from "../stores";

function toneClassName(tone: ActionSheetItemTone = "default") {
  if (tone === "primary") {
    return "text-info";
  }
  if (tone === "danger") {
    return "text-error";
  }
  if (tone === "muted") {
    return "text-base-content/55";
  }
  return "text-base-content/90";
}

export function ActionSheet() {
  const active = useActionSheetStore((state) => state.active);
  const closeWithResult = useActionSheetStore((state) => state.closeWithResult);
  const completeClose = useActionSheetStore((state) => state.completeClose);

  useEffect(() => {
    if (!active?.closing) {
      return;
    }
    const timer = window.setTimeout(() => {
      completeClose();
    }, 260);
    return () => window.clearTimeout(timer);
  }, [active?.closing, completeClose]);

  if (!active) {
    return null;
  }

  return (
    <div
      className={[
        "action-sheet-overlay",
        active.closing ? "action-sheet-overlay--leaving" : "",
      ].join(" ")}
      onPointerDown={(event) => {
        if (!active.closeOnBackdrop) {
          return;
        }
        if (event.target === event.currentTarget) {
          closeWithResult(null);
        }
      }}
      aria-hidden="true"
    >
      <section
        className={[
          "action-sheet-panel border border-base-300 bg-base-100 text-base-content shadow-2xl",
          active.closing ? "action-sheet-panel--leaving" : "",
        ].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label={active.title || "작업 메뉴"}
        onTransitionEnd={(event) => {
          if (event.currentTarget !== event.target) {
            return;
          }
          if (active.closing) {
            completeClose();
          }
        }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-base-300/80" />
        {active.title ? (
          <h2 className="m-0 text-sm font-semibold text-base-content">{active.title}</h2>
        ) : null}
        {active.message ? (
          <p className="mt-1 mb-3 text-xs text-base-content/65">{active.message}</p>
        ) : null}
        <div className="space-y-1.5">
          {active.items.map((item, index) => (
            <button
              key={`${item.label}-${index}`}
              type="button"
              disabled={item.disabled}
              className={[
                "w-full rounded-xl border border-base-300/70 bg-base-100/70 px-3 py-2 text-left transition",
                item.disabled ? "cursor-not-allowed opacity-45" : "hover:bg-base-200/70",
              ].join(" ")}
              onClick={() => closeWithResult(item.value ?? item.label)}
            >
              <div className={["flex items-center gap-2 text-sm font-medium", toneClassName(item.tone)].join(" ")}>
                {item.icon ? <span className="inline-flex items-center">{item.icon}</span> : null}
                <span>{item.label}</span>
              </div>
              {item.description ? (
                <p className="mt-0.5 mb-0 text-xs text-base-content/55">{item.description}</p>
              ) : null}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
