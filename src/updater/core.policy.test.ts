/// <reference types="node" />
import assert from "node:assert/strict";
import { startUpdater } from "./core.ts";
import { LATEST_RELEASE_URL, sha256 } from "./protocol.ts";
import type { StoredUpdates, UpdateStorage } from "./storage.ts";

class MemoryStorage implements UpdateStorage {
  value: StoredUpdates = {};
  async read() {
    return structuredClone(this.value);
  }
  async update(change: (state: StoredUpdates) => StoredUpdates) {
    this.value = structuredClone(change(this.value));
  }
}
const fallback = { fallbackCode: "embedded", fallbackVersion: "1.0.0", loaderVersion: 2 };
const code = "updated runtime";
const bytes = new TextEncoder().encode(code);
const root = "https://raw.githubusercontent.com/okgutta/Kotoba-Lyrics/main/versions/v2.1.0";
const manifest = {
  schema: 1,
  version: "2.1.0",
  loaderVersion: 2,
  minimumSupportedVersion: "2.0.0",
  updateReason: "旧歌词接口已停用",
  runtime: {
    url: `${root}/lyrivamusic-runtime.js`,
    size: bytes.length,
    sha256: await sha256(bytes),
  },
};
let offline = false;
let corrupt = false;
let ordinary = false;
let runtimeRequests = 0;
const request = (async (input: string | URL | Request) => {
  if (offline) throw new TypeError("offline");
  if (String(input) === LATEST_RELEASE_URL)
    return Response.json({ tag_name: "v2.1.0", draft: false, prerelease: false });
  if (String(input) === `${root}/manifest.json`)
    return Response.json({
      ...manifest,
      ...(ordinary ? { minimumSupportedVersion: undefined, updateReason: undefined } : {}),
    });
  assert.equal(String(input), manifest.runtime.url);
  runtimeRequests++;
  return new Response(corrupt ? "x".repeat(bytes.length) : code);
}) as typeof fetch;
const storage = new MemoryStorage();
let reloads = 0;
const bridge = await startUpdater(fallback, {
  host: {},
  storage,
  request,
  execute() {},
  reload() {
    reloads++;
  },
});
corrupt = true;
await bridge.check();
assert.equal(bridge.getState().phase, "error");
assert.equal(
  bridge.getState().updateRequired,
  true,
  "A failed download cannot re-enable an unsupported version"
);
assert.equal(storage.value.pending, undefined);
assert.equal(storage.value.policy?.minimumSupportedVersion, "2.0.0");
assert.equal(reloads, 0, "The updater must never restart Spotify without user action");

offline = true;
const offlineBridge = await startUpdater(fallback, {
  host: {},
  storage,
  request,
  execute() {},
  reload() {},
});
assert.equal(
  offlineBridge.getState().updateRequired,
  true,
  "Remember the restriction across offline restarts"
);
await offlineBridge.check();
assert.equal(offlineBridge.getState().updateRequired, true);
assert.equal(offlineBridge.getState().phase, "error");
offline = false;
corrupt = false;
await bridge.download();
assert.equal(bridge.getState().phase, "ready");
assert.equal(
  bridge.getState().updateRequired,
  true,
  "Download alone does not activate the new runtime"
);
let executed = "";
const upgraded = await startUpdater(fallback, {
  host: {},
  storage,
  request,
  execute(value) {
    executed = value;
  },
  reload() {},
});
assert.equal(executed, code);
assert.equal(upgraded.getState().currentVersion, "2.1.0");
assert.equal(
  upgraded.getState().updateRequired,
  false,
  "A supported runtime unblocks lyrics on startup"
);

// This runtime was never marked healthy; on the next boot it must be skipped.
const recovered = await startUpdater(fallback, {
  host: {},
  storage,
  request,
  execute(value) {
    executed = value;
  },
  reload() {},
});
assert.equal(executed, "embedded");
assert.equal(
  recovered.getState().updateRequired,
  true,
  "Rollback may not silently bypass a saved minimum"
);
assert.equal(storage.value.badVersion, "2.1.0");
const before = runtimeRequests;
await recovered.check();
await recovered.download();
assert.equal(recovered.getState().phase, "error");
assert.equal(recovered.getState().updateRequired, true);
assert.equal(runtimeRequests, before, "Retry must not redownload a known-broken runtime");

ordinary = true;
delete storage.value.badVersion;
const relaxed = await startUpdater(fallback, {
  host: {},
  storage,
  request,
  execute() {},
  reload() {},
});
await relaxed.check();
assert.equal(
  relaxed.getState().updateRequired,
  undefined,
  "A valid release may explicitly relax its policy"
);
assert.equal(storage.value.policy, undefined);
assert.equal(relaxed.getState().phase, "ready");

offline = true;
const normal = await startUpdater(fallback, {
  host: {},
  storage: new MemoryStorage(),
  request,
  execute() {},
  reload() {},
});
await normal.check();
assert.equal(normal.getState().phase, "error");
assert.equal(
  normal.getState().updateRequired,
  undefined,
  "Offline users with no known restriction keep using lyrics"
);
console.log("Mandatory update recovery and offline policy tests passed");
