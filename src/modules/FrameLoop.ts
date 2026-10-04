// Preserve the local API while all per-frame tasks share the FPS cap.
export { onAnimationFrame as onFrame } from "../utils/AnimationFrameLoop.ts";
