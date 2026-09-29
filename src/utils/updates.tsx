import { toast } from "sonner";
import { ProjectName, ProjectVersion } from "../../project/config.ts";
import { LYRIVA_TOASTER_ID } from "./notify.ts";
import { openSettingsUpdates } from "./settings.ts";
import { getUpdateBridge, runUpdateAction } from "../updater/actions.ts";
import type { UpdateState } from "../updater/contracts.ts";
import { createUpdateNotices, updateNoticeKey } from "../updater/notifications.ts";
import { $updateState, $updatePanelOpen, setUpdatePanelOpener } from "../updater/runtimeState.ts";
import "../css/update-panel.css";

export { $updateState, getUpdateBridge };
const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const UPDATE_TOAST_ID = "lyriva-update-ready";
const DIALOG_SELECTOR = 'sl-generic-modal, [role="dialog"][aria-modal="true"]';
const notices = createUpdateNotices(() => window.localStorage);
let initialized = false;
let pendingNotice: string | undefined;
let waitingForModal: MutationObserver | undefined;
let waitingForDetails: MutationObserver | undefined;
let toastVersion: string | undefined;
function clearUpdateToast(): void {
  toastVersion = undefined;
  toast.dismiss(UPDATE_TOAST_ID);
}
function acknowledgeUpdatePanel(): void {
  notices.markPresented($updateState.get());
  pendingNotice = undefined;
  waitingForModal?.disconnect();
  waitingForModal = undefined;
  waitingForDetails?.disconnect();
  waitingForDetails = undefined;
  clearUpdateToast();
}
/** Use the same window and detail page as Settings > Advanced > Version & updates. */
export function openUpdatesPanel(): void {
  const bridge = getUpdateBridge();
  $updateState.set(bridge?.getState() ?? { phase: "idle", currentVersion: ProjectVersion });
  if ($updatePanelOpen.get()) return;
  acknowledgeUpdatePanel();
  openSettingsUpdates();
}
function requestUpdateDetails(): void {
  if ($updatePanelOpen.get()) return;
  waitingForDetails?.disconnect();
  const tryOpen = () => {
    if (document.querySelector(DIALOG_SELECTOR)) return false;
    waitingForDetails?.disconnect();
    waitingForDetails = undefined;
    openUpdatesPanel();
    return true;
  };
  if (!tryOpen()) {
    waitingForDetails = new MutationObserver(() => {
      tryOpen();
    });
    waitingForDetails.observe(document.body, { childList: true, subtree: true });
  }
}
function presentUpdateToast(state: UpdateState): void {
  clearUpdateToast();
  toastVersion = state.latestVersion;
  toast(ProjectName + (state.loaderUpdateRequired ? " 有新版本" : " 新版本已就绪"), {
    id: UPDATE_TOAST_ID,
    toasterId: LYRIVA_TOASTER_ID,
    position: "bottom-right",
    duration: Infinity,
    closeButton: true,
    description: "v" + state.currentVersion + " → v" + state.latestVersion,
    action: { label: "查看详情", onClick: requestUpdateDetails },
  });
  notices.markPresented(state);
}
function presentPendingUpdate(): void {
  if (!pendingNotice || document.querySelector(DIALOG_SELECTOR)) return;
  const state = $updateState.get();
  if (updateNoticeKey(state) !== pendingNotice || !notices.shouldPresent(state)) {
    pendingNotice = undefined;
    waitingForModal?.disconnect();
    waitingForModal = undefined;
    return;
  }
  if (state.updateRequired) openUpdatesPanel();
  else {
    presentUpdateToast(state);
    pendingNotice = undefined;
    waitingForModal?.disconnect();
    waitingForModal = undefined;
  }
}
function receiveState(state: UpdateState): void {
  $updateState.set(state);
  if (
    toastVersion &&
    (toastVersion !== state.latestVersion || state.updateRequired || !updateNoticeKey(state))
  )
    clearUpdateToast();
  if ($updatePanelOpen.get()) {
    acknowledgeUpdatePanel();
    return;
  }
  if (!notices.shouldPresent(state)) {
    pendingNotice = undefined;
    waitingForModal?.disconnect();
    waitingForModal = undefined;
    return;
  }
  pendingNotice = updateNoticeKey(state);
  presentPendingUpdate();
  if (pendingNotice && !waitingForModal) {
    waitingForModal = new MutationObserver(presentPendingUpdate);
    waitingForModal.observe(document.body, { childList: true, subtree: true });
  }
}
export function initializeUpdates(): void {
  if (initialized) return;
  const bridge = getUpdateBridge();
  if (!bridge) return;
  initialized = true;
  setUpdatePanelOpener(openUpdatesPanel);
  $updatePanelOpen.listen((open) => {
    if (open) acknowledgeUpdatePanel();
  });
  bridge.subscribe(receiveState);
  receiveState(bridge.getState());
  void runUpdateAction("check");
  window.setInterval(() => void runUpdateAction("check"), CHECK_INTERVAL_MS);
}
