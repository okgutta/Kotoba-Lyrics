import type { UpdateState } from "./contracts.ts";

const STORAGE_KEY = "lyriva:update-notices:v1";
type NoticeStorage = Pick<Storage, "getItem" | "setItem">;

/** Only actionable updates interrupt the user. A failed background check never does. */
export function updateNoticeKey(state: UpdateState): string | undefined {
  if (!state.latestVersion || state.latestVersion === state.currentVersion) return;
  if (state.updateRequired)
    return `required:${state.latestVersion}:${state.minimumSupportedVersion}`;
  if (state.loaderUpdateRequired && state.phase === "available")
    return `manual:${state.latestVersion}`;
  if (state.phase === "ready") return `ready:${state.latestVersion}`;
}

/** Persist presentation across restarts; retain an in-memory fallback if storage is unavailable. */
export function createUpdateNotices(storage: () => NoticeStorage | undefined) {
  const seen = new Set<string>();
  function read(): void {
    try {
      const value: unknown = JSON.parse(storage()?.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(value)) {
        for (const key of value.slice(-100)) {
          if (typeof key === "string" && key.length <= 160) seen.add(key);
        }
      }
    } catch {
      // A full or unavailable storage must never prevent using the extension.
    }
  }
  return {
    shouldPresent(state: UpdateState): boolean {
      read();
      const key = updateNoticeKey(state);
      return Boolean(key && !seen.has(key));
    },
    markPresented(state: UpdateState): void {
      const key = updateNoticeKey(state);
      if (!key) return;
      read();
      seen.add(key);
      try {
        storage()?.setItem(STORAGE_KEY, JSON.stringify([...seen].slice(-100)));
      } catch {
        // Keep the session-level record even when persistence fails.
      }
    },
  };
}
