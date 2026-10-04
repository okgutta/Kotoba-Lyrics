/// <reference types="node" />
import assert from "node:assert/strict";
import type * as Esbuild from "esbuild";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { build } = createRequire(import.meta.url)("esbuild") as typeof Esbuild;
const calls: unknown[][] = [];
const fixture = {
  virtual: true,
  compact: true,
  lines: [{ StartTime: 0, EndTime: 5000, Status: "Active", HTMLElement: {} }],
  scroll: (...args: unknown[]) => calls.push(args),
};
const bundle = await build({
  stdin: {
    contents: `export * from "./src/utils/Scrolling/ScrollToActiveLine.ts";
      export { setPip } from "./src/components/Utils/PopupLyrics.ts";`,
    resolveDir: resolve("."),
  },
  bundle: true,
  write: false,
  platform: "node",
  target: "node22",
  format: "esm",
  plugins: [
    {
      name: "scroll-host-fixture",
      setup(builder) {
        builder.onResolve(
          {
            filter:
              /\/(stores|SpotifyPlayer|PageView|CompactMode|PopupLyrics|lyrics|Center|Top|LyricsVirtualizer)\.ts$/,
          },
          (args) => ({ path: args.path.split("/").pop()!, namespace: "scroll-fixture" })
        );
        builder.onLoad({ filter: /.*/, namespace: "scroll-fixture" }, (args) => {
          const modules: Record<string, string> = {
            "stores.ts": `export const $currentLyricsType={get:()=>"Syllable"}; export const $lyricsContainerExists={get:()=>true};`,
            "SpotifyPlayer.ts": `export const SpotifyPlayer={GetPosition:()=>1000,IsPlaying:true};`,
            "PageView.ts": `export const PageContainer=null;`,
            "CompactMode.ts": `export const IsCompactMode=()=>f.compact;`,
            "PopupLyrics.ts": `export let IsPIP=true; export const setPip=(value)=>{IsPIP=value};`,
            "lyrics.ts": `export const LyricsObject={Types:{Syllable:{Lines:f.lines}}};`,
            "Center.ts": `export const ScrollIntoCenterViewCSS=(...args)=>f.scroll("center",...args);`,
            "Top.ts": `export const ScrollIntoTopViewCSS=(...args)=>f.scroll("top",...args);`,
            "LyricsVirtualizer.ts": `export const getLyricsVirtualizer=()=>f.virtual?{}:null; export const scrollLyricsToIndex=(...args)=>f.scroll("virtual",...args);`,
          };
          return {
            contents: `const f=globalThis.__scrollFixture; ${modules[args.path]}`,
            loader: "js",
          };
        });
      },
    },
  ],
});
const previous = new Map(
  ["window", "ResizeObserver", "__scrollFixture"].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ])
);
for (const [key, value] of Object.entries({
  window: { addEventListener() {}, removeEventListener() {} },
  ResizeObserver: class {
    observe() {}
    disconnect() {}
  },
  __scrollFixture: fixture,
}))
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
try {
  const app = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
  );
  const container = { clientHeight: 80 };
  const scroll = () => {
    app.ResetLastLine();
    calls.length = 0;
    app.ScrollToActiveLine({ getScrollElement: () => container });
    return calls[0];
  };
  assert.deepEqual(
    scroll(),
    ["virtual", 0, "start", true, -16],
    "A short popup keeps the active line inside its shrinking mask"
  );
  container.clientHeight = 500;
  assert.deepEqual(
    scroll(),
    ["virtual", 0, "start", true, -50],
    "Normal popups preserve the previous anchor"
  );
  fixture.virtual = false;
  container.clientHeight = 100;
  assert.deepEqual(
    scroll(),
    ["top", container, fixture.lines[0].HTMLElement, 20, true],
    "Non-virtual popup scrolling uses the same offset"
  );
  app.setPip(false);
  assert.equal(scroll()[3], 85, "Compact main-window scrolling is unchanged");
  fixture.compact = false;
  assert.deepEqual(scroll(), ["center", container, fixture.lines[0].HTMLElement, -30, true]);
} finally {
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
}
console.log(
  "Scroll integration tests passed (short/default popup, virtual/non-virtual anchors, main-window modes)"
);
