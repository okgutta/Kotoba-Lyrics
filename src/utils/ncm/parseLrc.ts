// LRC 歌词解析（从网页脚本 parseLrc 移植）
// 支持：多时间戳一行、JSON 行 {"t":ms,"c":[{"tx":...}]}、百分秒（.12 -> 120ms, .123 -> 123ms）

export interface LrcRow {
  t: number; // ms
  text: string;
}

export function parseLrc(txt = ""): LrcRow[] {
  return txt
    .split(/\r?\n/)
    .flatMap((lineRaw) => {
      const line = String(lineRaw || "").trim();
      if (!line) return [];
      // 一行多时间戳：[00:10.00][00:20.00]text → 每个时间点一条
      const tsRe = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?]/g;
      const tsMatches = line.startsWith("[") ? [...line.matchAll(tsRe)] : [];
      if (tsMatches.length) {
        const text = line.replace(tsRe, "").trim();
        return tsMatches.map((m) => {
          const mm = m[1];
          const ss = m[2];
          const ff = m[3] ?? "0";
          const sub = ff.length === 3 ? +ff : ff.length === 2 ? +ff * 10 : +ff * 100;
          const t = +mm * 60000 + +ss * 1000 + sub;
          return { t, text };
        });
      }
      try {
        const obj = JSON.parse(line);
        if (Number.isFinite(obj?.t)) {
          // 兼容 {"t":ms,"c":[{"tx":...}]} 与 {"t":ms,"c":"..."}（c 为纯文本）
          const c = obj?.c;
          if (Array.isArray(c)) {
            return [{ t: +obj.t, text: c.map((x: { tx?: string }) => x?.tx || "").join("") }];
          }
          if (typeof c === "string" && c) {
            return [{ t: +obj.t, text: c }];
          }
        }
      } catch {
        // 非 JSON 行忽略
      }
      return [];
    })
    .sort((a, b) => a.t - b.t);
}
