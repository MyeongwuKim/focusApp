import {
  readBridgeRequestId,
  readBridgeType,
  type ParsedBridgeMessage,
  type SendBridgeResult,
} from "../types";

export type NativePermissionState = "granted" | "denied" | "undetermined";

export type LocationPermissionSnapshot = {
  granted: boolean;
  canAskAgain: boolean;
  status: NativePermissionState;
};

export type NativeCoordinates = {
  latitude: number;
  longitude: number;
};

export type LocationCoordinatesSnapshot = LocationPermissionSnapshot & {
  coordinates: NativeCoordinates | null;
};

export type LocationBridgeHandlerDeps = {
  sendBridgeResult: SendBridgeResult;
  getLocationPermissionSnapshot: () => Promise<LocationPermissionSnapshot>;
  requestLocationPermission: () => Promise<boolean>;
  getLocationCoordinatesSnapshot: () => Promise<LocationCoordinatesSnapshot>;
};

export async function handleLocationBridgeMessage(
  parsedData: ParsedBridgeMessage,
  deps: LocationBridgeHandlerDeps
): Promise<boolean> {
  const messageType = readBridgeType(parsedData);
  if (!messageType) {
    return false;
  }

  if (messageType === "REST_LOCATION_PERMISSION_STATUS_REQUEST") {
    const requestId = readBridgeRequestId(parsedData);
    const snapshot = await deps.getLocationPermissionSnapshot();
    deps.sendBridgeResult({
      type: "REST_LOCATION_PERMISSION_STATUS_RESULT",
      requestId,
      payload: snapshot,
    });
    return true;
  }

  if (messageType === "REST_LOCATION_PERMISSION_REQUEST") {
    const requestId = readBridgeRequestId(parsedData);
    const requestedGranted = await deps.requestLocationPermission();
    const snapshot = await deps.getLocationPermissionSnapshot();
    const normalizedSnapshot =
      requestedGranted && !snapshot.granted
        ? { ...snapshot, granted: true, canAskAgain: true, status: "granted" as NativePermissionState }
        : snapshot;

    deps.sendBridgeResult({
      type: "REST_LOCATION_PERMISSION_RESULT",
      requestId,
      payload: normalizedSnapshot,
    });
    return true;
  }

  if (messageType === "REST_LOCATION_COORDINATES_REQUEST") {
    const requestId = readBridgeRequestId(parsedData);
    const snapshot = await deps.getLocationCoordinatesSnapshot();
    deps.sendBridgeResult({
      type: "REST_LOCATION_COORDINATES_RESULT",
      requestId,
      payload: snapshot,
    });
    return true;
  }

  return false;
}
