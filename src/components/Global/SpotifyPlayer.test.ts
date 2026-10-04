/// <reference types="node" />
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import type * as Esbuild from "esbuild";
import type * as PlayerModule from "./SpotifyPlayer.ts";

const { build } = createRequire(import.meta.url)("esbuild") as typeof Esbuild;
type MutationFixture = {
  target: ElementFixture;
  addedNodes: ElementFixture[];
  removedNodes: ElementFixture[];
};

class ElementFixture {
  children: ElementFixture[] = [];
  parentElement: ElementFixture | null = null;
  attributes = new Map<string, string>();
  classes = new Set<string>();
  innerHTML = "";
  disabled = false;
  onclick: (() => void) | null = null;
  classList = {
    add: (...names: string[]) => names.forEach((name) => this.classes.add(name)),
    contains: (name: string) => this.classes.has(name),
    toggle: (name: string, force: boolean) =>
      force ? this.classes.add(name) : this.classes.delete(name),
  };
  constructor(
    readonly tagName: string,
    private readonly notify: (record: MutationFixture) => void
  ) {}
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  matches(selector: string): boolean {
    return selector.split(",").some((part) => {
      const chain = part.trim().split(/\s*>\s*/);
      const simple = chain.pop()!;
      const match = /^(\w+)?(?:\.([\w-]+))?(?:\[([\w-]+)="([^"]+)"\])?$/.exec(simple);
      if (!match) return false;
      const [, tag, cssClass, attribute, value] = match;
      const ownMatch =
        (!tag || tag.toLowerCase() === this.tagName.toLowerCase()) &&
        (!cssClass || this.classes.has(cssClass)) &&
        (!attribute || this.attributes.get(attribute) === value);
      return ownMatch && (!chain.length || !!this.parentElement?.matches(chain.join(" > ")));
    });
  }
  querySelector(selector: string): ElementFixture | null {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
  contains(node: ElementFixture): boolean {
    return node === this || this.children.some((child) => child.contains(node));
  }
  appendChild(node: ElementFixture) {
    this.append(node);
    return node;
  }
  append(...nodes: ElementFixture[]) {
    this.insert(nodes, false);
  }
  prepend(...nodes: ElementFixture[]) {
    this.insert(nodes, true);
  }
  private insert(nodes: ElementFixture[], first: boolean) {
    for (const node of nodes) node.remove();
    for (const node of nodes) node.parentElement = this;
    if (first) this.children.unshift(...nodes);
    else this.children.push(...nodes);
    this.notify({ target: this, addedNodes: nodes, removedNodes: [] });
  }
  remove() {
    const parent = this.parentElement;
    if (!parent) return;
    parent.children = parent.children.filter((child) => child !== this);
    this.parentElement = null;
    this.notify({ target: parent, addedNodes: [], removedNodes: [this] });
  }
}

const bundle = await build({
  entryPoints: [resolve("src/components/Global/SpotifyPlayer.ts")],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "playerModule",
  plugins: [
    {
      name: "spotify-player-host-fixture",
      setup(builder) {
        builder.onResolve({ filter: /^\./ }, (args) => ({
          path: args.path.split("/").pop()!,
          namespace: "player-fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "player-fixture" }, ({ path }) => {
          const modules: Record<string, string> = {
            "GetProgress.ts":
              "export default () => 0; export const _DEPRECATED___GetProgress = () => 0;",
            "ViewControlTooltip.ts": "export const createViewControlTooltip = () => undefined;",
            "tooltip.ts": "export const createTooltip = () => undefined;",
            "Global.ts":
              "export default { Event: { evoke: (...args) => fixture.events.push(args) } };",
          };
          assert.ok(modules[path], `Unknown SpotifyPlayer dependency ${path}`);
          return { contents: `const fixture = globalThis.fixture; ${modules[path]}`, loader: "js" };
        });
      },
    },
  ],
});

function setup(nativeTestId?: string, legacy = false) {
  const pending: MutationFixture[] = [];
  const observers: Array<{
    callback: (records: MutationFixture[]) => void;
    target: ElementFixture | null;
  }> = [];
  let root: ElementFixture;
  const createElement = (tag = "div") =>
    new ElementFixture(tag, (record) => {
      if (root?.contains(record.target)) pending.push(record);
    });
  root = createElement("html");
  const body = createElement("body");
  root.append(body);
  const events: unknown[][] = [];
  const nativeGroup = (testId: string) => {
    const group = createElement();
    const nativeButton = createElement("button");
    nativeButton.setAttribute("data-testid", testId);
    nativeButton.classList.add("hashed-native-control", "theme-native-only");
    group.append(nativeButton);
    return group;
  };
  const addPlaybar = (testId: string, old = false) => {
    const playbar = createElement();
    if (old) playbar.classes.add("Root__now-playing-bar");
    else playbar.setAttribute("data-testid", "now-playing-bar");
    const group = nativeGroup(testId);
    if (old) group.classes.add("main-nowPlayingBar-extraControls");
    playbar.append(group);
    body.append(playbar);
    return { playbar, group };
  };
  const initial = nativeTestId ? addPlaybar(nativeTestId, legacy) : null;
  pending.length = 0;
  const context = createContext({
    console,
    fixture: { events },
    document: {
      documentElement: root,
      createElement,
      querySelector: (selector: string) => root.querySelector(selector),
    },
    Element: ElementFixture,
    Spicetify: { Player: {} },
    setTimeout: () => 1,
    MutationObserver: class {
      entry: (typeof observers)[number];
      constructor(callback: (records: MutationFixture[]) => void) {
        this.entry = { callback, target: null };
        observers.push(this.entry);
      }
      observe(target: ElementFixture) {
        this.entry.target = target;
      }
    },
  });
  runInContext(bundle.outputFiles[0].text, context);
  return {
    api: (context.playerModule as typeof PlayerModule).SpotifyPlayer.Playbar,
    initial,
    addPlaybar,
    nativeGroup,
    createElement,
    body,
    events,
    flush() {
      let deliveries = 0;
      while (pending.length) {
        assert.ok(
          ++deliveries < 10,
          "Playbar mounting must settle instead of creating an observer loop"
        );
        const records = pending.splice(0);
        for (const observer of observers) {
          const relevant = records.filter((record) => observer.target?.contains(record.target));
          if (relevant.length) observer.callback(relevant);
        }
      }
      return deliveries;
    },
  };
}

for (const testId of ["lyrics-button", "pip-toggle-button", "fullscreen-mode-button"]) {
  const f = setup(testId);
  const group = f.initial!.group;
  assert.equal(
    f.api.GetControls(),
    group,
    `Modern ${testId} locates controls without legacy classes`
  );
  const button = new f.api.Button("歌词", "<svg></svg>");
  const node = button.element as unknown as ElementFixture;
  f.flush();
  assert.equal(node.parentElement, group);
  assert.ok(node.classes.has("sl-playbar-button"), "The local button styling is preserved");
  assert.ok(!node.classes.has("hashed-native-control"));
  assert.ok(
    !node.classes.has("theme-native-only"),
    "Native sibling classes must not leak into extension buttons"
  );
  assert.equal(node.getAttribute("aria-label"), "歌词");
  for (let i = 0; i < 4; i++) {
    button.register();
    f.flush();
  }
  assert.equal(
    group.children.filter((child) => child === node).length,
    1,
    "Repeated registration keeps one DOM node"
  );
  const eventCount = f.events.length;
  const lyricLine = f.createElement();
  lyricLine.classes.add("line");
  lyricLine.classes.add("Active");
  f.body.append(lyricLine);
  f.flush();
  assert.equal(
    f.events.length,
    eventCount,
    "Unrelated lyric DOM changes do not trigger playbar work"
  );
}

{
  const f = setup();
  const first = new f.api.Button("歌词", "");
  const second = new f.api.Button("弹窗歌词", "");
  const one = first.element as unknown as ElementFixture;
  const two = second.element as unknown as ElementFixture;
  assert.equal(one.parentElement, null, "Buttons can register before Spotify mounts controls");
  const late = f.addPlaybar("pip-toggle-button");
  f.flush();
  assert.equal(one.parentElement, late.group);
  assert.equal(two.parentElement, late.group);

  const replacement = f.nativeGroup("fullscreen-mode-button");
  late.group.remove();
  late.playbar.append(replacement);
  f.flush();
  assert.equal(
    one.parentElement,
    replacement,
    "Replacing the full controls group restores the stash"
  );
  assert.equal(two.parentElement, replacement);
  assert.equal(late.group.children.includes(one), false);
  one.remove();
  f.flush();
  assert.equal(
    one.parentElement,
    replacement,
    "Spotify removing a registered button restores it once"
  );

  first.deregister();
  f.flush();
  assert.equal(
    one.parentElement,
    null,
    "An explicit deregister must not be reversed by the observer"
  );
  late.playbar.remove();
  const newBar = f.addPlaybar("lyrics-button");
  f.flush();
  assert.equal(
    two.parentElement,
    newBar.group,
    "Replacing the entire playbar also restores registered controls"
  );
  assert.equal(
    one.parentElement,
    null,
    "Deregistered buttons stay absent across playbar replacement"
  );
  second.deregister();
  f.flush();
  assert.equal(newBar.group.children.length, 1, "Only the native control remains after cleanup");
}

{
  const f = setup("unknown-native-button", true);
  assert.equal(
    f.api.GetControls(),
    f.initial!.group,
    "Older clients retain the legacy-class fallback"
  );
}

console.log(
  "SpotifyPlayer Playbar tests passed (modern selectors, delayed/replaced controls, stash cleanup and observer stability)."
);
