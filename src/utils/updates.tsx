import { useStore } from "@nanostores/react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { ProjectVersion } from "../../project/config.ts";
import { PopupModal } from "../components/Modal.ts";
import UpdatePanel from "../components/ReactComponents/UpdatePanel.tsx";
import type { UpdateBridge, UpdateState } from "../updater/contracts.ts";
import { createUpdateNotices, updateNoticeKey } from "../updater/notifications.ts";
import { $updateState, setUpdatePanelOpener } from "../updater/runtimeState.ts";
import "../css/update-panel.css";

export { $updateState };

const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const MODAL_ID = "lyrivaUpdate";
const notices = createUpdateNotices(() => window.localStorage);
let initialized = false;
let pendingNotice: string | undefined;
let waitingForModal: MutationObserver | undefined;

export function getUpdateBridge(): UpdateBridge | undefined {
  return window.__LYRIVA_UPDATER__;
}

function refreshState(): void {
  const bridge = getUpdateBridge();
  $updateState.set(bridge?.getState() ?? { phase: "idle", currentVersion: ProjectVersion });
}

async function runUpdateAction(action: "check" | "download"): Promise<void> {
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

function ConnectedUpdatePanel() {
  const state = useStore($updateState);
  return (
    <UpdatePanel
      state={state}
      automaticUpdates={Boolean(getUpdateBridge())}
      onCheck={() => void runUpdateAction("check")}
      onRetry={() =>
        void runUpdateAction(
          state.latestVersion && state.latestVersion !== state.currentVersion ? "download" : "check"
        )
      }
      onReload={() => getUpdateBridge()?.reload()}
      onClose={() => PopupModal.hide()}
    />
  );
}

/** The manual entry is only on the settings overview, where no draft is being edited. */
export function openUpdatesPanel(): void {
  refreshState();
  if (PopupModal.querySelector(`.slmodal-${MODAL_ID}`) && PopupModal.isConnected) return;
  notices.markPresented($updateState.get());
  pendingNotice = undefined;
  waitingForModal?.disconnect();
  waitingForModal = undefined;

  const container = document.createElement("div");
  container.className = "sl-sp-panel";
  const root = createRoot(container);
  flushSync(() => root.render(<ConnectedUpdatePanel />));
  PopupModal.display({
    title: "版本与更新",
    content: container,
    modalId: MODAL_ID,
    onClose: () => root.unmount(),
  });
  // The dialog we waited for restores its trigger's focus in a later task.
  // Keep keyboard focus inside this new dialog after that restoration runs.
  window.setTimeout(() => {
    if (container.isConnected && !PopupModal.contains(document.activeElement)) {
      PopupModal.querySelector<HTMLElement>(`.slmodal-${MODAL_ID}`)?.focus();
    }
  }, 0);
}

function presentPendingUpdate(): void {
  if (!pendingNotice) return;
  // Wait for settings (including unsaved credential drafts) and other dialogs.
  if (document.querySelector('sl-generic-modal, [role="dialog"][aria-modal="true"]')) return;
  const state = $updateState.get();
  if (updateNoticeKey(state) !== pendingNotice || !notices.shouldPresent(state)) {
    pendingNotice = undefined;
    waitingForModal?.disconnect();
    waitingForModal = undefined;
    return;
  }
  openUpdatesPanel();
}

function receiveState(state: UpdateState): void {
  $updateState.set(state);
  if (!notices.shouldPresent(state)) {
    pendingNotice = undefined;
    waitingForModal?.disconnect();
    waitingForModal = undefined;
    return;
  }
  if (PopupModal.isConnected && PopupModal.querySelector(`.slmodal-${MODAL_ID}`)) {
    notices.markPresented(state);
    return;
  }
  pendingNotice = updateNoticeKey(state);
  presentPendingUpdate();
  if (pendingNotice && !waitingForModal) {
    waitingForModal = new MutationObserver(presentPendingUpdate);
    waitingForModal.observe(document.body, { childList: true, subtree: true });
  }
}

/** Called once after the extension is ready; the loader owns all network work. */
export function initializeUpdates(): void {
  if (initialized) return;
  const bridge = getUpdateBridge();
  if (!bridge) return;
  initialized = true;
  setUpdatePanelOpener(openUpdatesPanel);
  bridge.subscribe(receiveState);
  receiveState(bridge.getState());
  void runUpdateAction("check");
  window.setInterval(() => void runUpdateAction("check"), CHECK_INTERVAL_MS);
}
