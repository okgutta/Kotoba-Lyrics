// Protocol 2 adds persisted minimum-version policy and extension-only blocking.
export const LOADER_VERSION = 2;
const stable = (value) =>
  typeof value === "string" &&
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value) &&
  value.split(".").every((part) => Number.isSafeInteger(Number(part)));

export function buildUpdatePolicy(config, version) {
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw new Error("Invalid update policy configuration.");
  const minimum = config.minimumSupportedVersion;
  if (minimum === null || minimum === undefined) return {};
  if (!stable(minimum) || !stable(version))
    throw new Error("minimumSupportedVersion must be a stable semantic version.");
  const left = minimum.split(".").map(Number);
  const right = version.split(".").map(Number);
  const difference = left.map((part, index) => part - right[index]).find((part) => part !== 0) ?? 0;
  if (difference > 0) throw new Error("minimumSupportedVersion cannot exceed the release version.");
  if (typeof config.reason !== "string" || !config.reason.trim() || config.reason.length > 1000)
    throw new Error("A mandatory update requires a reason of 1–1000 characters.");
  return { minimumSupportedVersion: minimum, updateReason: config.reason.trim() };
}
