import { ProjectArtifactName, ProjectName } from "../../project/config.ts";

type MarketplaceCache = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
const LEGACY_REPO = "okgutta/lyrivaMusic";
const CURRENT_REPO = "okgutta/Kotoba-Lyrics";
const INSTALL_URL = `https://github.com/${CURRENT_REPO}/releases/latest/download/${ProjectArtifactName}.js`;

/** Only invalidate our Marketplace catalog cache, never installed records or user settings.
 * Keys follow spicetify/marketplace src/logic/FetchRemotes.ts. */
export function refreshMarketplaceNameCache(storage?: MarketplaceCache): void {
  try {
    const cache = storage ?? window.sessionStorage;
    cache.removeItem("okgutta-lyrivaMusic");
    const cached = cache.getItem("okgutta-Kotoba-Lyrics");
    if (cached !== null) {
      let fresh = false;
      try {
        const value: unknown = JSON.parse(cached);
        fresh =
          Array.isArray(value) &&
          value.length > 0 &&
          value.every((item) => item?.name === ProjectName && item?.main === INSTALL_URL);
      } catch {
        /* The malformed entry belongs only to our own manifest. */
      }
      if (!fresh) cache.removeItem("okgutta-Kotoba-Lyrics");
    }
    const keys = Array.from({ length: cache.length }, (_, index) => cache.key(index));
    for (const key of keys) {
      if (!key || !/^spicetify-extensions-page-[0-9]+$/.test(key)) continue;
      try {
        const page = JSON.parse(cache.getItem(key) ?? "null");
        if (
          Array.isArray(page?.items) &&
          page.items.some(
            (item: { full_name?: unknown }) =>
              typeof item?.full_name === "string" &&
              item.full_name.toLowerCase() === LEGACY_REPO.toLowerCase()
          )
        )
          cache.removeItem(key);
      } catch {
        /* Leave unrelated or unknown cache formats untouched. */
      }
    }
    try {
      const value: unknown = JSON.parse(cache.getItem("noManifests") ?? "null");
      if (Array.isArray(value)) {
        const ownUrls = [LEGACY_REPO, CURRENT_REPO].map(
          (repo) => `https://raw.githubusercontent.com/${repo}/main/manifest.json`
        );
        const kept = value.filter((item) => !ownUrls.includes(item));
        if (kept.length !== value.length) cache.setItem("noManifests", JSON.stringify(kept));
      }
    } catch {
      /* A broken shared cache must not affect app startup. */
    }
  } catch {
    /* Session storage can be disabled; lyrics must remain usable. */
  }
}
