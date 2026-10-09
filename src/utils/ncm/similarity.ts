// 文本归一化：用于歌词元数据与缓存身份校验。

export function normalizeText(s: unknown): string {
  return String(s || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
