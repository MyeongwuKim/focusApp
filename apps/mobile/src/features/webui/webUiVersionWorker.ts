import * as FileSystem from "expo-file-system/legacy";
import JSZip from "jszip";
import type { EmbeddedWebUiFile } from "./embeddedWebUiBundle";

const WEB_UI_ROOT_DIR = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ""}web-ui/`;
const WEB_UI_ACTIVE_DIR = `${WEB_UI_ROOT_DIR}active/`;
const WEB_UI_STAGING_DIR = `${WEB_UI_ROOT_DIR}staging/`;
const WEB_UI_RELEASE_STATE_FILE_URI = `${
  FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? ""
}web-ui-release-state-v1.json`;
const WEB_UI_MANIFEST_FETCH_TIMEOUT_MS = 5000;
const WEB_UI_BUNDLE_FETCH_TIMEOUT_MS = 15000;

export type WebUiReleaseChannel = "dev" | "prod" | "none";
export type WebUiVersionProgress =
  | "초기 번들 준비중..."
  | "버전 체크중..."
  | "앱 번들 설치중..."
  | "앱 시작중...";

type WebUiManifest = {
  version: string;
  bundleUrl?: string;
  entryUrl?: string;
  sha256?: string;
  createdAt?: string;
};

type StoredWebUiReleaseState = {
  version: string;
  channel?: WebUiReleaseChannel;
  updatedAt: string;
};

export type StoredWebUiReleaseSnapshot = {
  version: string;
  channel: WebUiReleaseChannel | "unknown";
  updatedAt: string;
};

export function resolveWebUiReleaseChannel(input: {
  explicitChannel?: string;
  isDev: boolean;
}): WebUiReleaseChannel {
  const channel = input.explicitChannel?.trim().toLowerCase();
  if (channel === "dev" || channel === "prod" || channel === "none") {
    return channel;
  }
  return input.isDev ? "dev" : "prod";
}

export function resolveWebUiManifestUrl(input: {
  channel: WebUiReleaseChannel;
  manifestUrlDev?: string;
  manifestUrlProd?: string;
  manifestUrlFallback?: string;
}) {
  if (input.channel === "none") {
    return null;
  }

  const channelUrl =
    input.channel === "dev" ? input.manifestUrlDev : input.manifestUrlProd;
  const normalizedChannelUrl = normalizeOptionalUrl(channelUrl);
  if (normalizedChannelUrl) {
    return normalizedChannelUrl;
  }
  return normalizeOptionalUrl(input.manifestUrlFallback);
}

export async function prepareWebUiBundleVersion(input: {
  embeddedFiles: EmbeddedWebUiFile[];
  releaseChannel: WebUiReleaseChannel;
  manifestUrl: string | null;
  fallbackCurrentVersion: string;
  onProgress?: (message: WebUiVersionProgress) => void;
}) {
  input.onProgress?.("초기 번들 준비중...");
  await FileSystem.makeDirectoryAsync(WEB_UI_ROOT_DIR, { intermediates: true });

  const activeIndexUri = `${WEB_UI_ACTIVE_DIR}index.html`;
  const activeIndexInfo = await FileSystem.getInfoAsync(activeIndexUri);
  if (!activeIndexInfo.exists) {
    await writeEmbeddedWebUiToDirectory(input.embeddedFiles, WEB_UI_ACTIVE_DIR);
  }

  const verifiedActiveIndexInfo = await FileSystem.getInfoAsync(activeIndexUri);
  if (!verifiedActiveIndexInfo.exists) {
    throw new Error(`WEB_UI_INDEX_MISSING:${activeIndexUri}`);
  }

  let nextEntryUri = activeIndexUri;

  try {
    if (input.manifestUrl) {
      input.onProgress?.("버전 체크중...");
      const manifestResponse = await withTimeout(
        fetch(input.manifestUrl),
        WEB_UI_MANIFEST_FETCH_TIMEOUT_MS,
        "WEB_UI_MANIFEST_FETCH_TIMEOUT"
      );

      if (manifestResponse.ok) {
        const manifest = (await manifestResponse.json()) as WebUiManifest;
        const remoteVersion =
          typeof manifest.version === "string" ? manifest.version.trim() : "";
        const remoteBundleUrl = resolveWebUiBundleUrl(manifest);
        const previousRelease = await readStoredWebUiReleaseState();
        const currentVersion =
          previousRelease?.version ?? input.fallbackCurrentVersion;

        if (remoteBundleUrl && parseSemver(remoteVersion)) {
          const compared = compareSemver(remoteVersion, currentVersion);
          if (compared > 0) {
            input.onProgress?.("앱 번들 설치중...");
            const bundleResponse = await withTimeout(
              fetch(remoteBundleUrl),
              WEB_UI_BUNDLE_FETCH_TIMEOUT_MS,
              "WEB_UI_BUNDLE_FETCH_TIMEOUT"
            );
            if (!bundleResponse.ok) {
              throw new Error(`WEB_UI_BUNDLE_HTTP_${bundleResponse.status}`);
            }

            const zipArrayBuffer = await bundleResponse.arrayBuffer();
            await extractWebUiZipToDirectory({
              zipArrayBuffer,
              directoryUri: WEB_UI_STAGING_DIR,
            });

            await FileSystem.deleteAsync(WEB_UI_ACTIVE_DIR, { idempotent: true });
            await FileSystem.moveAsync({
              from: WEB_UI_STAGING_DIR,
              to: WEB_UI_ACTIVE_DIR,
            });
            nextEntryUri = activeIndexUri;

            await writeStoredWebUiReleaseState({
              version: remoteVersion,
              channel: input.releaseChannel,
            });

            console.log("Upgraded web-ui release from R2:", {
              channel: input.releaseChannel,
              from: currentVersion,
              to: remoteVersion,
              manifestUrl: input.manifestUrl,
              bundleUrl: remoteBundleUrl,
            });
          } else if (compared < 0) {
            console.log("Skipped downgrade web-ui release:", {
              channel: input.releaseChannel,
              current: currentVersion,
              remote: remoteVersion,
            });
          }
        }
      }
    }
  } catch (error) {
    console.log("Failed to load/update remote web-ui manifest:", error);
  } finally {
    await FileSystem.deleteAsync(WEB_UI_STAGING_DIR, { idempotent: true }).catch(
      () => undefined
    );
  }
  input.onProgress?.("앱 시작중...");

  return {
    localIndexUri: activeIndexUri,
    entryUri: nextEntryUri,
  };
}

export async function readStoredWebUiReleaseSnapshot(): Promise<StoredWebUiReleaseSnapshot | null> {
  const stored = await readStoredWebUiReleaseState();
  if (!stored) {
    return null;
  }

  return {
    version: stored.version,
    channel: stored.channel ?? "unknown",
    updatedAt: stored.updatedAt,
  };
}

function normalizeOptionalUrl(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  return normalized.replace(/\/+$/, "");
}

function resolveWebUiBundleUrl(manifest: WebUiManifest) {
  return normalizeOptionalUrl(manifest.bundleUrl);
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

async function readStoredWebUiReleaseState() {
  try {
    const info = await FileSystem.getInfoAsync(WEB_UI_RELEASE_STATE_FILE_URI);
    if (!info.exists) {
      return null;
    }
    const raw = await FileSystem.readAsStringAsync(WEB_UI_RELEASE_STATE_FILE_URI, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const parsed = JSON.parse(raw) as StoredWebUiReleaseState;
    if (typeof parsed?.version !== "string" || !parsed.version.trim()) {
      return null;
    }
    const channel =
      parsed.channel === "dev" || parsed.channel === "prod" ? parsed.channel : undefined;
    return {
      version: parsed.version.trim(),
      channel,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return null;
  }
}

async function writeStoredWebUiReleaseState(input: {
  version: string;
  channel: WebUiReleaseChannel;
}) {
  try {
    await FileSystem.writeAsStringAsync(
      WEB_UI_RELEASE_STATE_FILE_URI,
      JSON.stringify(
        {
          version: input.version,
          channel: input.channel,
          updatedAt: new Date().toISOString(),
        } satisfies StoredWebUiReleaseState,
        null,
        2
      ),
      { encoding: FileSystem.EncodingType.UTF8 }
    );
  } catch (error) {
    console.log("Failed to persist web-ui release state:", error);
  }
}

function sanitizeZipEntryPath(rawPath: string) {
  const normalized = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.endsWith("/")) {
    return null;
  }
  const pathSegments = normalized.split("/");
  if (pathSegments.some((segment) => !segment || segment === "." || segment === "..")) {
    return null;
  }
  return normalized;
}

async function ensureCleanDirectory(directoryUri: string) {
  await FileSystem.deleteAsync(directoryUri, { idempotent: true });
  await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
}

async function stripCrossoriginFromIndexHtml(indexUri: string) {
  let currentHtml = await FileSystem.readAsStringAsync(indexUri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  currentHtml = currentHtml.replace(/\s+crossorigin(?=[\s>])/gi, "");
  await FileSystem.writeAsStringAsync(indexUri, currentHtml, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

async function writeEmbeddedWebUiToDirectory(
  embeddedFiles: EmbeddedWebUiFile[],
  directoryUri: string
) {
  await ensureCleanDirectory(directoryUri);

  for (const file of embeddedFiles) {
    const targetUri = `${directoryUri}${file.path}`;
    const targetDir = targetUri.slice(0, targetUri.lastIndexOf("/") + 1);

    await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
    await FileSystem.writeAsStringAsync(targetUri, file.contentBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  const indexUri = `${directoryUri}index.html`;
  const indexInfo = await FileSystem.getInfoAsync(indexUri);
  if (!indexInfo.exists) {
    throw new Error(`WEB_UI_INDEX_MISSING:${indexUri}`);
  }
  await stripCrossoriginFromIndexHtml(indexUri);
}

async function extractWebUiZipToDirectory(input: {
  zipArrayBuffer: ArrayBuffer;
  directoryUri: string;
}) {
  await ensureCleanDirectory(input.directoryUri);

  const zip = await JSZip.loadAsync(input.zipArrayBuffer);
  const writeTasks: Promise<void>[] = [];

  zip.forEach((relativePath, file) => {
    if (file.dir) {
      return;
    }

    const safePath = sanitizeZipEntryPath(relativePath);
    if (!safePath) {
      return;
    }

    const targetUri = `${input.directoryUri}${safePath}`;
    const targetDir = targetUri.slice(0, targetUri.lastIndexOf("/") + 1);
    writeTasks.push(
      (async () => {
        await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
        const base64 = await file.async("base64");
        await FileSystem.writeAsStringAsync(targetUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      })()
    );
  });

  await Promise.all(writeTasks);
  const indexUri = `${input.directoryUri}index.html`;
  const indexInfo = await FileSystem.getInfoAsync(indexUri);
  if (!indexInfo.exists) {
    throw new Error("WEB_UI_INDEX_MISSING_IN_ZIP");
  }
  await stripCrossoriginFromIndexHtml(indexUri);
}
