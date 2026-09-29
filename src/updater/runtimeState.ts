import { atom, computed } from "nanostores";
import { ProjectVersion } from "../../project/config.ts";
import type { UpdateState } from "./contracts.ts";

export const $updateState = atom<UpdateState>(
  (typeof window !== "undefined" ? window.__LYRIVA_UPDATER__?.getState() : undefined) ?? {
    phase: "idle",
    currentVersion: ProjectVersion,
  }
);
export const $updateRequired = computed($updateState, (state) => Boolean(state.updateRequired));
export const $updatePanelOpen = atom(false);
const updatePanels = new Set<object>();
/** Track overlapping React mounts while the singleton settings modal changes pages. */
export function retainUpdatePanel(): () => void {
  const owner = {};
  updatePanels.add(owner);
  $updatePanelOpen.set(true);
  return () => {
    updatePanels.delete(owner);
    $updatePanelOpen.set(updatePanels.size > 0);
  };
}

let openPanel: (() => void) | undefined;
export function setUpdatePanelOpener(open: () => void): void {
  openPanel = open;
}
export function requestUpdatePanel(): void {
  openPanel?.();
}
