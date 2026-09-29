/// <reference types="node" />
import assert from "node:assert/strict";
import type * as Esbuild from "esbuild";
import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";
import { resolve } from "node:path";
import type * as NPV from "./NPVLyrics.ts";

const { build } = createRequire(import.meta.url)("esbuild") as typeof Esbuild;

function store<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      if (value === next) return;
      value = next;
      for (const listener of listeners) listener();
    },
    listen(callback: () => void) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
}

class ElementFixture {
  isConnected = true;
  id = "";
  classes = new Set<string>();
  children = new Map<string, ElementFixture>();
  handlers = new Map<string, () => void>();
  classList = {
    add: (...names: string[]) => names.forEach((name) => this.classes.add(name)),
    remove: (...names: string[]) => names.forEach((name) => this.classes.delete(name)),
    contains: (name: string) => this.classes.has(name),
    toggle: (name: string, force: boolean) => {
      if (force) this.classes.add(name);
      else this.classes.delete(name);
    },
  };
  set innerHTML(value: string) {
    if (!value.includes("CardBody")) return;
    for (const name of [".CardBody", "#NPVCardExpand", "#NPVCardMaximize", "#NPVCardToggle"]) {
      this.children.set(name, new ElementFixture());
    }
  }
  querySelector(selector: string) {
    return this.children.get(selector) ?? null;
  }
  querySelectorAll() {
    return [...this.children.entries()].filter(([key]) => key.startsWith("#")).map(([, el]) => el);
  }
  closest() {
    return null;
  }
  contains(target: ElementFixture) {
    return target === this || [...this.children.values()].includes(target);
  }
  prepend(element: ElementFixture) {
    this.children.set("card", element);
  }
  remove() {
    this.isConnected = false;
  }
  addEventListener(name: string, callback: () => void) {
    this.handlers.set(name, callback);
  }
  click() {
    this.handlers.get("click")?.();
  }
  getBoundingClientRect(): never {
    throw new Error("Expanded transitions must not synchronously measure lyric layout");
  }
}

const bundle = await build({
  entryPoints: [resolve("src/components/Utils/NPVLyrics.ts")],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "npvModule",
  plugins: [
    {
      name: "npv-host-fixture",
      setup(builder) {
        builder.onResolve({ filter: /^\.\./ }, (args) => ({
          path: args.path.split("/").pop()!,
          namespace: "npv-fixture",
        }));
        builder.onResolve({ filter: /^\.\/(Fullscreen|PopupLyrics)\.ts$/ }, (args) => ({
          path: args.path.slice(2),
          namespace: "npv-fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "npv-fixture" }, ({ path }) => {
          const modules: Record<string, string> = {
            "PageView.ts": "export default fixture.page;",
            "runtimeState.ts": "export const { $updateRequired } = fixture.stores;",
            "Fullscreen.ts": "export default fixture.fullscreen;",
            "PopupLyrics.ts":
              "export const IsPIP = false, _IsPIP_after = false, IsPIPOpening = false;",
            "Session.ts": "export default { Navigate() {} };",
            "Global.ts": "export default { Event: { listen() {}, unListen() {} } };",
            "Icons.ts":
              "export const Icons = { Collapse: '', Uncollapse: '', Minimize: '', Maximize: '', CinemaView: '' };",
            "Maid.ts": "export const Maid = fixture.Maid;",
            "Whentil.ts": "export default { When(_condition, callback) { callback(); } };",
            "uiState.ts": "export const { $npvLyricsOpen, $npvLyricsExpanded } = fixture.stores;",
            "stores.ts":
              "export const { $currentLyricsData, $disableNpvLyrics, $hideNpvLyricsWhenUnavailable } = fixture.stores;",
            "SpotifyPlayer.ts":
              "export const SpotifyPlayer = { GetUri: () => 'spotify:track:fixture' };",
            "Logger.ts":
              "export default class { debug() {} warn() {} error(error) { throw error; } }",
          };
          assert.ok(modules[path], `Unknown NPV dependency ${path}`);
          return { contents: `const fixture = globalThis.fixture; ${modules[path]}`, loader: "js" };
        });
      },
    },
  ],
});

function createFixture(
  options: { nested?: boolean; reduced?: boolean; throws?: boolean; api?: boolean } = {}
) {
  const root = new ElementFixture();
  const body = new ElementFixture();
  const npv = new ElementFixture();
  const sidebar = new ElementFixture();
  const top = new ElementFixture();
  npv.children.set(".main-nowPlayingView-content", new ElementFixture());
  const timers = new Map<number, () => void>();
  let nextTimer = 0;
  const observers: Array<{ callback: (records: unknown[]) => void; target?: ElementFixture }> = [];
  const transitions: Array<{
    run: () => void;
    finish: () => void;
    fail: () => void;
    skipped: boolean;
  }> = [];
  const fixture = {
    stores: {
      $npvLyricsOpen: store(true),
      $updateRequired: store(false),
      $npvLyricsExpanded: store(false),
      $currentLyricsData: store(""),
      $disableNpvLyrics: store(false),
      $hideNpvLyricsWhenUnavailable: store(false),
    },
    fullscreen: { IsOpen: false, CinemaViewOpen: false },
    page: {
      IsOpened: false,
      opens: 0,
      destroys: 0,
      async Open() {
        this.IsOpened = true;
        this.opens++;
      },
      async Destroy() {
        this.IsOpened = false;
        this.destroys++;
      },
    },
    Maid: class {
      items = new Map<unknown, unknown>();
      Give(item: unknown, key: unknown = item) {
        this.items.set(key, item);
        return item;
      }
      CleanUp() {
        for (const item of this.items.values()) {
          if (typeof item === "function") item();
          else if (item instanceof ElementFixture) item.remove();
        }
        this.items.clear();
      }
    },
  };
  const context = createContext({
    fixture,
    Element: ElementFixture,
    window: { matchMedia: () => ({ matches: options.reduced ?? false }) },
    CSS: { supports: () => options.nested ?? true },
    document: {
      body,
      documentElement: root,
      createElement: () => new ElementFixture(),
      querySelector(selector: string) {
        if (selector === ".Root__right-sidebar aside.NowPlayingView") return npv;
        if (selector === ".Root__right-sidebar") return sidebar;
        if (selector === ".Root__top-container") return top;
        return null;
      },
      startViewTransition:
        options.api === false
          ? undefined
          : (run: () => void) => {
              if (options.throws) throw new Error("Capture unavailable");
              let finish!: () => void;
              let fail!: () => void;
              const finished = new Promise<void>((resolve, reject) => {
                finish = resolve;
                fail = () => reject(new Error("Cancelled"));
              });
              const transition = { run, finish, fail, skipped: false };
              transitions.push(transition);
              return {
                finished,
                ready: Promise.resolve(),
                skipTransition() {
                  transition.skipped = true;
                  // The browser still invokes the skipped transition's deferred update.
                  queueMicrotask(() => {
                    run();
                    finish();
                  });
                },
              };
            },
    },
    Spicetify: { Platform: { History: { location: { pathname: "/" } } }, Tippy: () => null },
    MutationObserver: class {
      entry: (typeof observers)[number];
      constructor(callback: (records: unknown[]) => void) {
        this.entry = { callback };
        observers.push(this.entry);
      }
      observe(target: ElementFixture) {
        this.entry.target = target;
      }
      disconnect() {}
    },
    setTimeout(callback: () => void) {
      timers.set(++nextTimer, callback);
      return nextTimer;
    },
    clearTimeout(id: number) {
      timers.delete(id);
    },
  });
  runInContext(bundle.outputFiles[0].text, context);
  const api = context.npvModule as typeof NPV;
  async function tick() {
    for (let i = 0; i < 8; i++) {
      const pending = [...timers.values()];
      timers.clear();
      pending.forEach((callback) => callback());
      await Promise.resolve();
    }
  }
  const card = () => api.GetNPVCardElement() as unknown as ElementFixture;
  return {
    api,
    fixture,
    root,
    body,
    transitions,
    tick,
    card,
    click: (name = "#NPVCardMaximize") => card().querySelector(name)!.click(),
    detach() {
      card().remove();
      observers.find((observer) => observer.target === sidebar)!.callback([{ target: npv }]);
    },
  };
}

async function start(options: Parameters<typeof createFixture>[0] = {}) {
  const test = createFixture(options);
  test.api.initNPVLyrics();
  await test.tick();
  assert.ok(test.card());
  return test;
}

const rapid = await start();
rapid.click();
rapid.click();
assert.equal(rapid.transitions[0].skipped, true);
assert.equal(
  rapid.fixture.stores.$npvLyricsExpanded.get(),
  true,
  "Second click flushes first toggle"
);
rapid.transitions[0].run();
rapid.transitions[1].run();
assert.equal(rapid.fixture.stores.$npvLyricsExpanded.get(), false, "Two clicks toggle twice");
rapid.transitions[1].finish();
await rapid.tick();
assert.equal(rapid.body.classes.has("SpicyLyrics_NPVCardExpanded"), false);
assert.equal(rapid.root.classes.size, 0);

const removed = await start();
removed.click();
const oldCard = removed.card();
removed.detach();
assert.equal(removed.root.classes.size, 0, "Detached card immediately releases snapshot names");
removed.transitions[0].run();
await removed.tick();
assert.notEqual(removed.card(), oldCard);
assert.equal(removed.fixture.stores.$npvLyricsExpanded.get(), false);
assert.equal(removed.body.classes.has("SpicyLyrics_NPVCardExpanded"), false);

const expanded = await start();
expanded.click();
expanded.transitions[0].run();
expanded.transitions[0].finish();
await expanded.tick();
assert.equal(expanded.body.classes.has("SpicyLyrics_NPVCardExpanded"), true);
expanded.click("#NPVCardToggle");
expanded.transitions[1].run();
expanded.transitions[1].finish();
await expanded.tick();
assert.equal(expanded.fixture.stores.$npvLyricsOpen.get(), false);
assert.equal(expanded.fixture.stores.$npvLyricsExpanded.get(), false);
assert.equal(expanded.fixture.page.IsOpened, false);

const teardown = await start();
teardown.click();
await teardown.api.DeRenderNPVCard();
teardown.transitions[0].run();
assert.equal(teardown.api.GetNPVCardElement(), null);
assert.equal(teardown.fixture.stores.$npvLyricsExpanded.get(), false);

for (const options of [{ nested: false }, { reduced: true }, { api: false }, { throws: true }]) {
  const fallback = await start(options);
  fallback.click();
  await fallback.tick();
  assert.equal(fallback.fixture.stores.$npvLyricsExpanded.get(), true);
  fallback.click();
  await fallback.tick();
  assert.equal(fallback.fixture.stores.$npvLyricsExpanded.get(), false);
  assert.equal(fallback.root.classes.size, 0);
}

const cancelled = await start();
cancelled.click();
cancelled.transitions[0].run();
cancelled.transitions[0].fail();
await cancelled.tick();
assert.equal(cancelled.root.classes.size, 0);
assert.equal(
  cancelled.fixture.page.IsOpened,
  true,
  "Rejected animation cannot wedge reconciliation"
);

const navigation = await start();
navigation.click();
navigation.fixture.fullscreen.IsOpen = true;
navigation.transitions[0].run();
navigation.transitions[0].finish();
await navigation.tick();
assert.equal(navigation.api.GetNPVCardElement(), null);
assert.equal(navigation.fixture.stores.$npvLyricsExpanded.get(), false);

const requiredUpdate = await start();
requiredUpdate.fixture.stores.$updateRequired.set(true);
await requiredUpdate.tick();
assert.equal(
  requiredUpdate.api.GetNPVCardElement(),
  null,
  "Mandatory update removes the lyrics card"
);
assert.equal(requiredUpdate.fixture.page.IsOpened, false);
requiredUpdate.fixture.stores.$updateRequired.set(false);
await requiredUpdate.tick();
assert.ok(requiredUpdate.api.GetNPVCardElement(), "A relaxed policy allows the card again");
console.log(
  "NPVLyrics: rapid toggles, detached cards, teardown, fallback and cancellation verified"
);
