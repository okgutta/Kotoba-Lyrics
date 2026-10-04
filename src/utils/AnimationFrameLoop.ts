import { $animationFpsCap, $animationFpsCapEnabled } from "./stores.ts";

/** Lyrics, backgrounds and scrolling repaint on the same capped frames. */
type FrameCallback = (timestamp: number) => void;
const callbacks = new Set<FrameCallback>();
const pending = new Map<number, FrameCallback>();
let nextPendingId = 1;
let frame: number | null = null;
let running = false;
let lastRender = -Infinity;

// Vsync jitter must not make a 60 FPS cap skip every other 60 Hz frame.
const FRAME_SLACK_MS = 1;
const computeFrameInterval = (): number => {
  if (!$animationFpsCapEnabled.get()) return 0;
  const saved = Number($animationFpsCap.get());
  const fps = Number.isFinite(saved) ? Math.min(240, Math.max(15, saved)) : 60;
  return 1000 / fps;
};
let frameInterval = computeFrameInterval();
const updateFrameInterval = () => {
  frameInterval = computeFrameInterval();
  lastRender = -Infinity;
};
$animationFpsCapEnabled.listen(updateFrameInterval);
$animationFpsCap.listen(updateFrameInterval);

const shouldRender = (timestamp: number): boolean => {
  if (frameInterval === 0) return true;
  const elapsed = timestamp - lastRender;
  if (elapsed < frameInterval - FRAME_SLACK_MS) return false;
  // An early frame borrows from the next interval. Advancing the ideal clock
  // preserves that debt; resetting to timestamp would turn 200 FPS into 240 FPS
  // when every display refresh falls within the 1 ms tolerance. Stalls reset it.
  lastRender = elapsed < frameInterval * 2 ? lastRender + frameInterval : timestamp;
  return true;
};

const run = (callback: FrameCallback, timestamp: number) => {
  try {
    callback(timestamp);
  } catch (err) {
    console.error("Kotoba Lyrics: animation frame callback failed", err);
  }
};

const loop = (timestamp: number) => {
  running = true;
  if (shouldRender(timestamp)) {
    // Capture first so work queued during this frame waits until the next one.
    const due = [...pending.keys()];
    const subscribers = [...callbacks];
    // Restarting/subscribing from a callback must not extend this same frame's
    // iteration indefinitely. Still honor an unsubscribe before its turn runs.
    for (const callback of subscribers) {
      if (callbacks.has(callback)) run(callback, timestamp);
    }
    for (const id of due) {
      const callback = pending.get(id);
      pending.delete(id);
      if (callback) run(callback, timestamp);
    }
  }
  running = false;
  frame = callbacks.size || pending.size ? requestAnimationFrame(loop) : null;
};

const start = () => {
  if (frame !== null) return;
  lastRender = -Infinity;
  frame = requestAnimationFrame(loop);
};
const stopIfIdle = () => {
  if (!running && frame !== null && callbacks.size === 0 && pending.size === 0) {
    cancelAnimationFrame(frame);
    frame = null;
  }
};

/** Subscribe until the returned cleanup is called; no subscribers means no idle loop. */
export function onAnimationFrame(callback: FrameCallback): () => void {
  callbacks.add(callback);
  start();
  return () => {
    callbacks.delete(callback);
    stopIfIdle();
  };
}

/** Schedule a one-shot callback on the next frame permitted by the cap. */
export function requestCappedFrame(callback: FrameCallback): number {
  const id = nextPendingId++;
  pending.set(id, callback);
  start();
  return id;
}

export function cancelCappedFrame(id: number): void {
  pending.delete(id);
  stopIfIdle();
}
