export type NativeAppVersionChannel = "dev" | "prod" | "none";
export type NativeAppVersionPlatform = "ios" | "android" | "unknown";

type NativeAppVersionPolicy = {
  enabled: boolean;
  minimumVersion: string;
  storeUrl: string | null;
};

type NativeAppVersionPolicyConfig = Record<
  Exclude<NativeAppVersionPlatform, "unknown">,
  NativeAppVersionPolicy
>;

export type NativeUpdateRequirement = {
  minimumVersion: string;
  storeUrl: string | null;
};

const NATIVE_VERSION_POLICY_FETCH_TIMEOUT_MS = 5000;
const NATIVE_VERSION_POLICY_PATH = "native/minimum-app-version.json";

export function resolveNativeAppVersionPolicyUrl(input: {
  explicitUrl?: string;
  webUiManifestUrl: string | null;
}) {
  const explicitUrl = normalizeOptionalUrl(input.explicitUrl);
  if (explicitUrl) {
    return explicitUrl;
  }

  const manifestUrl = normalizeOptionalUrl(input.webUiManifestUrl ?? undefined);
  if (!manifestUrl) {
    return null;
  }

  try {
    const parsed = new URL(manifestUrl);
    const knownManifestSuffixes = ["/latest/manifest.json", "/latest.json"];
    const suffix = knownManifestSuffixes.find((candidate) => parsed.pathname.endsWith(candidate));
    if (!suffix) {
      return null;
    }

    const basePath = parsed.pathname.slice(0, -suffix.length).replace(/\/+$/, "");
    parsed.pathname = `${basePath}/${NATIVE_VERSION_POLICY_PATH}`;
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function checkNativeAppVersionPolicy(input: {
  policyUrl: string | null;
  channel: NativeAppVersionChannel;
  platform: NativeAppVersionPlatform;
  currentVersion: string;
}): Promise<NativeUpdateRequirement | null> {
  if (
    !input.policyUrl ||
    input.channel === "none" ||
    input.platform === "unknown"
  ) {
    return null;
  }

  if (!parseSemver(input.currentVersion)) {
    throw new Error("NATIVE_APP_VERSION_INVALID");
  }

  const response = await withTimeout(
    fetch(input.policyUrl),
    NATIVE_VERSION_POLICY_FETCH_TIMEOUT_MS,
    "NATIVE_VERSION_POLICY_FETCH_TIMEOUT"
  );
  if (!response.ok) {
    throw new Error(`NATIVE_VERSION_POLICY_HTTP_${response.status}`);
  }

  let config: NativeAppVersionPolicyConfig;
  try {
    config = (await response.json()) as NativeAppVersionPolicyConfig;
  } catch {
    throw new Error("NATIVE_VERSION_POLICY_PARSE_FAILED");
  }

  const policy = config?.[input.platform];
  if (typeof policy?.enabled !== "boolean") {
    throw new Error("NATIVE_VERSION_POLICY_ENABLED_INVALID");
  }

  const minimumVersion =
    typeof policy.minimumVersion === "string" ? policy.minimumVersion.trim() : "";
  if (!parseSemver(minimumVersion)) {
    throw new Error("NATIVE_VERSION_POLICY_MINIMUM_VERSION_INVALID");
  }

  if (policy.storeUrl !== null && typeof policy.storeUrl !== "string") {
    throw new Error("NATIVE_VERSION_POLICY_STORE_URL_INVALID");
  }

  if (!policy.enabled || compareSemver(input.currentVersion, minimumVersion) >= 0) {
    return null;
  }

  return {
    minimumVersion,
    storeUrl: normalizeOptionalUrl(policy.storeUrl ?? undefined),
  };
}

function normalizeOptionalUrl(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function parseSemver(version: string) {
  const matched = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!matched) {
    return null;
  }

  return {
    major: Number(matched[1]),
    minor: Number(matched[2]),
    patch: Number(matched[3]),
  };
}

function compareSemver(a: string, b: string) {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) {
    return 0;
  }
  if (left.major !== right.major) {
    return left.major > right.major ? 1 : -1;
  }
  if (left.minor !== right.minor) {
    return left.minor > right.minor ? 1 : -1;
  }
  if (left.patch !== right.patch) {
    return left.patch > right.patch ? 1 : -1;
  }
  return 0;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorCode: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(errorCode));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}
