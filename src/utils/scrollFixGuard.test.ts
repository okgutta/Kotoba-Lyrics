/// <reference types="node" />
import assert from "node:assert/strict";
import type * as Esbuild from "esbuild";
import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";
import { resolve } from "node:path";

const { build } = createRequire(import.meta.url)("esbuild") as typeof Esbuild;

const bundle = await build({
  entryPoints: [resolve("src/utils/scrollFixGuard.ts")],
  bundle: true,
  format: "iife",
  globalName: "guardModule",
  write: false,
});

class ElementFixture {
  attributes = new Map<string, string>();
  children: ElementFixture[] = [];
  isConnected = true;
  style = { transform: "translateX(12px)", willChange: "opacity" };
  hasAttribute(name: string) {
    return this.attributes.has(name);
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  querySelectorAll(): ElementFixture[] {
    return this.children.flatMap((child) => [
      ...(child.hasAttribute("data-scroll-optimized") ? [] : [child]),
      ...child.querySelectorAll(),
    ]);
  }
}

function fixture(
  spotify: string,
  spicetify: string | undefined,
  theme = "marketplace",
  vantagraphGuard: string | null = null,
  neutralised = false
) {
  const root = new ElementFixture();
  const head = new ElementFixture();
  const body = new ElementFixture();
  root.children.push(head, body);
  const observations: Array<{ callback: MutationCallback; target?: unknown; options?: unknown }> =
    [];
  const context = createContext({
    Element: ElementFixture,
    document: {
      documentElement: root,
      querySelectorAll: () => (neutralised ? [] : [root, ...root.querySelectorAll()]),
    },
    MutationObserver: class {
      entry: (typeof observations)[number];
      constructor(callback: MutationCallback) {
        this.entry = { callback };
        observations.push(this.entry);
      }
      observe(target: unknown, options: unknown) {
        Object.assign(this.entry, { target, options });
      }
    },
    Spicetify: {
      Platform: { version: spotify },
      Config: { version: spicetify, current_theme: theme },
      LocalStorage: { get: () => vantagraphGuard },
    },
  });
  runInContext(bundle.outputFiles[0].text, context);
  return {
    root,
    head,
    body,
    observations,
    run: () => runInContext("guardModule.guardSpicetifyScrollingFix()", context),
  };
}

for (const [spotify, spicetify, active] of [
  ["1.3.0.277", "2.45.1", true],
  ["1.3.56.1", "2.44.0", true],
  ["1.3.57.1", "2.45.1", false],
  ["1.2.56.1", "2.45.1", false],
  ["1.2.57.1", "2.45.1", false],
  ["1.3.0.277", "2.45.2", false],
  ["1.3.0.277", "2.46.0", false],
  ["1.3.0.277", "3.0.0", false],
  ["1.3.0.277", "dev", false],
  ["1.3.0.277", undefined, false],
  ["unknown", "2.45.1", false],
] as const) {
  const test = fixture(spotify, spicetify);
  test.run();
  assert.equal(test.observations.length, active ? 1 : 0, `${spotify} / ${spicetify}`);
}

for (const [theme, setting, neutralised, active] of [
  ["Vantagraph", null, false, false],
  ["Vantagraph", "true", false, false],
  ["Vantagraph", "false", false, true],
  ["marketplace", null, true, false],
] as const) {
  const test = fixture("1.3.0.277", "2.45.1", theme, setting, neutralised);
  test.run();
  assert.equal(test.observations.length, active ? 1 : 0);
}

const test = fixture("1.3.0.277", "2.45.1");
test.run();
test.run();
assert.equal(test.observations.length, 1, "Repeated startup does not install duplicate observers");
assert.equal(test.observations[0].target, test.root);
assert.equal(JSON.stringify(test.observations[0].options), '{"childList":true,"subtree":true}');
for (const element of [test.root, test.head, test.body]) {
  assert.equal(element.attributes.get("data-scroll-optimized"), "true");
  assert.deepEqual(element.style, { transform: "translateX(12px)", willChange: "opacity" });
}
const row = new ElementFixture();
const word = new ElementFixture();
const detached = new ElementFixture();
detached.isConnected = false;
row.children.push(word);
test.body.children.push(row);
test.observations[0].callback(
  [{ addedNodes: [row, detached, { nodeType: 3 }] }] as unknown as MutationRecord[],
  {} as MutationObserver
);
await Promise.resolve();
assert.equal(row.attributes.get("data-scroll-optimized"), "true");
assert.equal(word.attributes.get("data-scroll-optimized"), "true");
assert.equal(detached.attributes.size, 0, "Removed nodes are not traversed");
assert.deepEqual(row.style, { transform: "translateX(12px)", willChange: "opacity" });
console.log("scrollFixGuard: version boundaries, theme coexistence and subtree tagging verified");
