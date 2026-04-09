import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "default" | "primary" | "ghost" | "outline" | "error";
type ButtonSize = "xs" | "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  circle?: boolean;
  square?: boolean;
};

const variantClassName: Record<ButtonVariant, string> = {
  default: "",
  primary: "btn-primary",
  ghost: "btn-ghost",
  outline: "btn-outline",
  error: "btn-error",
};

const sizeClassName: Record<ButtonSize, string> = {
  xs: "btn-xs",
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "default",
    size = "md",
    type = "button",
    block = false,
    circle = false,
    square = false,
    ...props
  },
  ref
) {
  const classNames = [
    "btn",
    variantClassName[variant],
    sizeClassName[size],
    block ? "btn-block" : "",
    circle ? "btn-circle" : "",
    square ? "btn-square" : "",
    "outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <button ref={ref} type={type} className={classNames} {...props} />;
});
