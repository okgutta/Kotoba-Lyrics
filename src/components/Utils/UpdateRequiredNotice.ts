import { $updateState, requestUpdatePanel } from "../../updater/runtimeState.ts";

/** A local lyrics-page gate; never covers Spotify's navigation or playback controls. */
export function createUpdateRequiredNotice(onLeave: () => void): HTMLElement {
  const page = document.createElement("div");
  page.id = "SpicyLyricsPage";
  page.className = "SpicyRenderer sl-update-required-page";
  const content = document.createElement("section");
  content.className = "sl-update-panel";
  const title = document.createElement("h2");
  title.className = "sl-update-status-title";
  title.textContent = "更新后继续使用歌词";
  const description = document.createElement("p");
  description.className = "sl-update-description";
  description.textContent =
    $updateState.get().updateReason || "当前版本已不再受支持。请更新扩展，Spotify 播放不受影响。";
  const actions = document.createElement("div");
  actions.className = "sl-update-actions";
  const leave = document.createElement("button");
  leave.type = "button";
  leave.className = "sl-update-button sl-update-button--quiet";
  leave.textContent = "返回 Spotify";
  leave.onclick = onLeave;
  const update = document.createElement("button");
  update.type = "button";
  update.className = "sl-update-button sl-update-button--primary";
  update.textContent = "查看更新";
  update.onclick = requestUpdatePanel;
  actions.append(leave, update);
  content.append(title, description, actions);
  page.append(content);
  return page;
}
