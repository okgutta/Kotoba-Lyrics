/// <reference types="node" />
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import type * as Esbuild from "esbuild";
import type * as PopupModule from "./PopupLyrics.ts";

const { build } = createRequire(import.meta.url)("esbuild") as typeof Esbuild;
const bundle = await build({
  entryPoints: [resolve("src/components/Utils/PopupLyrics.ts")],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "popupModule",
  plugins: [
    {
      name: "popup-host-fixture",
      setup(builder) {
        builder.onResolve({ filter: /^\./ }, (args) => ({
          path: args.path.split("/").pop()!,
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
          const modules: Record<string, string> = {
            "Session.ts": "export default { GoBack() {} };",
            "runtimeState.ts":
              "export const $updateRequired = { get: () => false }, requestUpdatePanel = () => {};",
            "PageView.ts": `export let PageContainer;
          export default {
            get IsOpened() { return f.opened; },
            async Open(wrapper) {
              if (f.refuseOpen) return;
              f.opened = true;
              PageContainer = f.node;
              wrapper.child = PageContainer;
            },
            async Destroy() { f.opened = false; }
          };`,
            "Fullscreen.ts":
              "export default { IsOpen: false, Open() { f.fullscreenOpens++; }, async Close() {} };",
            "NPVLyrics.ts":
              "export const NPVCardOwnsPage = () => false, DeRenderNPVCard = async () => {}, RequestNPVCardEvaluate = () => {};",
          };
          assert.ok(modules[path], `Unknown PopupLyrics dependency ${path}`);
          return { contents: `const f = globalThis.fixture; ${modules[path]}`, loader: "js" };
        });
      },
    },
  ],
});

function setup(options: { refuse?: boolean; race?: boolean; closed?: boolean } = {}) {
  const handlers = new Map<string, () => void>();
  const timers = new Map<number, () => void>();
  let timerId = 0;
  let styleFetch: (() => void) | undefined;
  let markStyleFetchStarted: () => void;
  const styleFetchStarted = new Promise<void>((done) => {
    markStyleFetchStarted = done;
  });
  const wrapper = { child: null as unknown, contains: (node: unknown) => wrapper.child === node };
  const sizes: Array<[number, number]> = [];
  const fixture = { opened: false, refuseOpen: !!options.refuse, node: {}, fullscreenOpens: 0 };
  const pipWindow = {
    closed: !!options.closed,
    innerWidth: 240,
    innerHeight: 130,
    outerWidth: 260,
    outerHeight: 160,
    document: {
      head: { appendChild() {} },
      body: { innerHTML: "", querySelector: () => wrapper },
    },
    resizeTo(width: number, height: number) {
      sizes.push([width, height]);
    },
    close() {
      this.closed = true;
    },
    addEventListener: (name: string, callback: () => void) => handlers.set(name, callback),
    removeEventListener: (name: string) => handlers.delete(name),
  };
  const context = createContext({
    fixture,
    console,
    window: { location: { reload() {} } },
    documentPictureInPicture: { requestWindow: async () => pipWindow },
    document: {
      querySelectorAll: () => [],
      querySelector: () =>
        options.race
          ? { tagName: "LINK", getAttribute: () => "https://example.invalid/styles.css" }
          : null,
      getElementById: () => null,
      createElement: () => ({ textContent: "" }),
    },
    fetch: () =>
      new Promise((done) => {
        styleFetch = () => done({ ok: true, text: async () => "#SpicyLyricsPage {}" });
        markStyleFetchStarted();
      }),
    setTimeout: (callback: () => void) => {
      timers.set(++timerId, callback);
      return timerId;
    },
    clearTimeout: (id: number) => timers.delete(id),
  });
  runInContext(bundle.outputFiles[0].text, context);
  return {
    api: context.popupModule as typeof PopupModule,
    fixture,
    pipWindow,
    handlers,
    timers,
    sizes,
    styleFetchStarted,
    finishStyleFetch: () => {
      assert.ok(styleFetch);
      styleFetch();
    },
    flushTimers: () => {
      for (const [id, callback] of Array.from(timers)) {
        timers.delete(id);
        callback();
      }
    },
  };
}

{
  const f = setup();
  await f.api.OpenPopupLyrics();
  assert.equal(f.fixture.fullscreenOpens, 1);
  assert.equal(f.api.IsPIP, true);
  assert.deepEqual(
    f.sizes,
    [[280, 210]],
    "Minimum viewport size must account for native window chrome"
  );
  f.pipWindow.innerWidth = 300;
  f.pipWindow.innerHeight = 200;
  f.handlers.get("resize")!();
  f.flushTimers();
  assert.equal(f.sizes.length, 1, "A large enough viewport must not be resized");
  f.pipWindow.innerWidth = 200;
  f.handlers.get("resize")!();
  f.handlers.get("resize")!();
  assert.equal(f.timers.size, 1, "Native resize gestures are debounced");
  f.flushTimers();
  assert.deepEqual(f.sizes.at(-1), [320, 160], "Only the deficient dimension grows");
  f.handlers.get("resize")!();
  await f.api.ClosePopupLyrics();
  assert.equal(f.timers.size, 0);
  assert.equal(f.handlers.has("resize"), false);
  assert.equal(f.handlers.has("pagehide"), false);
  assert.equal(f.api.IsPIP, false);
  assert.equal(f.pipWindow.closed, true);
}

{
  const f = setup({ refuse: true });
  await f.api.OpenPopupLyrics();
  assert.equal(f.api.IsPIP, false, "A refused page open must not leave PiP active");
  assert.equal(f.pipWindow.closed, true);
  assert.equal(f.fixture.fullscreenOpens, 0);
}

{
  const f = setup({ race: true });
  const opening = f.api.OpenPopupLyrics();
  await f.styleFetchStarted;
  f.fixture.opened = true;
  f.finishStyleFetch();
  await opening;
  assert.equal(f.api.IsPIP, false, "A main page opened during style loading keeps ownership");
  assert.equal(f.pipWindow.closed, true);
  assert.equal(f.fixture.fullscreenOpens, 0);
}

{
  const f = setup({ closed: true });
  await f.api.OpenPopupLyrics();
  assert.equal(f.api.IsPIP, false);
  assert.equal(f.sizes.length, 0, "A popup closed during setup must not be resized");
}

console.log("PopupLyrics minimum-size, resize cleanup and page-ownership regression tests passed.");
