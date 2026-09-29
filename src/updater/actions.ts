import type { UpdateBridge } from "./contracts.ts";
import { $updateState } from "./runtimeState.ts";

export function getUpdateBridge(): UpdateBridge | undefined {
  return window.__LYRIVA_UPDATER__;
}
export async function runUpdateAction(action: "check" | "download"): Promise<void> {
  const bridge = getUpdateBridge();
  if (!bridge) return;
  try {
    await bridge[action]();
  } catch (error) {
    $updateState.set({
      ...bridge.getState(),
      phase: "error",
      error: error instanceof Error ? error.message : "暂时无法获取更新，请稍后重试。",
    });
  }
}
