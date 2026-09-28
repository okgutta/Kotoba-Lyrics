/** Decode text without interpreting HTML or adding encoded row boundaries. */
export function decodeLyricsEntities(value: string): string {
  return value
    .replace(/&(#x[0-9a-f]+|#\d+|nbsp|amp|quot|apos|lt|gt);/gi, (entity, name: string) => {
      const named: Record<string, string> = {
        nbsp: " ",
        amp: "&",
        quot: '"',
        apos: "'",
        lt: "<",
        gt: ">",
      };
      if (!name.startsWith("#")) return named[name.toLowerCase()] ?? entity;
      const code =
        name[1]?.toLowerCase() === "x"
          ? Number.parseInt(name.slice(2), 16)
          : Number.parseInt(name.slice(1), 10);
      if (
        !Number.isInteger(code) ||
        code < 0x20 ||
        code > 0x10ffff ||
        code === 0x2028 ||
        code === 0x2029 ||
        (code >= 0x7f && code <= 0x9f) ||
        (code >= 0xd800 && code <= 0xdfff)
      )
        return entity;
      return code === 0xa0 ? " " : String.fromCodePoint(code);
    })
    .replace(/\u00a0/g, " ");
}
