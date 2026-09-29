/// <reference types="node" />
import assert from "node:assert/strict";
import { refreshMarketplaceNameCache } from "./marketplace.ts";

const values = new Map<string, string>([
  ["okgutta-lyrivaMusic", JSON.stringify([{ name: "lyrivaMusic" }])],
  [
    "okgutta-Kotoba-Lyrics",
    JSON.stringify([
      {
        name: "Kotoba Lyrics",
        main: "https://github.com/okgutta/Kotoba-Lyrics/releases/latest/download/lyrivamusic.js",
      },
    ]),
  ],
  [
    "spicetify-extensions-page-1",
    JSON.stringify({
      items: [{ full_name: "okgutta/lyrivaMusic" }, { full_name: "someone/other" }],
    }),
  ],
  ["spicetify-extensions-page-2", JSON.stringify({ items: [{ full_name: "someone/other" }] })],
  ["someone-other", "keep"],
  ["SL:settings", "keep"],
  ["marketplace:installed:example", "keep"],
  [
    "noManifests",
    JSON.stringify([
      "https://raw.githubusercontent.com/okgutta/Kotoba-Lyrics/main/manifest.json",
      "https://example.org/other.json",
    ]),
  ],
]);
const cache = {
  get length() {
    return values.size;
  },
  key: (index: number) => [...values.keys()][index] ?? null,
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    values.set(key, value);
  },
  removeItem: (key: string) => {
    values.delete(key);
  },
};
refreshMarketplaceNameCache(cache);
assert.equal(values.has("okgutta-lyrivaMusic"), false);
assert.equal(values.has("okgutta-Kotoba-Lyrics"), false);
assert.equal(values.has("spicetify-extensions-page-1"), false);
for (const key of [
  "spicetify-extensions-page-2",
  "someone-other",
  "SL:settings",
  "marketplace:installed:example",
])
  assert.equal(values.has(key), true, key);
assert.deepEqual(JSON.parse(values.get("noManifests")!), ["https://example.org/other.json"]);
const fresh = JSON.stringify([
  {
    name: "Kotoba Lyrics",
    main: "https://github.com/okgutta/Kotoba-Lyrics/releases/latest/download/kotoba-lyrics.js",
  },
]);
values.set("okgutta-Kotoba-Lyrics", fresh);
refreshMarketplaceNameCache(cache);
assert.equal(values.get("okgutta-Kotoba-Lyrics"), fresh, "Keep a fresh current-name manifest");
assert.doesNotThrow(() =>
  refreshMarketplaceNameCache({
    ...cache,
    getItem() {
      throw new Error("denied");
    },
  })
);
console.log("Marketplace rename cache refresh preserves installed entries and user settings");
