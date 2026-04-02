export function toISOStringOrNull(value: Date | null) {
  return value ? value.toISOString() : null;
}
