import * as Sentry from "@sentry/node";
import type { GraphQLError } from "graphql";
import { env } from "../../config/env.js";

const SAFE_GRAPHQL_ERROR_CODES = new Set([
  "BAD_USER_INPUT",
  "UNAUTHORIZED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "GRAPHQL_PARSE_FAILED",
  "GRAPHQL_VALIDATION_FAILED",
  "PERSISTED_QUERY_NOT_FOUND",
  "PERSISTED_QUERY_NOT_SUPPORTED",
]);

const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|set-cookie|password|secret|token|api[-_]?key|x-batch-secret)/i;
const MAX_SUMMARY_DEPTH = 3;
const MAX_SUMMARY_ARRAY_ITEMS = 5;
const MAX_SUMMARY_OBJECT_KEYS = 20;

export function initSentry() {
  if (!env.SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    sendDefaultPii: false,
    beforeSend(event) {
      return sanitizeEvent(event);
    },
  });
}

type CaptureServerErrorInput = {
  requestId: string;
  method: string;
  route: string;
  userId: string | null;
  statusCode: number;
  errorCode: string;
  requestInput?: unknown;
};

type CaptureGraphQLErrorInput = {
  requestId: string;
  route: string;
  operationName: string | null;
  userId: string | null;
  variables?: unknown;
};

export function resolveErrorCode(error: unknown) {
  if (typeof error !== "object" || !error) {
    return "INTERNAL_ERROR";
  }

  const record = error as {
    code?: unknown;
    extensions?: {
      code?: unknown;
    };
  };

  if (typeof record.extensions?.code === "string" && record.extensions.code.length > 0) {
    return record.extensions.code;
  }
  if (typeof record.code === "string" && record.code.length > 0) {
    return record.code;
  }
  return "INTERNAL_ERROR";
}

function shouldCaptureServerError(statusCode: number) {
  return statusCode >= 500;
}

function shouldCaptureGraphQLError(errorCode: string) {
  if (SAFE_GRAPHQL_ERROR_CODES.has(errorCode)) {
    return false;
  }
  return true;
}

export function captureServerError(error: unknown, context: CaptureServerErrorInput) {
  if (!env.SENTRY_DSN) {
    return;
  }
  if (!shouldCaptureServerError(context.statusCode)) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setTag("request_id", context.requestId);
    scope.setTag("method", context.method);
    scope.setTag("route", context.route);
    scope.setTag("status_code", String(context.statusCode));
    scope.setTag("error_code", context.errorCode);
    if (context.userId) {
      scope.setUser({ id: context.userId });
    }
    scope.setContext("request", {
      requestId: context.requestId,
      method: context.method,
      route: context.route,
      statusCode: context.statusCode,
      userId: context.userId,
      errorCode: context.errorCode,
    });
    const requestInputSummary = createSafeInputSummary(context.requestInput);
    if (requestInputSummary) {
      scope.setContext("request_input", requestInputSummary);
    }
    Sentry.captureException(error);
  });
}

export function captureGraphQLError(error: GraphQLError, context: CaptureGraphQLErrorInput) {
  if (!env.SENTRY_DSN) {
    return;
  }

  const errorCode = resolveErrorCode(error);
  if (!shouldCaptureGraphQLError(errorCode)) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setTag("request_id", context.requestId);
    scope.setTag("method", "POST");
    scope.setTag("route", context.route);
    scope.setTag("error_code", errorCode);
    scope.setTag("graphql_operation", context.operationName ?? "unknown");
    if (context.userId) {
      scope.setUser({ id: context.userId });
    }
    scope.setContext("graphql", {
      requestId: context.requestId,
      route: context.route,
      operationName: context.operationName,
      userId: context.userId,
      errorCode,
    });
    const variablesSummary = createSafeInputSummary(context.variables);
    if (variablesSummary) {
      scope.setContext("graphql_variables", variablesSummary);
    }
    Sentry.captureException(error.originalError ?? error);
  });
}

export async function flushSentry(timeoutMs = 2000) {
  if (!env.SENTRY_DSN) {
    return;
  }
  await Sentry.flush(timeoutMs);
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

export function createSafeInputSummary(value: unknown) {
  const summary = summarizeUnknown(value, 0, new WeakSet<object>());
  if (summary === undefined) {
    return null;
  }
  return { summary };
}

function summarizeUnknown(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }

  if (depth >= MAX_SUMMARY_DEPTH) {
    return "[TruncatedDepth]";
  }

  if (typeof value === "string") {
    return { type: "string", length: value.length };
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "bigint") {
    return { type: "bigint", value: value.toString() };
  }
  if (typeof value === "function") {
    return "[Function]";
  }
  if (value instanceof Date) {
    return { type: "date", value: value.toISOString() };
  }

  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
      items: value.slice(0, MAX_SUMMARY_ARRAY_ITEMS).map((item) =>
        summarizeUnknown(item, depth + 1, seen)
      ),
    };
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);

    const entries = Object.entries(value as Record<string, unknown>);
    const fields: Record<string, unknown> = {};
    for (const [key, child] of entries.slice(0, MAX_SUMMARY_OBJECT_KEYS)) {
      if (SENSITIVE_KEY_PATTERN.test(key) || key.toLowerCase() === "email") {
        fields[key] = "[Filtered]";
        continue;
      }
      fields[key] = summarizeUnknown(child, depth + 1, seen);
    }

    return {
      type: "object",
      keys: entries.length,
      fields,
    };
  }

  return String(value);
}
