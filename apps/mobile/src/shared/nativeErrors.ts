import { readUnknownRecord, readUnknownString } from "./nativeValues";

export function resolveNativeErrorSignals(error: unknown) {
  const signals = new Set<string>();

  if (error instanceof Error) {
    const errorMessage = readUnknownString(error.message);
    if (errorMessage) {
      signals.add(errorMessage.toLowerCase());
    }
  }

  const errorRecord = readUnknownRecord(error);
  if (errorRecord) {
    const message = readUnknownString(errorRecord.message);
    const code = readUnknownString(errorRecord.code);
    if (message) {
      signals.add(message.toLowerCase());
    }
    if (code) {
      signals.add(code.toLowerCase());
    }

    const userInfo = readUnknownRecord(errorRecord.userInfo);
    const nativeMessage = readUnknownString(userInfo?.nativeErrorMessage);
    if (nativeMessage) {
      signals.add(nativeMessage.toLowerCase());
    }
  }

  const asString = readUnknownString(typeof error === "string" ? error : "");
  if (asString) {
    signals.add(asString.toLowerCase());
  }

  return Array.from(signals);
}

export function resolveNativeErrorCode(error: unknown, fallbackCode: string) {
  const errorRecord = readUnknownRecord(error);
  const code = readUnknownString(errorRecord?.code);
  if (code) {
    return code;
  }

  if (error instanceof Error) {
    const message = readUnknownString(error.message);
    if (message) {
      return message;
    }
  }

  const message = readUnknownString(errorRecord?.message);
  return message || fallbackCode;
}
