import { compareVersions, stableVersion } from "./protocol.ts";
import type { UpdateState } from "./contracts.ts";

export interface UpdatePolicy {
  latestVersion: string;
  minimumSupportedVersion: string;
  updateReason?: string;
}

export function parseStoredPolicy(value: unknown): UpdatePolicy | undefined {
  if (!value || typeof value !== "object") return;
  const policy = value as Partial<UpdatePolicy>;
  if (
    !stableVersion(policy.latestVersion) ||
    !stableVersion(policy.minimumSupportedVersion) ||
    compareVersions(policy.minimumSupportedVersion, policy.latestVersion) > 0 ||
    (policy.updateReason !== undefined &&
      (typeof policy.updateReason !== "string" || policy.updateReason.length > 1000))
  )
    return;
  return {
    latestVersion: policy.latestVersion,
    minimumSupportedVersion: policy.minimumSupportedVersion,
    ...(policy.updateReason ? { updateReason: policy.updateReason } : {}),
  };
}

export function policyState(
  policy: UpdatePolicy | undefined,
  currentVersion: string
): Partial<UpdateState> {
  if (!policy) return {};
  return {
    minimumSupportedVersion: policy.minimumSupportedVersion,
    updateReason: policy.updateReason,
    ...(compareVersions(policy.latestVersion, currentVersion) > 0
      ? { latestVersion: policy.latestVersion }
      : {}),
    releaseUrl: `https://github.com/okgutta/lyrivaMusic/releases/tag/v${policy.latestVersion}`,
    updateRequired: compareVersions(currentVersion, policy.minimumSupportedVersion) < 0,
  };
}
