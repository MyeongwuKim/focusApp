import { forwardRef, type InputHTMLAttributes } from "react";

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: "default" | "plain";
};

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  { className, variant = "default", ...props },
  ref
) {
  const baseClassName =
    variant === "plain"
      ? "outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
      : "input input-bordered outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0";

  return <input ref={ref} className={[baseClassName, className ?? ""].join(" ").trim()} {...props} />;
});
