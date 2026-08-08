export function readUnknownRecord(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

export function readUnknownString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
