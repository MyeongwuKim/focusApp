import type { ComponentPropsWithoutRef } from "react";

type SelectOption = {
  value: string | number;
  label: string;
  disabled?: boolean;
};

type SelectDropboxProps = Omit<ComponentPropsWithoutRef<"select">, "children"> & {
  options: SelectOption[];
};

export function SelectDropbox({ className, options, ...props }: SelectDropboxProps) {
  const normalizedValue =
    props.value === undefined || props.value === null
      ? props.value
      : Array.isArray(props.value)
      ? props.value.map((value) => String(value))
      : String(props.value);

  const normalizedDefaultValue =
    props.defaultValue === undefined || props.defaultValue === null
      ? props.defaultValue
      : Array.isArray(props.defaultValue)
      ? props.defaultValue.map((value) => String(value))
      : String(props.defaultValue);

  return (
    <select
      {...props}
      value={normalizedValue}
      defaultValue={normalizedDefaultValue}
      className={[
        "select select-bordered w-full focus:outline-none focus:ring-0 focus:border-base-300",
        className ?? "",
      ].join(" ")}
    >
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
