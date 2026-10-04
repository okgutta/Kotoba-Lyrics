/// <reference types="node" />
import assert from "node:assert/strict";
import type * as Esbuild from "esbuild";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { atom } from "nanostores";
import type * as FrameLoop from "./AnimationFrameLoop.ts";
import type * as Intervals from "./IntervalManager.ts";
import type * as LegacyFrameLoop from "../modules/FrameLoop.ts";

const { build } = createRequire(import.meta.url)("esbuild") as typeof Esbuild;
const stores = {
  $animationFpsCapEnabled: atom(false),
  $animationFpsCap: atom(60),
  $developerMode: atom(false),
};
const bundle = await build({
  stdin: {
    contents: `export * from "./src/utils/AnimationFrameLoop.ts";
      export * from "./src/utils/IntervalManager.ts";
      export { onFrame } from "./src/modules/FrameLoop.ts";`,
    resolveDir: resolve("."),
  },
  bundle: true,
  write: false,
  platform: "node",
  target: "node22",
  format: "esm",
  plugins: [
    {
      name: "frame-loop-settings",
      setup(builder) {
        builder.onResolve({ filter: /\/stores(?:\.ts)?$/ }, () => ({
          path: "stores",
          namespace: "frame-fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "frame-fixture" }, () => ({
          contents: `export const { $animationFpsCapEnabled, $animationFpsCap, $developerMode } = globalThis.__frameLoopStores;`,
          loader: "js",
        }));
      },
    },
  ],
});
const frames = new Map<number, FrameRequestCallback>();
const intervals = new Map<number, { callback: () => void; duration: number }>();
let nextId = 1;
const previous = new Map(
  [
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "setInterval",
    "clearInterval",
    "__frameLoopStores",
  ].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
);
for (const [key, value] of Object.entries({
  requestAnimationFrame: (callback: FrameRequestCallback) => {
    const id = nextId++;
    frames.set(id, callback);
    return id;
  },
  cancelAnimationFrame: (id: number) => frames.delete(id),
  setInterval: (callback: () => void, duration: number) => {
    const id = nextId++;
    intervals.set(id, { callback, duration });
    return id;
  },
  clearInterval: (id: number) => intervals.delete(id),
  __frameLoopStores: stores,
}))
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const tick = (timestamp: number) => {
  assert.equal(frames.size, 1, "All workloads share one requestAnimationFrame");
  const due = [...frames.values()];
  frames.clear();
  due.forEach((callback) => callback(timestamp));
};

try {
  const app = (await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
  )) as typeof FrameLoop & typeof Intervals & typeof LegacyFrameLoop;
  assert.equal(frames.size, 0, "Importing the scheduler does not start an idle loop");
  const lyricFrames: number[] = [],
    backgroundFrames: number[] = [];
  const stopLyrics = app.onAnimationFrame((ts) => lyricFrames.push(ts));
  const stopBackground = app.onFrame((ts) => backgroundFrames.push(ts));
  for (let i = 0; i < 10; i++) tick((i * 1000) / 240);
  assert.equal(lyricFrames.length, 10, "The default setting does not cap animation");
  assert.deepEqual(lyricFrames, backgroundFrames);
  stores.$animationFpsCapEnabled.set(true);
  lyricFrames.length = backgroundFrames.length = 0;
  for (let i = 0; i < 144; i++) tick(1000 + (i * 1000) / 144);
  assert.ok(
    lyricFrames.length >= 59 && lyricFrames.length <= 61,
    "60 FPS averages correctly on a 144 Hz display"
  );
  assert.deepEqual(lyricFrames, backgroundFrames, "Background and lyrics repaint together");
  lyricFrames.length = 0;
  for (let i = 0; i < 60; i++) tick(3000 + (i * 1000) / 60 + (i % 2 ? -0.05 : 0.05));
  assert.equal(lyricFrames.length, 60, "Small vsync jitter does not halve frame rate");

  for (const [cap, refreshRate] of [
    [200, 240],
    [144, 165],
  ] as const) {
    stores.$animationFpsCap.set(cap);
    lyricFrames.length = backgroundFrames.length = 0;
    for (let i = 0; i < refreshRate * 5; i++) tick(5000 + (i * 1000) / refreshRate);
    assert.ok(
      Math.abs(lyricFrames.length - cap * 5) <= 1,
      `${cap} FPS on a ${refreshRate} Hz display retains phase debt after early frames`
    );
    assert.deepEqual(lyricFrames, backgroundFrames);
  }

  for (const [saved, expected] of [
    [1, 15],
    [500, 240],
    [NaN, 60],
  ] as const) {
    stores.$animationFpsCap.set(saved);
    lyricFrames.length = 0;
    for (let i = 0; i < 240; i++) tick(5000 + (i * 1000) / 240);
    assert.ok(Math.abs(lyricFrames.length - expected) <= 1, `Persisted cap ${saved} is validated`);
  }
  stopLyrics();
  stopBackground();
  assert.equal(frames.size, 0, "The last unsubscribe cancels idle work");

  const originalError = console.error;
  let errors = 0;
  let healthyFrames = 0;
  console.error = () => {
    errors++;
  };
  const stopThrowing = app.onAnimationFrame(() => {
    throw new Error("Fixture subscriber error");
  });
  const stopHealthy = app.onAnimationFrame(() => healthyFrames++);
  try {
    tick(8000);
    tick(9000);
    assert.equal(
      healthyFrames,
      2,
      "A failed subscriber cannot stop other animations or later frames"
    );
    assert.equal(errors, 2);
  } finally {
    stopThrowing();
    stopHealthy();
    console.error = originalError;
  }

  const seen: string[] = [];
  const cancelled = app.requestCappedFrame(() => seen.push("cancelled"));
  app.cancelCappedFrame(cancelled);
  assert.equal(frames.size, 0);
  app.requestCappedFrame(() => {
    seen.push("first");
    app.requestCappedFrame(() => seen.push("next"));
  });
  tick(10000);
  assert.deepEqual(seen, ["first"], "Work scheduled by a callback waits one rendered frame");
  tick(10001);
  assert.deepEqual(seen, ["first"]);
  tick(10017);
  assert.deepEqual(seen, ["first", "next"]);
  assert.equal(frames.size, 0);

  let pollCount = 0;
  const poller = new app.IntervalManager(Infinity, () => pollCount++);
  poller.Start();
  tick(11000);
  tick(11001);
  tick(11017);
  assert.equal(pollCount, 2, "Every-frame polling obeys the same cap");
  for (let i = 0; i < 20; i++) poller.Restart();
  tick(12000);
  assert.equal(pollCount, 3, "Restart does not duplicate poll subscribers");
  poller.Destroy();
  assert.equal(frames.size, 0);
  assert.equal(poller.Destroyed, true);
  const timed = new app.IntervalManager(2, () => pollCount++);
  timed.Start();
  assert.equal(frames.size, 0, "Real time intervals stay independent of rendering");
  const interval = [...intervals.values()][0];
  assert.equal(interval.duration, 2000);
  interval.callback();
  assert.equal(pollCount, 4);
  timed.Destroy();
  assert.equal(intervals.size, 0);

  let reentrantCalls = 0;
  const reentrantPoller = new app.IntervalManager(Infinity, () => {
    reentrantCalls++;
    // Bound the fixture so a regression fails safely instead of hanging tests.
    if (reentrantCalls < 5) reentrantPoller.Restart();
  });
  reentrantPoller.Start();
  tick(13000);
  assert.equal(reentrantCalls, 1, "Restart inside a callback must wait until a later frame");
  tick(13017);
  assert.equal(reentrantCalls, 2);
  reentrantPoller.Destroy();
  assert.equal(frames.size, 0);

  let removedSubscriberCalls = 0;
  const stopFirst = app.onAnimationFrame(() => stopSecond());
  const stopSecond = app.onAnimationFrame(() => removedSubscriberCalls++);
  tick(14000);
  assert.equal(
    removedSubscriberCalls,
    0,
    "Unsubscribing a later callback cancels it within this frame"
  );
  stopFirst();
} finally {
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
}
console.log(
  "Animation frame tests passed (shared cap, jitter, bounds, one-shot tasks, idle cleanup, interval lifecycle)"
);
