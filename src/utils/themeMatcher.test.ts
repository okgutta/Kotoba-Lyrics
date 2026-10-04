/// <reference types="node" />
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";
import { resolve } from "node:path";
import type * as Esbuild from "esbuild";
import type * as ThemeMatcher from "./themeMatcher.ts";

const { build } = createRequire(import.meta.url)("esbuild") as typeof Esbuild;
const bundle = await build({
  entryPoints: [resolve("src/utils/themeMatcher.ts")],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "themeModule",
});

function fixture(
  options: {
    native?: boolean;
    positioned?: boolean;
    stacked?: boolean;
    rtl?: boolean;
    dribbblish?: boolean;
    late?: boolean;
  } = {}
) {
  const classes = new Set<string>();
  const timers = new Map<number, () => void>();
  const observers: Array<{ callback: () => void; active: boolean }> = [];
  let timerId = 0;
  const root = { parentElement: {} };
  const makeBar = (native = options.native) => {
    let nativeLayout = native;
    const label = {
      position: "relative",
      getBoundingClientRect: () => ({
        top: options.stacked ? 30 : 0,
        bottom: options.stacked ? 40 : 10,
        right: options.rtl ? 300 : 40,
      }),
    };
    const bar = {
      position: options.positioned ? "absolute" : "relative",
      parentElement: root,
      closest: () => root,
      setNative: (value: boolean) => {
        nativeLayout = value;
      },
      getBoundingClientRect: () => ({ width: 400 }),
      querySelector(selector: string): unknown {
        if (selector.includes("playback-position") && !selector.includes("+ div")) return label;
        if (selector === ".playback-progressbar") return nativeLayout ? null : progress;
        if (selector === ":scope > .playback-progressbar-container" || selector.includes("+ div"))
          return wrapper;
        return null;
      },
    };
    const wrapper = {
      parentElement: bar,
      getBoundingClientRect: () => ({ top: 0, bottom: 10, left: 48 }),
    };
    const progress = { parentElement: wrapper };
    return bar;
  };
  let currentBar: ReturnType<typeof makeBar> | null = options.late ? null : makeBar();
  const document = {
    body: {
      classList: {
        add: (name: string) => classes.add(name),
        remove: (name: string) => classes.delete(name),
        toggle: (name: string, enabled: boolean) =>
          enabled ? classes.add(name) : classes.delete(name),
      },
    },
    querySelector(selector: string) {
      if (selector.includes("dribbblish")) return options.dribbblish ? {} : null;
      if (selector.includes(".playback-bar")) return currentBar;
      return null;
    },
  };
  const context = createContext({
    document,
    getComputedStyle: (element: { position: string }) => ({ position: element.position }),
    MutationObserver: class {
      entry: (typeof observers)[number];
      constructor(callback: () => void) {
        this.entry = { callback, active: true };
        observers.push(this.entry);
      }
      observe() {}
      disconnect() {
        this.entry.active = false;
      }
    },
    setTimeout(callback: () => void) {
      timers.set(++timerId, callback);
      return timerId;
    },
    clearTimeout(id: number) {
      timers.delete(id);
    },
  });
  runInContext(bundle.outputFiles[0].text, context);
  const api = context.themeModule as typeof ThemeMatcher;
  const page = { ownerDocument: document, isConnected: true };
  return {
    api,
    page,
    timers,
    observers,
    enabled: () => classes.has("SpicyLyrics_StockPlaybar"),
    open: () => api.setStockPlaybarPage(page as unknown as HTMLElement),
    replaceBar(native: boolean) {
      currentBar = makeBar(native);
    },
    replaceProgress(native: boolean) {
      currentBar?.setNative(native);
    },
    tick() {
      const pending = [...timers.values()];
      timers.clear();
      pending.forEach((callback) => callback());
    },
  };
}

const legacy = fixture();
legacy.open();
assert.equal(legacy.enabled(), true, "Stock legacy layout receives the elapsed-time workaround");
for (const options of [
  { native: true },
  { positioned: true },
  { stacked: true },
  { rtl: true },
  { dribbblish: true },
]) {
  const test = fixture(options);
  test.open();
  assert.equal(test.enabled(), false, `Preserve native/theme layout: ${JSON.stringify(options)}`);
}
legacy.replaceBar(true);
legacy.observers.findLast((observer) => observer.active)!.callback();
assert.equal(
  legacy.enabled(),
  false,
  "Replacing the legacy bar with the native layout removes the workaround"
);
legacy.api.setStockPlaybarPage(null);
assert.equal(
  legacy.observers.some((observer) => observer.active),
  false
);

const wrapper = fixture({ native: true });
wrapper.open();
wrapper.replaceProgress(false);
wrapper.observers.findLast((observer) => observer.active)!.callback();
assert.equal(
  wrapper.enabled(),
  true,
  "A legacy progress element mounted after its label enables the workaround"
);
wrapper.replaceProgress(true);
wrapper.observers.findLast((observer) => observer.active)!.callback();
assert.equal(
  wrapper.enabled(),
  false,
  "A native progress replacement preserves its layout even when bar and label stay mounted"
);

const late = fixture({ late: true });
late.open();
assert.equal(late.timers.size, 1);
late.replaceBar(false);
late.tick();
assert.equal(late.enabled(), true, "A delayed playbar is measured after mounting");
late.page.isConnected = false;
late.api.syncStockPlaybarClass();
assert.equal(late.enabled(), false);
assert.equal(late.timers.size, 0);

const popup = fixture();
popup.api.setStockPlaybarPage({ ownerDocument: {}, isConnected: true } as HTMLElement);
assert.equal(popup.enabled(), false, "Popup lyrics do not alter the main window's playbar");
assert.equal(popup.timers.size, 0);
console.log(
  "themeMatcher: legacy timing, native/theme layouts, delayed/replaced bars and page cleanup verified"
);
