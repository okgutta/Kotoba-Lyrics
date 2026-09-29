/// <reference types="node" />
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";
import { resolve } from "node:path";
import type * as Esbuild from "esbuild";
import type { UpdateState } from "../updater/contracts.ts";
const { build } = createRequire(import.meta.url)("esbuild") as typeof Esbuild;
const bundle = await build({
  stdin: {
    resolveDir: resolve("."),
    contents:
      'export * from "./src/utils/updates.tsx"; export { retainUpdatePanel } from "./src/updater/runtimeState.ts";',
  },
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  globalName: "updates",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "update-settings-host",
      setup(builder) {
        builder.onResolve({ filter: /^sonner$/ }, (args) => ({
          path: args.path,
          namespace: "fixture",
        }));
        builder.onResolve({ filter: /[/](settings[.]ts|notify[.]ts)$|[.]css$/ }, (args) => ({
          path: args.path.split("/").pop()!,
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
          const modules: Record<string, string> = {
            sonner:
              "export const toast = (message, options) => globalThis.host.toast(message, options); toast.dismiss = id => globalThis.host.dismissToast(id);",
            "settings.ts":
              "export const openSettingsUpdates = () => globalThis.host.settings.open();",
            "notify.ts": 'export const LYRIVA_TOASTER_ID = "lyriva-notifications";',
          };
          if (path.endsWith(".css")) return { contents: "", loader: "js" };
          assert.ok(modules[path], "Unexpected fixture dependency: " + path);
          return { contents: modules[path], loader: "js" };
        });
      },
    },
  ],
});
type ToastOptions = { id: string; toasterId: string; action?: { onClick: () => void } };
function session(saved = new Map<string, string>()) {
  let state: UpdateState = { phase: "idle", currentVersion: "1.0.0" };
  let receive: ((state: UpdateState) => void) | undefined;
  let retain: () => () => void = () => () => {};
  let release: (() => void) | undefined;
  const observers = new Set<() => void>();
  const activeToasts = new Map<string, ToastOptions>();
  const host = {
    dialogs: false,
    displays: 0,
    checks: 0,
    toasts: [] as Array<{ message: string; options: ToastOptions }>,
    toast(message: string, options: ToastOptions) {
      this.toasts.push({ message, options });
      activeToasts.set(options.id, options);
    },
    dismissToast(id: string) {
      activeToasts.delete(id);
    },
    settings: {
      isOpen: false,
      open() {
        host.displays++;
        this.isOpen = true;
        release = retain();
      },
      hide() {
        this.isOpen = false;
        release?.();
        release = undefined;
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
    },
    document: { body: {}, querySelector: () => (host.dialogs || host.settings.isOpen ? {} : null) },
    MutationObserver: class {
      callback: () => void;
      constructor(callback: () => void) {
        this.callback = callback;
      }
      observe() {
        observers.add(this.callback);
      }
      disconnect() {
        observers.delete(this.callback);
      }
    },
  });
  runInContext(bundle.outputFiles[0].text, context);
  const api = context.updates as {
    initializeUpdates(): void;
    openUpdatesPanel(): void;
    retainUpdatePanel(): () => void;
  };
  retain = api.retainUpdatePanel;
  api.initializeUpdates();
  api.initializeUpdates();
  assert.equal(host.checks, 1);
  return {
    host,
    api,
    saved,
    activeToasts,
    emit(next: UpdateState) {
      state = next;
      receive?.(state);
    },
    mutate() {
      const callbacks = [...observers];
      for (const callback of callbacks) callback();
    },
    details() {
      activeToasts.get("lyriva-update-ready")!.action!.onClick();
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
assert.equal(test.host.toasts.length, 0);
test.host.dialogs = true;
test.emit({ ...pending, phase: "ready" });
assert.equal(test.host.toasts.length, 0, "Do not cover an unsaved settings page");
test.emit({ ...pending, phase: "error" });
test.host.dialogs = false;
test.mutate();
assert.equal(test.host.toasts.length, 0, "Cancel a stale ready notice");
test.host.dialogs = true;
test.emit({ ...pending, phase: "ready" });
test.host.dialogs = false;
test.mutate();
assert.equal(test.host.displays, 0, "Use a quiet notification for ordinary updates");
assert.equal(test.host.toasts[0].message, "Kotoba Lyrics 新版本已就绪");
assert.equal(
  test.host.toasts[0].options.toasterId,
  "lyriva-notifications",
  "Keep the isolated toaster ID for compatibility"
);
test.host.dialogs = true;
test.details();
assert.equal(test.host.displays, 0);
test.host.dialogs = false;
test.mutate();
assert.equal(test.host.displays, 1, "Open the settings update detail");
test.api.openUpdatesPanel();
assert.equal(test.host.displays, 1, "Do not duplicate the settings window");
test.emit({ ...pending, latestVersion: "2.1.0", phase: "ready" });
assert.equal(
  test.host.toasts.length,
  1,
  "An already-visible update page receives state without extra notifications"
);
test.host.settings.hide();
const reboot = session(test.saved);
reboot.emit({ ...pending, phase: "ready" });
assert.equal(reboot.host.toasts.length, 0, "Remember the shown version across restarts");
reboot.api.openUpdatesPanel();
assert.equal(reboot.host.displays, 1);
reboot.host.settings.hide();
reboot.emit({ ...pending, updateRequired: true, minimumSupportedVersion: "2.0.0" });
assert.equal(reboot.host.displays, 2, "A mandatory policy opens the same settings detail page");
reboot.host.settings.hide();
assert.equal(reboot.host.toasts.length, 0, "Closing settings does not add another warning popup");
console.log(
  "Kotoba update settings navigation, draft preservation and reminder persistence verified"
);
