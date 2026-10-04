/// <reference types="node" />
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import type * as Esbuild from "esbuild";
import type * as PageModule from "./PageView.ts";

const { build } = createRequire(import.meta.url)("esbuild") as typeof Esbuild;

function store(initial: unknown = false) {
  let value = initial;
  const listeners = new Set<(value: unknown) => void>();
  return {
    get: () => value,
    set(next: unknown) {
      if (value === next) return;
      value = next;
      for (const listener of listeners) listener(value);
    },
    listen(listener: (value: unknown) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// Only the page shell and actual control markup need DOM behavior in this test.
class ElementFixture {
  id = "";
  tagName = "DIV";
  parentElement: ElementFixture | null = null;
  disabled = false;
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  children: ElementFixture[] = [];
  classes = new Set<string>();
  handlers = new Map<string, Array<() => void>>();
  classList = {
    add: (...names: string[]) => names.forEach((name) => this.classes.add(name)),
    remove: (...names: string[]) => names.forEach((name) => this.classes.delete(name)),
    contains: (name: string) => this.classes.has(name),
    toggle: (name: string, force: boolean) => {
      if (force) this.classes.add(name);
      else this.classes.delete(name);
    },
  };
  set innerHTML(markup: string) {
    this.children = [];
    if (markup.includes('<div class="ContentBox">')) {
      const content = new ElementFixture();
      content.classes.add("ContentBox");
      const controls = new ElementFixture();
      controls.classes.add("ViewControls");
      content.children.push(controls);
      this.children.push(content);
    }
    for (const match of markup.matchAll(/<button\b([^>]*)>[\s\S]*?<\/button>/g)) {
      const button = new ElementFixture();
      for (const attr of match[1].matchAll(/([\w-]+)="([^"]*)"/g)) {
        button.setAttribute(attr[1], attr[2]);
      }
      button.id = button.attributes.get("id") ?? "";
      button.attributes
        .get("class")
        ?.split(/\s+/)
        .forEach((name) => button.classes.add(name));
      button.disabled = /\bdisabled\b/.test(match[1]);
      this.children.push(button);
    }
  }
  querySelector(selector: string): ElementFixture | null {
    const [first, ...rest] = selector.split(" ");
    for (const child of this.children) {
      const attribute = /^([a-z]+)?\[([\w-]+)\]$/i.exec(first);
      const matches = attribute
        ? (!attribute[1] || child.tagName.toLowerCase() === attribute[1].toLowerCase()) &&
          child.attributes.has(attribute[2])
        : first.startsWith("#")
          ? child.id === first.slice(1)
          : first.startsWith(".")
            ? child.classes.has(first.slice(1))
            : child.tagName.toLowerCase() === first.toLowerCase();
      if (matches) {
        const result = rest.length ? child.querySelector(rest.join(" ")) : child;
        if (result) return result;
      }
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
  appendChild(child: ElementFixture) {
    child.remove();
    child.parentElement = this;
    this.children.push(child);
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  addEventListener(name: string, callback: () => void) {
    const handlers = this.handlers.get(name) ?? [];
    handlers.push(callback);
    this.handlers.set(name, handlers);
  }
  click() {
    if (!this.disabled) this.handlers.get("click")?.forEach((handler) => handler());
  }
  remove() {
    if (!this.parentElement) return;
    const siblings = this.parentElement.children;
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentElement = null;
  }
}

const noopExports: Record<string, string[]> = {
  "CreateLyricsContainer.ts": ["DestroyAllLyricsContainers"],
  "ScrollToActiveLine.ts": ["CleanupScrollEvents", "InitializeScrollEvents", "ResetLastLine"],
  "CompactMode.ts": ["DisableCompactMode", "EnableCompactMode", "IsCompactMode"],
  "NowBar.ts": [
    "NowBar_SwapSides",
    "Session_NowBar_SetSide",
    "Session_OpenNowBar",
    "ToggleNowBar",
    "OpenNowBar",
  ],
  "ApplyIsByCommunity.tsx": ["CleanUpIsByCommunity"],
  "settings.ts": ["openSettingsPanel"],
  "experiments.ts": ["ApplyExperimentClasses", "onExperimentChange"],
  "LyricsVirtualizer.ts": ["refreshReadingLayoutLV", "triggerRemeasureLV"],
  "readingLayout.ts": ["applyReadingLayout"],
  "themeMatcher.ts": ["setStockPlaybarPage"],
};
const storeNames = [
  "$updateRequired",
  "$forceCompactMode",
  "$currentLyricsData",
  "$lineHoverBackground",
  "$lyricsContainerExists",
  "$lyricsTranslationDisplay",
  "$minimalLyricsMode",
  "$showVolumeSlider",
  "$simpleLyricsMode",
  "$skipSpicyFont",
  "$ttmlMakerMode",
  "$viewControlsPosition",
  "$lyricsFontScale",
  "$lyricsTranslationSize",
  "$lyricsLineSpacing",
  "$lyricsTranslationPosition",
  "$translationState",
];
const bundle = await build({
  entryPoints: [resolve("src/components/Pages/PageView.ts")],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "pageModule",
  plugins: [
    {
      name: "page-host-fixture",
      setup(builder) {
        builder.onResolve({ filter: /^\.\./ }, (args) => ({
          path: args.path.split("/").pop()!,
          namespace: "page-fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "page-fixture" }, ({ path }) => {
          if (path.endsWith(".css")) return { contents: "", loader: "js" };
          const modules: Record<string, string> = {
            "fetchLyrics.ts":
              "export default async function() {} export const cancelLyricsFetch = () => {};",
            "LyricsSkeleton.ts": "export const SkeletonMarkup = '';",
            "UpdateRequiredNotice.ts": "export const createUpdateRequiredNotice = () => {};",
            "Applyer.ts": "export default async function() {};",
            "lyrics.ts":
              "export const LyricsObject = { Types: {} }, isRomanized = false; export const addLinesEvListener = () => {}, removeLinesEvListener = () => {}, setRomanizedStatus = () => {};",
            "ScrollSimplebar.ts": "export const ScrollSimplebar = null;",
            "dynamicBackground.ts":
              "export default async function() {} export const KawarpMap = new Map();",
            "Global.ts": "export default { Event: { listen() {}, evoke() {} } };",
            "Session.ts": "export default { GoBack() {} };",
            "SpotifyPlayer.ts":
              "export const SpotifyPlayer = { GetUri: () => fixture.uri, GetContentType: () => 'track' };",
            "Icons.ts": "export const Icons = new Proxy({}, { get: (_, name) => String(name) });",
            "Fullscreen.ts":
              "export default fixture.fullscreen; export const EnterSpicyLyricsFullscreen = () => {}, ExitFullscreenElement = () => {};",
            "TransferElement.ts": "export default function() {};",
            "PopupLyrics.ts":
              "export const IsPIP = false, _IsPIP_after = false, ClosePopupLyrics = () => {};",
            "NPVLyrics.ts":
              "export const NPVCardOwnsPage = () => false, DeRenderNPVCard = () => {};",
            "ViewControlTooltip.ts": "export const createViewControlTooltip = fixture.tooltip;",
            "Logger.ts":
              "export default class { debug() {} warn(message, error) { throw error; } error(message, error) { throw error; } }",
            "state.ts":
              "export const $translationState = fixture.stores.$translationState; export const requestTranslationToggle = fixture.translate;",
          };
          let contents = modules[path] ?? "";
          if (
            ["stores.ts", "runtimeState.ts", "uiState.ts", "readingPreferences.ts"].includes(path)
          ) {
            contents = `export const { ${storeNames.join(", ")} } = fixture.stores;`;
            if (path === "readingPreferences.ts")
              contents += "export const normalizeReadingPreferences = (value) => value;";
          }
          if (noopExports[path])
            contents += noopExports[path]
              .map((name) => `export const ${name} = () => {};`)
              .join(" ");
          if (path === "NowBar.ts") contents += "export const NowBarObj = { Open: false };";
          assert.ok(contents, `Unknown PageView dependency ${path}`);
          return { contents: `const fixture = globalThis.fixture; ${contents}`, loader: "js" };
        });
      },
    },
  ],
});

const fixture = {
  stores: Object.fromEntries(storeNames.map((name) => [name, store()])),
  uri: "spotify:track:first",
  fullscreen: { IsOpen: false, CinemaViewOpen: false },
  requests: 0,
  createdElements: 0,
  async translate() {
    fixture.requests++;
  },
  tooltip() {
    return { destroy() {}, setContent(_label: string) {}, hide() {} };
  },
};
fixture.stores.$translationState.set("unavailable");
const documentRoot = new ElementFixture();
const mountObservers = new Set<() => void>();
const history = { location: { pathname: "/SpicyLyrics" } };
const context = createContext({
  fixture,
  document: {
    documentElement: documentRoot,
    createElement() {
      fixture.createdElements++;
      return new ElementFixture();
    },
    querySelector: (selector: string) => documentRoot.querySelector(selector),
  },
  Spicetify: { Player: { data: null }, Platform: { History: history } },
  MutationObserver: class {
    constructor(private callback: () => void) {}
    observe() {
      mountObservers.add(this.callback);
    }
    disconnect() {
      mountObservers.delete(this.callback);
    }
  },
  ResizeObserver: class {
    observe() {}
    disconnect() {}
  },
  setTimeout,
  clearTimeout,
});
runInContext(bundle.outputFiles[0].text, context);
const api = context.pageModule as typeof PageModule;

for (const updateRequired of [false, true]) {
  fixture.stores.$updateRequired.set(updateRequired);
  await api.default.Open();
  assert.equal(api.default.IsOpened, false, "A missing main view must leave opening retryable");
  assert.equal(api.PageContainer, null);
  assert.equal(fixture.stores.$lyricsContainerExists.get(), false);
  assert.equal(fixture.createdElements, 0, "A missing host must not create a detached page");
}
fixture.stores.$updateRequired.set(false);

// Spotify 1.3.3 keeps this container and viewport but drops Root__main-view.
// Sidebar viewports come first/last to catch an accidentally unscoped lookup.
const leftViewport = new ElementFixture();
leftViewport.setAttribute("data-overlayscrollbars-viewport", "");
documentRoot.appendChild(leftViewport);
const mainView = new ElementFixture();
mainView.classList.add("main-view-container");
documentRoot.appendChild(mainView);
const scrollNode = new ElementFixture();
scrollNode.classList.add("main-view-container__scroll-node");
mainView.appendChild(scrollNode);
const mainViewport = new ElementFixture();
mainViewport.setAttribute("data-overlayscrollbars-viewport", "");
scrollNode.appendChild(mainViewport);
const scrollChild = new ElementFixture();
scrollChild.classList.add("main-view-container__scroll-node-child");
mainViewport.appendChild(scrollChild);
const rightViewport = new ElementFixture();
rightViewport.setAttribute("data-overlayscrollbars-viewport", "");
documentRoot.appendChild(rightViewport);

assert.equal(documentRoot.querySelector(".Root__main-view"), null);
assert.equal(api.GetPageRoot(), mainViewport);
for (const callback of mountObservers) callback();
assert.equal(api.default.IsOpened, true, "Opening retries automatically when the main view mounts");
assert.equal(mountObservers.size, 0, "A successful mount disconnects the temporary observer");
assert.equal(
  (api.PageContainer as unknown as ElementFixture).attributes.get("data-scroll-size-contained"),
  ""
);
assert.equal(fixture.stores.$lyricsContainerExists.get(), true);
assert.equal((api.PageContainer as unknown as ElementFixture).parentElement, mainViewport);
assert.equal(leftViewport.children.length, 0);
assert.equal(rightViewport.children.length, 0);
await api.default.Destroy();
assert.equal(mainViewport.querySelector("#SpicyLyricsPage"), null);
assert.equal(fixture.stores.$lyricsContainerExists.get(), false);

mainViewport.removeAttribute("data-overlayscrollbars-viewport");
assert.equal(api.GetPageRoot(), mainViewport, "The scroll-child parent fallback remains usable");
scrollChild.remove();
mainViewport.classList.add("os-host");
assert.equal(api.GetPageRoot(), mainViewport, "Legacy scroll hosts remain usable");
await api.default.Open();
assert.equal(mainViewport.style.containerType, "inline-size");
await api.default.Destroy();
assert.equal(mainViewport.style.containerType, "");

mainView.remove();
assert.equal(api.GetPageRoot(), null, "Sidebar viewports must never become the main host");
await api.default.Open();
assert.equal(mountObservers.size, 1);
history.location.pathname = "/album/example";
for (const callback of mountObservers) callback();
assert.equal(mountObservers.size, 0, "Leaving the lyrics route cancels a pending mount");
assert.equal(api.default.IsOpened, false);
history.location.pathname = "/SpicyLyrics";
await api.default.Open();
await api.default.Destroy();
assert.equal(mountObservers.size, 0, "Closing an unmounted page cancels the observer");
const cardHost = new ElementFixture();
await api.default.Open(cardHost as unknown as HTMLElement, { cardMode: true });
assert.equal(api.IsCardMode, true);
assert.equal((api.PageContainer as unknown as ElementFixture).parentElement, cardHost);
await api.default.Destroy();

const explicitHost = new ElementFixture();
await api.default.Open(explicitHost as unknown as HTMLElement);
const page = api.PageContainer as unknown as ElementFixture;
assert.equal(page.parentElement, explicitHost, "Explicit hosts work without Spotify's main view");
const controls = page.querySelector(".ContentBox .ViewControls")!;
const button = () => page.querySelector("#TranslateToggle");
const initial = button();
assert.ok(initial, "Unavailable translation must retain a bound control for later state updates");
assert.equal(initial.style.display, "none");
assert.equal(initial.disabled, true);

function state(next: string, disabled: boolean, label: string) {
  fixture.stores.$translationState.set(next);
  const current = button()!;
  assert.equal(
    current,
    initial,
    "State changes must update the existing button without rebuilding"
  );
  assert.equal(page.querySelector(".ViewControls"), controls);
  assert.equal(current.style.display, next === "unavailable" ? "none" : "");
  assert.equal(current.disabled, disabled);
  assert.equal(current.dataset.translationState, next);
  assert.equal(current.attributes.get("aria-label"), label);
  assert.equal(current.attributes.get("aria-busy"), String(next === "loading"));
}
state("ready", false, "翻译当前歌词");
initial.click();
assert.equal(
  fixture.requests,
  1,
  "Initially unavailable control becomes clickable without entering cinema"
);
state("loading", true, "正在翻译歌词");
initial.click();
state("complete", true, "已有歌词翻译");
initial.click();
assert.equal(fixture.requests, 1, "Loading and complete cannot start another translation");
state("error", false, "重新翻译歌词");
initial.click();
assert.equal(fixture.requests, 2, "Failed translation can be retried");

fixture.uri = "spotify:track:second";
fixture.stores.$currentLyricsData.set(`NO_LYRICS:${fixture.uri}`);
state("unavailable", true, "当前歌词无需翻译");
fixture.uri = "spotify:track:third";
fixture.stores.$currentLyricsData.set("");
state("ready", false, "翻译当前歌词");
initial.click();
assert.equal(fixture.requests, 3, "A later translatable song restores the same control");

for (const cinema of [true, false, true]) {
  fixture.fullscreen.CinemaViewOpen = cinema;
  api.default.AppendViewControls(true);
  const rebuilt = button()!;
  assert.notEqual(rebuilt, initial);
  assert.equal(rebuilt.handlers.get("click")?.length, 1);
  const before: number = fixture.requests;
  rebuilt.click();
  assert.equal(fixture.requests, before + 1, "Each rebuilt toolbar binds one translation request");
}
console.log(
  "PageView: main-view compatibility, missing-host retry, explicit hosts and translation controls verified"
);
