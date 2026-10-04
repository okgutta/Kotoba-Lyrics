/// <reference types="node" />
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";
import { resolve } from "node:path";
import type * as Esbuild from "esbuild";
import type * as ProfileMenu from "./ProfileMenuFallback.ts";

const { build } = createRequire(import.meta.url)("esbuild") as typeof Esbuild;
const bundle = await build({
  entryPoints: [resolve("src/components/Utils/ProfileMenuFallback.ts")],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "profileModule",
});
type RecordFixture = {
  target: ElementFixture;
  type: string;
  attributeName?: string;
  addedNodes: ElementFixture[];
  removedNodes: ElementFixture[];
};
type EventFixture = {
  type: string;
  target: ElementFixture;
  preventDefault(): void;
  stopPropagation(): void;
};

class ElementFixture {
  parentElement: ElementFixture | null = null;
  children: ElementFixture[] = [];
  attrs = new Map<string, string>();
  handlers = new Map<string, Array<(event: EventFixture) => void>>();
  style = { flex: "" };
  type = "";
  tabIndex = 0;
  dir = "";
  private text = "";
  constructor(
    readonly localName: string,
    readonly ownerDocument: DocumentFixture
  ) {}
  get id() {
    return this.getAttribute("id") ?? "";
  }
  set id(value: string) {
    this.setAttribute("id", value);
  }
  get className() {
    return this.getAttribute("class") ?? "";
  }
  set className(value: string) {
    this.setAttribute("class", value);
  }
  get textContent(): string {
    return this.text + this.children.map((child) => child.textContent).join("");
  }
  set textContent(value: string) {
    this.text = value;
  }
  get isConnected(): boolean {
    return this === this.ownerDocument.body || !!this.parentElement?.isConnected;
  }
  getAttribute(name: string) {
    return this.attrs.get(name) ?? null;
  }
  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
    this.ownerDocument.emit({
      target: this,
      type: "attributes",
      attributeName: name,
      addedNodes: [],
      removedNodes: [],
    });
  }
  matches(selector: string): boolean {
    return selector.split(",").some((part) => {
      const segments = part.trim().split(/\s+/);
      const leaf = segments.pop()!;
      const tag = leaf.match(/^[\w-]+/)?.[0];
      if (tag && tag !== this.localName) return false;
      for (const [, name] of leaf.matchAll(/\.([\w-]+)/g)) {
        if (!this.className.split(/\s+/).includes(name)) return false;
      }
      const id = leaf.match(/#([\w-]+)/)?.[1];
      if (id && id !== this.id) return false;
      for (const [, key, value] of leaf.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
        if (
          this.getAttribute(key) === null ||
          (value !== undefined && this.getAttribute(key) !== value)
        )
          return false;
      }
      return segments.length === 0 || !!this.parentElement?.closest(segments.join(" "));
    });
  }
  closest(selector: string): ElementFixture | null {
    return this.matches(selector) ? this : (this.parentElement?.closest(selector) ?? null);
  }
  querySelectorAll(selector: string): ElementFixture[] {
    if (selector.startsWith(":scope > "))
      return this.children.filter((child) => child.matches(selector.slice(9)));
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector: string): ElementFixture | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  append(...children: ElementFixture[]) {
    for (const child of children) {
      child.remove();
      child.parentElement = this;
      this.children.push(child);
    }
    this.ownerDocument.emit({
      target: this,
      type: "childList",
      addedNodes: children,
      removedNodes: [],
    });
  }
  prepend(child: ElementFixture) {
    this.append(child);
    this.children.unshift(this.children.pop()!);
  }
  before(child: ElementFixture) {
    const parent = this.parentElement!;
    const index = parent.children.indexOf(this);
    parent.append(child);
    parent.children.splice(index, 0, parent.children.pop()!);
  }
  remove() {
    const parent = this.parentElement;
    if (!parent) return;
    parent.children = parent.children.filter((child) => child !== this);
    this.parentElement = null;
    this.ownerDocument.emit({
      target: parent,
      type: "childList",
      addedNodes: [],
      removedNodes: [this],
    });
  }
  addEventListener(name: string, callback: (event: EventFixture) => void) {
    this.handlers.set(name, [...(this.handlers.get(name) ?? []), callback]);
  }
  click() {
    const event = { type: "click", target: this, preventDefault() {}, stopPropagation() {} };
    for (const callback of this.ownerDocument.handlers.get("click") ?? []) callback(event);
    for (const callback of this.handlers.get("click") ?? []) callback(event);
  }
}

class DocumentFixture {
  body = new ElementFixture("body", this);
  handlers = new Map<string, Set<(event: EventFixture) => void>>();
  pending: RecordFixture[] = [];
  observers: Array<{ callback: (records: RecordFixture[]) => void; active: boolean }> = [];
  createElement(name: string) {
    return new ElementFixture(name, this);
  }
  importNode(element: ElementFixture) {
    return element;
  }
  querySelector(selector: string) {
    return this.body.querySelector(selector);
  }
  querySelectorAll(selector: string) {
    return this.body.querySelectorAll(selector);
  }
  addEventListener(name: string, callback: (event: EventFixture) => void) {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name)!.add(callback);
  }
  removeEventListener(name: string, callback: (event: EventFixture) => void) {
    this.handlers.get(name)?.delete(callback);
  }
  emit(record: RecordFixture) {
    if (
      record.target.isConnected &&
      this.observers.some((observer) => observer.active) &&
      (record.type === "childList" || record.attributeName === "aria-expanded")
    )
      this.pending.push(record);
  }
  flush() {
    for (let i = 0; this.pending.length && i < 10; i++) {
      const records = this.pending.splice(0);
      for (const observer of this.observers) if (observer.active) observer.callback(records);
    }
    assert.equal(this.pending.length, 0, "Menu observer must settle after its own insertion");
  }
}

function fixture(
  options: { modern?: boolean; spacer?: boolean; native?: boolean; labelledBy?: string } = {}
) {
  const document = new DocumentFixture();
  const nav = document.createElement("div");
  nav.className = "Root__globalNav";
  const group = document.createElement("div");
  group.className = "main-actionButtons" + (options.spacer ? " main-actionButtons-spacer" : "");
  const profile = document.createElement("button");
  profile.id = "profile";
  if (!options.modern) profile.setAttribute("data-testid", "user-widget-link");
  profile.setAttribute("aria-label", "Profile");
  profile.setAttribute("aria-expanded", "true");
  profile.addEventListener("click", () =>
    profile.setAttribute("aria-expanded", String(profile.getAttribute("aria-expanded") !== "true"))
  );
  group.append(profile);
  nav.append(group);
  document.body.append(nav);
  const portal = document.createElement("div");
  portal.id = "context-menu";
  document.body.append(portal);
  const nativeRow = (name: string, anchor = false) => {
    const row = document.createElement("li");
    row.setAttribute("role", "presentation");
    row.className = "native-row";
    const button = document.createElement(anchor ? "a" : "button");
    button.setAttribute("role", "menuitem");
    button.className = "native-item";
    button.textContent = name;
    if (anchor) button.setAttribute("href", "/account");
    row.append(button);
    return row;
  };
  const makeMenu = () => {
    const menu = document.createElement("ul");
    menu.setAttribute("role", "menu");
    if (options.labelledBy) menu.setAttribute("aria-labelledby", options.labelledBy);
    menu.append(nativeRow("Account", true));
    if (options.native) menu.append(nativeRow("Kotoba Lyrics 设置"));
    portal.append(menu);
    return menu;
  };
  let menu = makeMenu();
  let opens = 0;
  const context = createContext({
    document,
    Element: ElementFixture,
    DOMParser: class {
      parseFromString() {
        return { documentElement: document.createElement("svg") };
      }
    },
    MutationObserver: class {
      entry: (typeof document.observers)[number];
      constructor(callback: (records: RecordFixture[]) => void) {
        this.entry = { callback, active: false };
        document.observers.push(this.entry);
      }
      observe() {
        this.entry.active = true;
      }
      disconnect() {
        this.entry.active = false;
      }
    },
  });
  runInContext(bundle.outputFiles[0].text, context);
  const api = context.profileModule as typeof ProfileMenu;
  const dispose = api.installProfileMenuFallback({
    name: "Kotoba Lyrics 设置",
    icon: '<svg xmlns="http://www.w3.org/2000/svg"/>',
    onOpen: () => {
      opens++;
    },
  });
  document.flush();
  return {
    document,
    profile,
    dispose,
    nativeRow,
    get menu() {
      return menu;
    },
    opens: () => opens,
    owned: () => document.querySelector("#KotobaLyricsSettingsMenuFallback"),
    rebuild() {
      menu.remove();
      menu = makeMenu();
      document.flush();
    },
  };
}

for (const modern of [false, true]) {
  const test = fixture({ modern });
  const row = test.owned()!;
  assert.ok(row, "Standard and unmapped avatar buttons both receive the fallback");
  assert.equal(test.menu.children[0], row, "Insert before the first native account link");
  const button = row.querySelector('[role="menuitem"]')!;
  assert.equal(button.className, "native-item");
  button.click();
  test.document.flush();
  assert.equal(test.opens(), 1);
  assert.equal(test.profile.getAttribute("aria-expanded"), "false");
  assert.equal(test.owned(), null);
  button.click();
  test.document.flush();
  assert.equal(test.opens(), 1, "Detached rows cannot reopen the panel");
  test.profile.click();
  test.document.flush();
  assert.ok(test.owned(), "Reopening the profile menu restores its row");
  const oldRow = test.owned();
  test.rebuild();
  assert.ok(test.owned());
  assert.notEqual(test.owned(), oldRow, "React rebuilding menu contents reattaches the row");
  assert.equal(
    test.menu.children.filter((child) => child.textContent === "Kotoba Lyrics 设置").length,
    1
  );
  const native = test.nativeRow("Kotoba Lyrics 设置");
  test.menu.append(native);
  test.document.flush();
  assert.equal(test.owned(), null, "A late native registration removes the fallback duplicate");
  native.remove();
  test.document.flush();
  assert.ok(test.owned());
  test.dispose();
  test.document.flush();
  assert.equal(test.owned(), null);
  assert.equal(
    test.document.observers.some((observer) => observer.active),
    false
  );
  assert.equal(
    [...test.document.handlers.values()].some((handlers) => handlers.size),
    false
  );
}
assert.equal(
  fixture({ native: true }).owned(),
  null,
  "Existing native settings entry is preserved"
);
assert.equal(
  fixture({ modern: true, spacer: true }).owned(),
  null,
  "Notifications/friends action groups are excluded"
);
assert.equal(
  fixture({ labelledBy: "another-menu-trigger" }).owned(),
  null,
  "Do not insert into explicitly unrelated menus"
);
const unrelated = fixture({ modern: true });
const other = unrelated.document.createElement("button");
unrelated.document.body.append(other);
other.click();
unrelated.document.flush();
assert.equal(
  unrelated.owned(),
  null,
  "Another trigger suppresses insertion even before avatar aria-expanded resets"
);
unrelated.rebuild();
assert.equal(unrelated.owned(), null);
const contextClick = fixture();
for (const callback of contextClick.document.handlers.get("contextmenu") ?? []) {
  callback({
    type: "contextmenu",
    target: contextClick.profile,
    preventDefault() {},
    stopPropagation() {},
  });
}
contextClick.document.flush();
assert.equal(
  contextClick.owned(),
  null,
  "Right-clicking the avatar does not identify a profile menu"
);
console.log(
  "ProfileMenuFallback: avatar variants, real callbacks, rebuilds, native deduplication, unrelated menus and disposal verified"
);
