import * as Sentry from "@sentry/react";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|set-cookie|password|secret|token|api[-_]?key|x-batch-secret)/i;

let sentryEnabled = false;

export function initWebSentry() {
  if (!sentryDsn) {
    return false;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    beforeSend(event) {
      return sanitizeEvent(event);
    },
  });

  sentryEnabled = true;
  return true;
}

export function getSentryEnabled() {
  return sentryEnabled;
}

function sanitizeEvent<T>(event: T): T {
  return sanitizeUnknown(event, new WeakSet<object>()) as T;
}

function sanitizeUnknown(value: unknown, seen: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknown(item, seen));
  }

  if (typeof value === "object" && value !== null) {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);

    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key) || key.toLowerCase() === "email") {
        next[key] = "[Filtered]";
        continue;
      }
      next[key] = sanitizeUnknown(child, seen);
    }
    return next;
  }

  return value;
}

export { Sentry };
