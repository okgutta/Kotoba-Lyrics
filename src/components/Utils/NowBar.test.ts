/// <reference types="node" />
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import type * as Esbuild from "esbuild";
import type * as NowBarModule from "./NowBar.ts";

const { build } = createRequire(import.meta.url)("esbuild") as typeof Esbuild;

class Events {
  handlers = new Map<string, Set<(event: any) => void>>();
  addEventListener(name: string, handler: (event: any) => void) {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name)!.add(handler);
  }
  removeEventListener(name: string, handler: (event: any) => void) {
    this.handlers.get(name)?.delete(handler);
  }
  emit(name: string, event: Record<string, unknown> = {}) {
    for (const handler of Array.from(this.handlers.get(name) ?? [])) handler(event);
  }
  count(name: string) {
    return this.handlers.get(name)?.size ?? 0;
  }
}

class ElementFixture extends Events {
  ownerDocument: DocumentFixture;
  parentNode: ElementFixture | null = null;
  isConnected = true;
  textContent = "";
  attributes = new Map<string, string>();
  classes = new Set<string>();
  children: ElementFixture[] = [];
  style = { userSelect: "", setProperty() {} };
  classList = {
    add: (...names: string[]) => names.forEach((name) => this.classes.add(name)),
    remove: (...names: string[]) => names.forEach((name) => this.classes.delete(name)),
    contains: (name: string) => this.classes.has(name),
    toggle: (name: string, force: boolean) =>
      force ? this.classes.add(name) : this.classes.delete(name),
  };
  constructor(document: DocumentFixture) {
    super();
    this.ownerDocument = document;
  }
  set innerHTML(markup: string) {
    this.children = [];
    for (const match of (markup ?? "").matchAll(/class="([^"]+)"/g)) {
      const child = new ElementFixture(this.ownerDocument);
      child.classList.add(...match[1].split(" "));
      this.appendChild(child);
    }
  }
  querySelector(selector: string): ElementFixture | null {
    // Artwork/metadata are outside this control interaction fixture.
    if (selector.includes("Metadata") || selector.includes("MediaImageContainer")) return null;
    const classes = selector.split(" ").at(-1)!.split(".").filter(Boolean);
    return (
      this.children.find((child) => classes.every((name) => child.classes.has(name))) ??
      this.children.map((child) => child.querySelector(selector)).find(Boolean) ??
      null
    );
  }
  querySelectorAll() {
    return [];
  }
  closest(selector: string) {
    return this.classes.has(selector.slice(1)) ? this : null;
  }
  appendChild(child: ElementFixture) {
    if (child.classes.has("fragment")) {
      for (const nested of child.children.slice()) this.appendChild(nested);
      return;
    }
    child.remove();
    child.ownerDocument = this.ownerDocument;
    child.parentNode = this;
    this.children.push(child);
  }
  removeChild(child: ElementFixture) {
    this.children = this.children.filter((item) => item !== child);
    child.parentNode = null;
  }
  remove() {
    this.parentNode?.removeChild(this);
  }
  getBoundingClientRect() {
    return { top: 0, left: 0, width: 100, height: 100 };
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  getAttribute(name: string) {
    return this.attributes.get(name);
  }
  focus() {}
  setPointerCapture() {}
  hasPointerCapture() {
    return false;
  }
}

class DocumentFixture extends Events {
  defaultView = new Events();
  body = new ElementFixture(this);
  createElement() {
    return new ElementFixture(this);
  }
  createDocumentFragment() {
    const fragment = this.createElement();
    fragment.classes.add("fragment");
    return fragment;
  }
}

function store(value: unknown) {
  return {
    get: () => value,
    set: (next: unknown) => {
      value = next;
    },
    subscribe() {},
    listen() {},
  };
}

const bundle = await build({
  entryPoints: [resolve("src/components/Utils/NowBar.ts")],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "nowBarModule",
  plugins: [
    {
      name: "nowbar-host-fixture",
      setup(builder) {
        builder.onResolve({ filter: /^\./ }, (args) =>
          args.path.endsWith("SongProgressBar.ts")
            ? undefined
            : { path: args.path.split("/").pop()!, namespace: "fixture" }
        );
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
          const modules: Record<string, string> = {
            "BlobURLMaker.ts": "export default async () => null;",
            "CreateLyricsContainer.ts":
              "export const GetCurrentLyricsContainerInstance = () => null;",
            "ScrollToActiveLine.ts":
              "export const QueueForceScroll = () => {}, ResetLastLine = () => {};",
            "stores.ts":
              "export const { $showVolumeSlider, $timelineOutsideMediaContent } = f.stores;",
            "experiments.ts": "export const onExperimentChange = () => {};",
            "uiState.ts": "export const { $isNowBarOpen, $nowBarSide } = f.stores;",
            "Global.ts": "export default { Event: { listen() {}, evoke() {} } };",
            "Session.ts": "export default {};",
            "SpotifyPlayer.ts": "export const SpotifyPlayer = f.player;",
            "PageView.ts":
              "export const PageContainer = f.page; export default { AppendViewControls() {} };",
            "Icons.ts": "export const Icons = {};",
            "Fullscreen.ts":
              "export default { IsOpen: true }; export const CleanupMediaBox = () => {}, SetControlsDragLock = value => f.dragLock = value;",
            "PopupLyrics.ts": "export const IsPIP = true;",
            "CompactMode.ts": "export const IsCompactMode = () => false;",
            "Maid.ts":
              "export class Maid { tasks = []; destroyed = false; Give(task) { this.tasks.push(task); return task; } IsDestroyed() { return this.destroyed; } Destroy() { this.destroyed = true; for(const task of this.tasks.splice(0)) typeof task === 'function' ? task() : task?.Destroy?.(); } }",
            "Scheduler.ts": "export default { Interval() {} };",
            "Whentil.ts":
              "export default { When(_condition, callback) { callback(); return { Cancel() {} }; } };",
          };
          assert.ok(modules[path], `Unknown NowBar dependency ${path}`);
          return { contents: `const f = globalThis.fixture; ${modules[path]}`, loader: "js" };
        });
      },
    },
  ],
});

const mainDocument = new DocumentFixture();
const popupDocument = new DocumentFixture();
const page = popupDocument.createElement();
const nowBar = popupDocument.createElement();
nowBar.classes.add("NowBar");
page.appendChild(nowBar);
const media = popupDocument.createElement();
media.classes.add("MediaContent");
nowBar.appendChild(media);
let volume = 0.7;
let clock = 0;
let uri = "spotify:track:first";
const volumeWrites: number[] = [];
const seeks: number[] = [];
const fixture = {
  page,
  dragLock: false,
  stores: {
    $showVolumeSlider: store(true),
    $timelineOutsideMediaContent: store(false),
    $isNowBarOpen: store(true),
    $nowBarSide: store("left"),
  },
  player: {
    GetDuration: () => 100000,
    GetUri: () => uri,
    Seek: (value: number) => seeks.push(value),
    LoopType: "none",
    ShuffleType: "none",
  },
};
const context = createContext({
  fixture,
  console,
  document: mainDocument,
  performance: { now: () => clock },
  setTimeout: () => 1,
  clearTimeout() {},
  Spicetify: {
    Player: {
      getVolume: () => volume,
      setVolume: (value: number) => {
        volume = value;
        volumeWrites.push(value);
      },
      setMute: (muted: boolean) => assert.equal(muted, false),
      toggleMute: () => assert.fail("Spotify's broken toggleMute must not be used"),
      getProgress: () => 20000,
      addEventListener() {},
      removeEventListener() {},
    },
  },
});
runInContext(bundle.outputFiles[0].text, context);
const api = context.nowBarModule as typeof NowBarModule;
const mouse = (target: ElementFixture, clientY = 96) => ({ target, clientX: 5, clientY });
const control = () => {
  const bar = media.querySelector(".VolumeControl")!;
  return { bar, icon: bar.querySelector(".VolumeIcon")! };
};
const tap = () => {
  const { bar, icon } = control();
  bar.emit("mousedown", mouse(icon));
  popupDocument.emit("mouseup", mouse(icon));
};

api.OpenNowBar();
assert.ok(page.classes.has("NowBarStatus__Open"));
api.Session_NowBar_SetSide();
assert.ok(page.classes.has("NowBarSide__Left"));
api.NowBar_SwapSides();
assert.ok(page.classes.has("NowBarSide__Right"));
tap();
assert.equal(volume, 0, "An icon tap mutes without moving the volume first");
api.CleanUpNowBarComponents();
api.OpenNowBar();
tap();
assert.equal(volume, 0.7, "Unmute restores volume across overlay rebuilds");

{
  const { bar, icon } = control();
  bar.emit("mousedown", mouse(icon));
  assert.equal(mainDocument.count("mousemove"), 0, "PiP drag must not bind the opener document");
  assert.equal(popupDocument.count("mousemove"), 1);
  popupDocument.emit("mousemove", mouse(icon, 94));
  assert.equal(volume, 0.7, "Small icon movement remains a mute tap");
  popupDocument.emit("mousemove", mouse(icon, 50));
  assert.equal(volume, 0.5, "Dragging from the icon adjusts volume");
  popupDocument.emit("mouseup", mouse(icon, 50));
  const writes = volumeWrites.length;
  mainDocument.emit("mousemove", mouse(icon, 300));
  assert.equal(
    volumeWrites.length,
    writes,
    "Returning to the opener after release cannot reset volume"
  );
  assert.equal(popupDocument.count("mousemove"), 0);
  assert.equal(fixture.dragLock, false);
}

{
  const { bar, icon } = control();
  const touch = { target: icon, touches: [{ clientX: 5, clientY: 96 }] };
  bar.emit("touchstart", touch);
  popupDocument.emit("touchcancel");
  assert.equal(volume, 0.5, "A cancelled touch must not mute");
  assert.equal(fixture.dragLock, false);
  assert.equal(popupDocument.count("touchmove"), 0);
  clock += 1000;
  bar.emit("touchstart", touch);
  popupDocument.emit("touchend", { changedTouches: touch.touches });
  assert.equal(volume, 0);
  tap();
  assert.equal(volume, 0, "Synthetic mouse events following touch must not toggle twice");
  clock += 1000;
  tap();
  assert.equal(volume, 0.5);
  bar.emit("mousedown", mouse(bar, 30));
  assert.equal(volume, 0.7, "The rest of the capsule still commits immediately");
  api.CleanUpNowBarComponents();
  assert.equal(popupDocument.count("mouseup"), 0, "Teardown cancels an active drag");
  assert.equal(fixture.dragLock, false);
}

// Preserve the local timeline's pointer/keyboard behavior while porting volume changes.
api.OpenNowBar();
const slider = media.querySelector(".SliderBar")!;
const pointer = { isPrimary: true, button: 0, pointerId: 1, clientX: 50, preventDefault() {} };
slider.emit("pointerdown", pointer);
popupDocument.emit("pointerup", { ...pointer, clientX: 60 });
assert.equal(seeks.at(-1), 60000);
slider.emit("keydown", {
  key: "ArrowRight",
  shiftKey: false,
  preventDefault() {},
  stopPropagation() {},
});
assert.equal(seeks.at(-1), 25000);
slider.emit("pointerdown", pointer);
uri = "spotify:track:second";
const seekCount = seeks.length;
popupDocument.emit("pointerup", pointer);
assert.equal(seeks.length, seekCount, "Releasing after a track change must not seek the new track");
api.CloseNowBar();
assert.ok(page.classes.has("NowBarStatus__Closed"));
assert.ok(!page.classes.has("NowBarStatus__Open"));
console.log("NowBar volume, PiP document, state classes and timeline regression tests passed.");
