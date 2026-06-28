import { execFileSync } from "node:child_process";

const DEFAULT_RELEASES_TO_KEEP = 5;

function readRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function resolveReleasesToKeep() {
  const raw = process.env.WEBUI_RELEASES_TO_KEEP?.trim();
  if (!raw) {
    return DEFAULT_RELEASES_TO_KEEP;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("WEBUI_RELEASES_TO_KEEP must be a positive integer.");
  }
  return parsed;
}

function parseSemver(version) {
  const matched = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!matched) {
    return null;
  }

  return {
    version,
    major: Number(matched[1]),
    minor: Number(matched[2]),
    patch: Number(matched[3]),
  };
}

function compareSemverDesc(left, right) {
  if (left.major !== right.major) {
    return right.major - left.major;
  }
  if (left.minor !== right.minor) {
    return right.minor - left.minor;
  }
  return right.patch - left.patch;
}

function listReleasePrefixes(input) {
  const output = execFileSync(
    "aws",
    [
      "s3",
      "ls",
      `s3://${input.bucketName}/releases/`,
      "--endpoint-url",
      input.endpointUrl,
    ],
    { encoding: "utf8" }
  );

  return output
    .split("\n")
    .map((line) => /^PRE\s+(.+)\/\s*$/.exec(line.trim())?.[1])
    .filter(Boolean);
}

function removeRelease(input) {
  execFileSync(
    "aws",
    [
      "s3",
      "rm",
      `s3://${input.bucketName}/releases/${input.version}/`,
      "--recursive",
      "--endpoint-url",
      input.endpointUrl,
    ],
    { stdio: "inherit" }
  );
}

const r2AccountId = readRequiredEnv("R2_ACCOUNT_ID");
const bucketName = readRequiredEnv("R2_BUCKET_NAME");
const releasesToKeep = resolveReleasesToKeep();
const endpointUrl = `https://${r2AccountId}.r2.cloudflarestorage.com`;

const releasePrefixes = listReleasePrefixes({ bucketName, endpointUrl });
const parsedReleases = [];
const skippedPrefixes = [];

for (const prefix of releasePrefixes) {
  const parsed = parseSemver(prefix);
  if (parsed) {
    parsedReleases.push(parsed);
  } else {
    skippedPrefixes.push(prefix);
  }
}

const sortedReleases = parsedReleases.sort(compareSemverDesc);
const releasesToDelete = sortedReleases.slice(releasesToKeep);

console.log(`Found ${sortedReleases.length} semver web-ui releases.`);
console.log(`Keeping latest ${releasesToKeep}: ${sortedReleases.slice(0, releasesToKeep).map((release) => release.version).join(", ") || "-"}`);

if (skippedPrefixes.length > 0) {
  console.log(`Skipped non-semver release prefixes: ${skippedPrefixes.join(", ")}`);
}

if (releasesToDelete.length === 0) {
  console.log("No old web-ui releases to remove.");
  process.exit(0);
}

for (const release of releasesToDelete) {
  console.log(`Removing old web-ui release: ${release.version}`);
  removeRelease({ bucketName, endpointUrl, version: release.version });
}
