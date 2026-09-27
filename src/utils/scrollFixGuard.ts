// Backported from Spicy Lyrics 6.3.98. Spicetify <= 2.45.1 incorrectly runs
// applyScrollingFix on Spotify 1.3.x. Its body-wide observer scans unmarked
// elements with getComputedStyle after every lyric row insertion/removal.
// Tag new subtrees before the scan's queued microtask, without changing styles.
// Remove when our minimum Spicetify includes:
// https://github.com/spicetify/cli/commit/5cd0c6826594212ba1f992611b8f13c35b54d4f9

const MARKER = "data-scroll-optimized";
const SCAN_SELECTOR = `*:not([${MARKER}])`;
const LAST_AFFECTED_SPICETIFY = [2, 45, 1];
let observer: MutationObserver | null = null;

function parseVersion(value: string | undefined): number[] | null {
  const match = value?.match(/^(\d+)\.(\d+)\.(\d+)(?:\.|$)/);
  return match ? match.slice(1, 4).map(Number) : null;
}

function isAffected(): boolean {
  const spotify = parseVersion(Spicetify.Platform.version);
  const spicetify = parseVersion(Spicetify.Config?.version);
  // Unknown/dev versions are left alone; they may already include the fix.
  if (!spotify || !spicetify) return false;
  const releasedSkips = spotify[1] >= 2 && spotify[2] >= 57;
  const fixedSkips = (spotify[1] === 2 && spotify[2] >= 57) || spotify[1] > 2;
  if (!fixedSkips || releasedSkips) return false;
  for (let i = 0; i < 3; i++) {
    if (spicetify[i] !== LAST_AFFECTED_SPICETIFY[i]) {
      return spicetify[i] < LAST_AFFECTED_SPICETIFY[i];
    }
  }
  return true;
}

function tagSubtree(root: Element): void {
  if (!root.hasAttribute(MARKER)) root.setAttribute(MARKER, "true");
  for (const element of root.querySelectorAll(SCAN_SELECTOR)) {
    element.setAttribute(MARKER, "true");
  }
}

export function guardSpicetifyScrollingFix(): void {
  if (observer || !isAffected()) return;
  // Vantagraph neutralises the same scan, then clears inline transforms on
  // marked nodes at startup. Tagging everything first would break its cleanup.
  if (
    /vantagraph/i.test(Spicetify.Config?.current_theme ?? "") &&
    Spicetify.LocalStorage.get("vantagraph:wrapper-guard") !== "false"
  ) {
    return;
  }
  if (document.querySelectorAll(SCAN_SELECTOR).length === 0) return;

  observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element && node.isConnected) tagSubtree(node);
      }
    }
  });
  // Include <head>: the original scan queries the entire document.
  observer.observe(document.documentElement, { childList: true, subtree: true });
  tagSubtree(document.documentElement);
}
