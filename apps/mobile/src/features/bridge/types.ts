export type ParsedBridgeMessage = {
  type?: unknown;
  requestId?: unknown;
  payload?: unknown;
  [key: string]: unknown;
};

export type BridgeResultMessage = {
  type: string;
  requestId?: string | null;
  payload?: unknown;
};

export type SendBridgeResult = (message: BridgeResultMessage) => void;

export function readBridgeType(message: ParsedBridgeMessage) {
  return typeof message.type === "string" ? message.type : null;
}

export function readBridgeRequestId(message: ParsedBridgeMessage) {
  if (typeof message.requestId !== "string") {
    return null;
  }
  const normalized = message.requestId.trim();
  return normalized ? normalized : null;
}

export function readBridgePayloadRecord(message: ParsedBridgeMessage) {
  if (!message.payload || typeof message.payload !== "object") {
    return null;
  }
  return message.payload as Record<string, unknown>;
}
