const DEFAULT_ERROR_MESSAGE = "요청 처리 중 오류가 발생했어요.";

function localizeByStatusCode(statusCode: number) {
  if (statusCode === 400) {
    return "요청 형식이 올바르지 않아요.";
  }
  if (statusCode === 401) {
    return "로그인 정보가 만료되었어요. 다시 로그인해 주세요.";
  }
  if (statusCode === 403) {
    return "이 작업을 수행할 권한이 없어요.";
  }
  if (statusCode === 404) {
    return "요청한 정보를 찾을 수 없어요.";
  }
  if (statusCode === 408 || statusCode === 504) {
    return "응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.";
  }
  if (statusCode === 409) {
    return "이미 처리된 요청이에요. 화면을 새로고침해 주세요.";
  }
  if (statusCode === 429) {
    return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
  }
  if (statusCode >= 500 && statusCode <= 599) {
    return "서버에 문제가 발생했어요. 잠시 후 다시 시도해 주세요.";
  }
  return null;
}

function extractStatusCode(message: string) {
  const matched =
    message.match(/\b([1-5]\d{2})\b/) ??
    message.match(/failed:\s*([1-5]\d{2})/i) ??
    message.match(/status\s*([1-5]\d{2})/i);
  if (!matched?.[1]) {
    return null;
  }

  const parsed = Number(matched[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function localizeErrorMessage(message: string) {
  const normalized = message.trim();
  if (!normalized) {
    return DEFAULT_ERROR_MESSAGE;
  }

  if (
    /NetworkError|ERR_NETWORK|Failed to fetch|fetch failed|Load failed|ENOTFOUND|ECONNREFUSED|getaddrinfo/i.test(
      normalized
    )
  ) {
    return "서버에 연결할 수 없어요. 네트워크 상태를 확인해 주세요.";
  }

  if (/AbortError|timed out|timeout/i.test(normalized)) {
    return "요청 시간이 초과되었어요. 잠시 후 다시 시도해 주세요.";
  }

  const statusCode = extractStatusCode(normalized);
  if (statusCode !== null) {
    const localized = localizeByStatusCode(statusCode);
    if (localized) {
      return localized;
    }
  }

  if (/GraphQL/i.test(normalized)) {
    return "요청 처리 중 서버 응답에 문제가 발생했어요.";
  }

  if (/^[\x20-\x7E]+$/.test(normalized)) {
    return DEFAULT_ERROR_MESSAGE;
  }

  return normalized;
}

export function getUserFacingErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE) {
  if (error instanceof Error && error.message.trim()) {
    return localizeErrorMessage(error.message);
  }
  return fallback;
}

