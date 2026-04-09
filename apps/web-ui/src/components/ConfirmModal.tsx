import { Button } from "./ui/Button";
import { useConfirmStore } from "../stores";

function toneVariant(tone: "primary" | "neutral" | "danger" = "neutral") {
  if (tone === "primary") {
    return "primary";
  }
  if (tone === "danger") {
    return "error";
  }
  return "ghost";
}

export function ConfirmModal() {
  const active = useConfirmStore((state) => state.active);
  const closeWithResult = useConfirmStore((state) => state.closeWithResult);
  const completeClose = useConfirmStore((state) => state.completeClose);

  if (!active) {
    return null;
  }

  return (
    <div
      className={[
        "confirm-overlay bg-base-300/35 backdrop-blur-[1px]",
        active.closing ? "confirm-overlay--leaving" : "",
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
          "confirm-modal border border-base-300 bg-base-100 text-base-content shadow-2xl",
          active.closing ? "confirm-modal--leaving" : "",
        ].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label={active.title}
        onAnimationEnd={(event) => {
          if (event.currentTarget !== event.target) {
            return;
          }
          if (active.closing) {
            completeClose();
          }
        }}
      >
        <h2 className="confirm-modal__title text-center text-base-content">{active.title}</h2>
        {active.message ? (
          <p className="confirm-modal__message text-center text-base-content/75">{active.message}</p>
        ) : null}
        <div className="confirm-modal__actions">
          {active.buttons.map((button, index) => (
            <Button
              key={`${button.label}-${index}`}
              variant={toneVariant(button.tone)}
              className="h-10 min-h-10 rounded-xl px-4"
              onClick={() => closeWithResult(button.value ?? button.label)}
            >
              {button.label}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}
