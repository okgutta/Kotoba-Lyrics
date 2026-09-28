import assert from "node:assert/strict";
import { hasFreshLyricsMiss, NEGATIVE_LYRICS_TTL_MS } from "./negativeLyricsCache.ts";

const now = 1_000_000;
assert.equal(hasFreshLyricsMiss({ notFound: true, notFoundCachedAt: now }, now), true);
assert.equal(
  hasFreshLyricsMiss({ notFound: true, notFoundCachedAt: now - NEGATIVE_LYRICS_TTL_MS + 1 }, now),
  true
);
for (const cachedAt of [undefined, NaN, Infinity, now + 1, now - NEGATIVE_LYRICS_TTL_MS]) {
  assert.equal(hasFreshLyricsMiss({ notFound: true, notFoundCachedAt: cachedAt }, now), false);
}
assert.equal(hasFreshLyricsMiss(undefined, now), false);
assert.equal(hasFreshLyricsMiss({ notFoundCachedAt: now }, now), false);
console.log("Negative lyrics cache expiry, legacy migration and invalid timestamps verified.");
