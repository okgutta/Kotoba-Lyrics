/// <reference types="node" />
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import UpdatePanel from "./UpdatePanel.tsx";
import type { UpdateState } from "../../updater/contracts.ts";

function render(state: UpdateState) {
  return renderToStaticMarkup(
    createElement(UpdatePanel, {
      state,
      automaticUpdates: true,
      onCheck() {},
      onRetry() {},
      onReload() {},
      onClose() {},
    })
  );
}
const ready: UpdateState = { phase: "ready", currentVersion: "1.0.0", latestVersion: "2.0.0" };
assert.match(render(ready), /下次启动生效/);
assert.match(render(ready), /立即重新加载/);
const required = {
  ...ready,
  minimumSupportedVersion: "2.0.0",
  updateRequired: true,
  updateReason: "旧接口已停用<script>",
};
for (const phase of ["idle", "available", "checking", "downloading", "ready", "error"] as const) {
  const html = render({ ...required, phase });
  assert.match(html, /更新后继续使用歌词/);
  assert.match(html, /暂时停用歌词/);
  assert.doesNotMatch(html, /下次启动生效|后台下载|<script>/);
  assert.match(html, /旧接口已停用&lt;script&gt;/);
}
assert.match(render({ ...required, phase: "error", error: "下载失败" }), /下载失败/);
assert.match(
  render({ ...ready, phase: "available", loaderUpdateRequired: true }),
  /需要手动更新加载器/
);
assert.match(render({ ...ready, phase: "available", loaderUpdateRequired: true }), /下载新版/);
console.log("Update panel tests passed");
