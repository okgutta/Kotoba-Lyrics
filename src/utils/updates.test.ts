/// <reference types="node" />
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";
import { resolve } from "node:path";
import type * as Esbuild from "esbuild";
import type { UpdateState } from "../updater/contracts.ts";

const { build } = createRequire(import.meta.url)("esbuild") as typeof Esbuild;
const bundle = await build({
  entryPoints: [resolve("src/utils/updates.tsx")],
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  globalName: "updates",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "update-ui-host",
      setup(builder) {
        builder.onResolve({ filter: /^(react-dom([/]client)?|@nanostores[/]react)$/ }, (args) => ({
          path: args.path,
          namespace: "fixture",
        }));
        builder.onResolve({ filter: /[/](Modal[.]ts|UpdatePanel[.]tsx)$|[.]css$/ }, (args) => ({
          path: args.path.split("/").pop()!,
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
          const modules: Record<string, string> = {
            "react-dom": "export const flushSync = f => f();",
            "react-dom/client": "export const createRoot = () => ({ render() {}, unmount() {} });",
            "@nanostores/react": "export const useStore = s => s.get();",
            "Modal.ts": "export const PopupModal = globalThis.host.popup;",
            "UpdatePanel.tsx": "export default function UpdatePanel() {}",
          };
          if (path.endsWith(".css")) return { contents: "", loader: "js" };
          assert.ok(modules[path], `Unexpected fixture dependency: ${path}`);
          return { contents: modules[path], loader: "js" };
        });
      },
    },
  ],
});

function session(saved = new Map<string, string>()) {
  let state: UpdateState = { phase: "idle", currentVersion: "1.0.0" };
  let receive: ((state: UpdateState) => void) | undefined;
  let observe: (() => void) | undefined;
  let closing: (() => void) | undefined;
  const host = {
    dialogs: false,
    displays: 0,
    checks: 0,
    popup: {
      isConnected: false,
      querySelector() {
        return this.isConnected ? { focus() {} } : null;
      },
      contains() {
        return false;
      },
      display(options: { content: { isConnected: boolean }; onClose: () => void }) {
        host.displays++;
        this.isConnected = true;
        options.content.isConnected = true;
        closing = options.onClose;
      },
      hide() {
        this.isConnected = false;
        closing?.();
      },
    },
  };
  const context = createContext({
    host,
    console,
    setTimeout,
    clearTimeout,
    window: {
      localStorage: {
        getItem: (key: string) => saved.get(key) ?? null,
        setItem: (key: string, value: string) => saved.set(key, value),
      },
      __LYRIVA_UPDATER__: {
        getState: () => ({ ...state }),
        subscribe(listener: typeof receive) {
          receive = listener;
          return () => {};
        },
        async check() {
          host.checks++;
        },
      },
      setInterval() {},
      setTimeout(callback: () => void) {
        callback();
      },
    },
    document: {
      body: {},
      activeElement: null,
      createElement: () => ({ className: "", isConnected: false }),
      querySelector: () => (host.dialogs || host.popup.isConnected ? {} : null),
    },
    MutationObserver: class {
      constructor(callback: () => void) {
        observe = callback;
      }
      observe() {}
      disconnect() {
        observe = undefined;
      }
    },
  });
  runInContext(bundle.outputFiles[0].text, context);
  const api = context.updates as { initializeUpdates(): void; openUpdatesPanel(): void };
  api.initializeUpdates();
  api.initializeUpdates();
  assert.equal(host.checks, 1, "Initialize and subscribe only once");
  return {
    host,
    api,
    saved,
    mutate: () => observe?.(),
    emit(next: UpdateState) {
      state = next;
      receive?.(state);
    },
  };
}
const test = session();
const pending: UpdateState = {
  phase: "available",
  currentVersion: "1.0.0",
  latestVersion: "2.0.0",
};
test.emit(pending);
test.emit({ ...pending, phase: "downloading", progress: 80 });
assert.equal(test.host.displays, 0);
test.host.dialogs = true;
test.emit({ ...pending, phase: "ready" });
assert.equal(test.host.displays, 0, "Never replace an unsaved settings dialog");
test.emit({ ...pending, phase: "error" });
test.host.dialogs = false;
test.mutate();
assert.equal(
  test.host.displays,
  0,
  "A queued ready prompt is cancelled when the state stops being ready"
);
test.host.dialogs = true;
test.emit({ ...pending, phase: "ready" });
test.host.dialogs = false;
test.mutate();
assert.equal(test.host.displays, 1);
test.host.popup.hide();
test.emit({ ...pending, phase: "ready" });
assert.equal(test.host.displays, 1);
const reboot = session(test.saved);
reboot.emit({ ...pending, phase: "ready" });
assert.equal(reboot.host.displays, 0);
reboot.api.openUpdatesPanel();
assert.equal(reboot.host.displays, 1, "Manual entry remains available after dismissing");
reboot.host.popup.hide();
reboot.emit({ ...pending, updateRequired: true, minimumSupportedVersion: "2.0.0" });
assert.equal(
  reboot.host.displays,
  2,
  "A new mandatory policy is not suppressed by a normal reminder"
);
console.log("Update dialog deferral, persistence and manual entry tests passed");
