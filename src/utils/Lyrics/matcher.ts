// 歌词模型、曲目元数据与共享归一化工具。

import { normalizeText } from "../ncm/similarity.ts";

/** 置信度等级 */
export type MatchLevel = "HIGH" | "GOOD" | "UNCERTAIN" | "REJECT";

/** Spotify 目标曲目上下文（由 player 元数据归一化后传入） */
export interface TargetTrack {
  uri: string;
  title: string;
  artists: string[];
  album?: string;
  durationMs?: number;
  isrc?: string;
}

/** 歌词模型统一载荷：三态（Syllable/Line/Static），带翻译/罗马音/匹配信息等扩展字段 */
export type LyricsPayload = {
  Type: string;
  /** Line / Syllable 的 Vocal 组 */
  Content?: Array<{
    Type: string;
    Text?: string;
    StartTime?: number;
    EndTime?: number;
    Translation?: string;
    Lead?: {
      Syllables?: Array<{ Text?: string; IsPartOfWord?: boolean; [k: string]: unknown }>;
      [k: string]: unknown;
    };
    Background?: Array<{
      Syllables?: Array<{ Text?: string; [k: string]: unknown }>;
      [k: string]: unknown;
    }>;
    [k: string]: unknown;
  }>;
  /** Static 的行 */
  Lines?: Array<{ Text?: string; [k: string]: unknown }>;
  Language?: string;
  LanguageISO2?: string;
  HasTransliterations?: boolean;
  uri?: string;
  matchInfo?: unknown;
  [k: string]: unknown;
};

/** 轻量归一化：大小写 / NFKC / 零宽 / 标点→空格 / 连续空格→单个。保留词间空格。 */
export function normalizeTitle(raw: unknown): string {
  return String(raw || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ")
    .replace(/[‘’"“”]/g, "'")
    .replace(/[【】[\]()（）{}<>《》]/g, " ")
    .replace(/[.,:;!?、。，；！？…·・]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const ARTIST_SEPARATOR_RE =
  /\s*(?:featuring|feat\.?|ft\.?|with|\bvs\.?|\bversus\b|&|;|；|,|，|、|\/|\||·|\band\b|\b和\b)\s*/gi;

/** 艺人字符串拆分：清理括号内别名，供 LYRIVA 元数据归一化使用。 */
export function splitArtists(raw: string): string[] {
  const r = String(raw || "").trim();
  if (!r) return [];
  const stripped = r
    .replace(/[[(（【][^\]）)】]*[\])）】]/g, " ")
    .replace(/[[(（【\]）)】]/g, " ")
    .replace(ARTIST_SEPARATOR_RE, "|");
  return [
    ...new Set(
      stripped
        .split("|")
        .map((p) => normalizeText(p))
        .filter(Boolean)
    ),
  ];
}
