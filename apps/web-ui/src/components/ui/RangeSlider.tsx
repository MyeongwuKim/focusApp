import { forwardRef, type InputHTMLAttributes } from "react";

type RangeSliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  leftLabel?: string;
  rightLabel?: string;
  containerClassName?: string;
  labelsClassName?: string;
};

export const RangeSlider = forwardRef<HTMLInputElement, RangeSliderProps>(function RangeSlider(
  { className, leftLabel, rightLabel, containerClassName, labelsClassName, ...props },
  ref
) {
  return (
    <div className={["space-y-1", containerClassName ?? ""].join(" ").trim()}>
      <input
        ref={ref}
        type="range"
        className={["range range-primary range-sm w-full", className ?? ""].join(" ").trim()}
        {...props}
      />
      {leftLabel || rightLabel ? (
        <div
          className={[
            "flex items-center justify-between text-[11px] text-base-content/55",
            labelsClassName ?? "",
          ]
            .join(" ")
            .trim()}
        >
          <span>{leftLabel ?? ""}</span>
          <span>{rightLabel ?? ""}</span>
        </div>
      ) : null}
    </div>
  );
});
