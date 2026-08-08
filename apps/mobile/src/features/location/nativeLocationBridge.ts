import * as ExpoLocation from "expo-location";
import { PermissionsAndroid, Platform } from "react-native";
import type {
  LocationBridgeHandlerDeps,
  LocationCoordinatesSnapshot,
  LocationPermissionSnapshot,
  NativeCoordinates,
  NativePermissionState,
} from "../bridge/handlers/locationBridgeHandlers";
import type { SendBridgeResult } from "../bridge/types";

type GeolocationLike = {
  getCurrentPosition: (
    success: (position: { coords?: { latitude?: number; longitude?: number } }) => void,
    failure: (error?: unknown) => void,
    options?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number }
  ) => void;
};

function loadExpoLocationModule() {
  return ExpoLocation as {
    getForegroundPermissionsAsync?: typeof ExpoLocation.getForegroundPermissionsAsync;
    requestForegroundPermissionsAsync?: typeof ExpoLocation.requestForegroundPermissionsAsync;
    getCurrentPositionAsync?: (options?: {
      accuracy?: number;
      timeout?: number;
      maximumAge?: number;
    }) => Promise<{ coords?: { latitude?: number; longitude?: number } }>;
  };
}

async function getLocationPermissionState(): Promise<NativePermissionState> {
  const expoLocation = loadExpoLocationModule();
  if (expoLocation.getForegroundPermissionsAsync) {
    try {
      const result = await expoLocation.getForegroundPermissionsAsync();
      if (result.granted || result.status === "granted") return "granted";
      if (result.status === "denied") return "denied";
      return "undetermined";
    } catch (error) {
      console.log("Failed to check location permission via expo-location:", error);
      return "undetermined";
    }
  }

  if (Platform.OS === "android") {
    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted ? "granted" : "undetermined";
    } catch (error) {
      console.log("Failed to check Android location permission:", error);
    }
  }

  return "undetermined";
}

export async function requestLocationPermission() {
  const expoLocation = loadExpoLocationModule();
  if (expoLocation.requestForegroundPermissionsAsync) {
    try {
      const result = await expoLocation.requestForegroundPermissionsAsync();
      return result.granted || result.status === "granted";
    } catch (error) {
      console.log("Failed to request location permission via expo-location:", error);
      return false;
    }
  }

  if (Platform.OS === "android") {
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.log("Failed to request Android location permission:", error);
      return false;
    }
  }

  const geolocation = (globalThis.navigator as { geolocation?: GeolocationLike } | undefined)
    ?.geolocation;
  const getCurrentPosition = geolocation?.getCurrentPosition?.bind(geolocation);
  if (!getCurrentPosition) return false;

  return await new Promise<boolean>((resolve) => {
    getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
    );
  });
}

export async function getLocationPermissionSnapshot(): Promise<LocationPermissionSnapshot> {
  const expoLocation = loadExpoLocationModule();
  if (expoLocation.getForegroundPermissionsAsync) {
    try {
      const result = await expoLocation.getForegroundPermissionsAsync();
      const granted = Boolean(result.granted || result.status === "granted");
      const status: NativePermissionState =
        result.status === "granted"
          ? "granted"
          : result.status === "denied"
            ? "denied"
            : "undetermined";
      return {
        granted,
        canAskAgain:
          typeof result.canAskAgain === "boolean" ? result.canAskAgain : status !== "denied",
        status,
      };
    } catch (error) {
      console.log("Failed to read location permission snapshot via expo-location:", error);
    }
  }

  const status = await getLocationPermissionState();
  return {
    granted: status === "granted",
    canAskAgain: status !== "denied",
    status,
  };
}

async function getCurrentLocationCoordinates(): Promise<NativeCoordinates | null> {
  const expoLocation = loadExpoLocationModule();
  if (expoLocation.getCurrentPositionAsync) {
    try {
      const result = await expoLocation.getCurrentPositionAsync({ timeout: 8000 });
      const latitude = result?.coords?.latitude;
      const longitude = result?.coords?.longitude;
      if (typeof latitude === "number" && typeof longitude === "number") {
        return { latitude, longitude };
      }
    } catch (error) {
      console.log("Failed to read current position via expo-location:", error);
    }
  }

  const geolocation = (globalThis.navigator as { geolocation?: GeolocationLike } | undefined)
    ?.geolocation;
  const getCurrentPosition = geolocation?.getCurrentPosition?.bind(geolocation);
  if (!getCurrentPosition) return null;

  return await new Promise<NativeCoordinates | null>((resolve) => {
    getCurrentPosition(
      (position) => {
        const latitude = position?.coords?.latitude;
        const longitude = position?.coords?.longitude;
        resolve(
          typeof latitude === "number" && typeof longitude === "number"
            ? { latitude, longitude }
            : null
        );
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

export async function getLocationCoordinatesSnapshot(): Promise<LocationCoordinatesSnapshot> {
  const permission = await getLocationPermissionSnapshot();
  if (!permission.granted) {
    return { ...permission, coordinates: null };
  }
  return { ...permission, coordinates: await getCurrentLocationCoordinates() };
}

export function createNativeLocationBridgeDeps(
  sendBridgeResult: SendBridgeResult
): LocationBridgeHandlerDeps {
  return {
    sendBridgeResult,
    getLocationPermissionSnapshot,
    requestLocationPermission,
    getLocationCoordinatesSnapshot,
  };
}
