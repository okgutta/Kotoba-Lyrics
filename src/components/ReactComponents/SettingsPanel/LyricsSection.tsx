import { useStore } from "@nanostores/react";
import {
  $disableNpvLyrics,
  $hideNpvLyricsWhenUnavailable,
  $playbackOffset,
  $popupLyricsAllowed,
} from "../../../utils/stores.ts";
import { matches, Row, Section, Slider, Toggle } from "./components.tsx";

const SECTION_NAME = "lyrics-display";

interface Props {
  query: string;
  sectionFilter: string;
}

export default function LyricsSection({ query, sectionFilter }: Props) {
  const popupLyricsAllowed = useStore($popupLyricsAllowed);
  const hideNpvLyricsWhenUnavailable = useStore($hideNpvLyricsWhenUnavailable);
  const disableNpvLyrics = useStore($disableNpvLyrics);
  const playbackOffset = useStore($playbackOffset);

  if (sectionFilter !== "All" && sectionFilter !== SECTION_NAME) return null;

  const windowQuery = matches(query, "窗口与卡片") ? "" : query;
  const rPopup = matches(
    windowQuery,
    "弹出歌词窗口 禁用弹出歌词窗口",
    "开启或关闭桌面弹出歌词窗口功能。"
  );
  const rCard = matches(windowQuery, "正在播放歌词卡片", "在正在播放视图中显示或隐藏歌词。");
  const rHideUnavailable =
    (!disableNpvLyrics || query.trim().length > 0) &&
    matches(
      windowQuery,
      "无歌词时隐藏正在播放歌词卡片",
      "当前歌曲没有歌词时，隐藏正在播放视图的歌词卡片。"
    );
  const rSync = matches(
    query,
    "同步校准 歌词同步偏移 播放偏移",
    "以毫秒为单位提前或推迟歌词的时间轴。"
  );

  if (!rPopup && !rCard && !rHideUnavailable && !rSync) return null;

  return (
    <>
      {rSync && (
        <Section title="同步校准">
          <Row label="歌词同步偏移" description="负值提前，正值延后。" stacked>
            <Slider
              value={playbackOffset}
              min={-5000}
              max={5000}
              step={10}
              defaultValue={0}
              unit="ms"
              onChange={(v) => $playbackOffset.set(v)}
            />
          </Row>
        </Section>
      )}

      {(rPopup || rCard || rHideUnavailable) && (
        <Section title="窗口与卡片">
          {rPopup && (
            <Row label="弹出歌词窗口">
              <Toggle checked={popupLyricsAllowed} onChange={(v) => $popupLyricsAllowed.set(v)} />
            </Row>
          )}

          {rCard && (
            <Row label="正在播放歌词卡片">
              <Toggle checked={!disableNpvLyrics} onChange={(v) => $disableNpvLyrics.set(!v)} />
            </Row>
          )}

          {rHideUnavailable && (
            <Row
              label="无歌词时隐藏正在播放歌词卡片"
              nested
              disabled={disableNpvLyrics}
              disabledReason="正在播放歌词卡片已被禁用"
            >
              <Toggle
                checked={hideNpvLyricsWhenUnavailable}
                onChange={(v) => $hideNpvLyricsWhenUnavailable.set(v)}
                disabled={disableNpvLyrics}
              />
            </Row>
          )}
        </Section>
      )}
    </>
  );
}
