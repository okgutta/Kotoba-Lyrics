/** A catalogue miss is temporary; positive lyrics keep their normal lifetime. */
export const NEGATIVE_LYRICS_TTL_MS = 5 * 60 * 1000;

export function hasFreshLyricsMiss(
  entry: { notFound?: boolean; notFoundCachedAt?: number } | undefined,
  now = Date.now()
): boolean {
  const cachedAt = entry?.notFoundCachedAt;
  return (
    entry?.notFound === true &&
    typeof cachedAt === "number" &&
    Number.isFinite(cachedAt) &&
    cachedAt <= now &&
    now - cachedAt < NEGATIVE_LYRICS_TTL_MS
  );
}
