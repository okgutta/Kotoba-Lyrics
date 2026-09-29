/// <reference types="node" />
import assert from "node:assert/strict";
import { createUpdateNotices } from "./notifications.ts";
import type { UpdateState } from "./contracts.ts";

const saved = new Map<string, string>();
const storage = {
  getItem: (key: string) => saved.get(key) ?? null,
  setItem: (key: string, value: string) => {
    saved.set(key, value);
  },
};
const notices = createUpdateNotices(() => storage);
const state: UpdateState = { phase: "available", currentVersion: "1.0.0", latestVersion: "1.1.0" };
for (const phase of ["idle", "available", "checking", "downloading", "error"] as const) {
  assert.equal(
    notices.shouldPresent({ ...state, phase }),
    false,
    `Do not interrupt during ${phase}`
  );
}
notices.markPresented(state);
const ready = { ...state, phase: "ready" as const };
assert.equal(
  notices.shouldPresent(ready),
  true,
  "Viewing a download must not consume the ready notice"
);
notices.markPresented(ready);
assert.equal(notices.shouldPresent(ready), false);
assert.equal(createUpdateNotices(() => storage).shouldPresent(ready), false, "Survives a restart");
assert.equal(notices.shouldPresent({ ...ready, latestVersion: "1.2.0" }), true);
assert.equal(notices.shouldPresent({ ...ready, currentVersion: ready.latestVersion! }), false);
const required = { ...state, updateRequired: true, minimumSupportedVersion: "1.1.0" };
assert.equal(
  notices.shouldPresent(required),
  true,
  "Mandatory policy is actionable before download"
);
notices.markPresented(required);
assert.equal(
  notices.shouldPresent({ ...required, phase: "ready" }),
  false,
  "Do not prompt twice for the same mandatory update"
);
assert.equal(notices.shouldPresent({ ...required, phase: "error" }), false);
assert.equal(
  notices.shouldPresent({ ...state, loaderUpdateRequired: true }),
  true,
  "Old loaders get a manual migration notice"
);
const unavailable = createUpdateNotices(() => {
  throw new Error("disabled");
});
assert.equal(unavailable.shouldPresent(ready), true);
unavailable.markPresented(ready);
assert.equal(
  unavailable.shouldPresent(ready),
  false,
  "Keep session deduplication if storage fails"
);
const malformed = createUpdateNotices(() => ({ ...storage, getItem: () => "{broken" }));
assert.equal(malformed.shouldPresent(ready), true);
console.log("Update notification tests passed");
