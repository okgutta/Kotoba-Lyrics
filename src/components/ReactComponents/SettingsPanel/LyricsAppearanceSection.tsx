import { useStore } from "@nanostores/react";
import {
  $lyricsFontScale,
  $lyricsLineSpacing,
  $lyricsTranslationPosition,
  $lyricsTranslationSize,
} from "../../../utils/Lyrics/readingPreferences.ts";
import {
  $lineHoverBackground,
  $lyricsTranslationDisplay,
  $minimalLyricsMode,
  $simpleLyricsMode,
  $simpleLyricsModeRenderingType,
  $skipSpicyFont,
} from "../../../utils/stores.ts";
import { matches, NumberStepper, Row, Section, SegmentedControl, Toggle } from "./components.tsx";

const renderingTypeOptions = ["calculate", "animate"];
const renderingTypeLabels = ["逐字计算", "补间动画"];
const translationDisplayOptions = ["original", "translated", "bilingual"];
const translationDisplayLabels = ["仅原文", "仅译文", "双语"];
const translationPositionOptions = ["above", "below"];
const translationPositionLabels = ["原文上方", "原文下方"];

interface Props {
  query: string;
  sectionFilter: string;
}

export default function LyricsAppearanceSection({ query, sectionFilter }: Props) {
  const simpleLyricsMode = useStore($simpleLyricsMode);
  const simpleLyricsModeRenderingType = useStore($simpleLyricsModeRenderingType);
  const minimalLyricsMode = useStore($minimalLyricsMode);
  const lineHoverBackground = useStore($lineHoverBackground);
  const skipSpicyFont = useStore($skipSpicyFont);
  const lyricsTranslationDisplay = useStore($lyricsTranslationDisplay);
  const lyricsFontScale = useStore($lyricsFontScale);
  const lyricsTranslationSize = useStore($lyricsTranslationSize);
  const lyricsLineSpacing = useStore($lyricsLineSpacing);
  const lyricsTranslationPosition = useStore($lyricsTranslationPosition);
  const translationLayoutDisabled = lyricsTranslationDisplay !== "bilingual";

  if (sectionFilter !== "All" && sectionFilter !== "appearance") return null;

  const readingQuery = matches(query, "阅读排版 字体与排版 歌词布局") ? "" : query;
  const effectsQuery = matches(query, "歌词效果 视觉效果") ? "" : query;
  const rSystemFont = matches(
    readingQuery,
    "使用系统字体",
    "不加载 Kotoba Lyrics 内置字体，跟随 Spotify 当前字体。"
  );
  const rDisplay = matches(
    readingQuery,
    "显示语言 译文显示模式",
    "同时显示原文与译文、只显示原文，或只显示译文（无译文的行仍显示原文）。"
  );
  const rFontScale = matches(
    readingQuery,
    "歌词字号 原文字号 正文字号 歌词字体大小",
    "缩放歌词文字。"
  );
  const rTranslationSize = matches(
    readingQuery,
    "译文大小 译文字号 翻译字体大小",
    "双语显示时，译文相对于原文的字号比例。"
  );
  const rTranslationPosition = matches(
    readingQuery,
    "译文位置 翻译位置 原文上方 原文下方",
    "双语显示时，译文显示在原文上方或下方。"
  );
  const rLineSpacing = matches(readingQuery, "歌词行距 歌词行间距 行距", "调整歌词行之间的距离。");
  const rSimple = matches(effectsQuery, "简化歌词效果 简洁歌词模式", "移除歌词的额外视觉效果");
  const rTransition =
    (simpleLyricsMode || query.trim().length > 0) &&
    matches(
      effectsQuery,
      "文字过渡 简洁模式：文字动画样式",
      "简化歌词效果下歌词文字的过渡渲染方式。"
    );
  const rMinimal = matches(
    effectsQuery,
    "隐藏已唱歌词 极简歌词模式",
    "在全屏和影院模式下隐藏已演唱的歌词行"
  );
  const rHover = matches(effectsQuery, "歌词行悬停背景", "鼠标悬停歌词行时，在其后方显示高亮框");
  const readingVisible =
    rSystemFont ||
    rDisplay ||
    rFontScale ||
    rTranslationSize ||
    rTranslationPosition ||
    rLineSpacing;
  const effectsVisible = rSimple || rTransition || rMinimal || rHover;

  if (!readingVisible && !effectsVisible) return null;

  return (
    <>
      {readingVisible && (
        <Section title="阅读排版" className="sl-sp-section--appearance sl-sp-section--reading">
          {rSystemFont && (
            <Row label="使用系统字体">
              <Toggle checked={skipSpicyFont} onChange={(v) => $skipSpicyFont.set(v)} />
            </Row>
          )}
          {rFontScale && (
            <Row label="歌词字号">
              <NumberStepper
                value={lyricsFontScale}
                min={80}
                max={140}
                step={5}
                defaultValue={100}
                unit="%"
                onChange={(v) => $lyricsFontScale.set(v)}
              />
            </Row>
          )}
          {rLineSpacing && (
            <Row label="歌词行距">
              <NumberStepper
                value={lyricsLineSpacing}
                min={75}
                max={160}
                step={5}
                defaultValue={100}
                unit="%"
                onChange={(v) => $lyricsLineSpacing.set(v)}
              />
            </Row>
          )}
          {rDisplay && (
            <Row label="显示语言">
              <SegmentedControl
                value={lyricsTranslationDisplay}
                options={translationDisplayOptions}
                labels={translationDisplayLabels}
                onChange={(v) =>
                  $lyricsTranslationDisplay.set(v as typeof lyricsTranslationDisplay)
                }
              />
            </Row>
          )}
          {rTranslationSize && (
            <Row
              label="译文大小"
              description={translationLayoutDisabled ? undefined : "相对原文"}
              disabled={translationLayoutDisabled}
              disabledReason="双语显示时可调节"
            >
              <NumberStepper
                value={lyricsTranslationSize}
                min={35}
                max={100}
                step={1}
                defaultValue={58}
                unit="%"
                onChange={(v) => {
                  if (!translationLayoutDisabled) $lyricsTranslationSize.set(v);
                }}
                disabled={translationLayoutDisabled}
              />
            </Row>
          )}
          {rTranslationPosition && (
            <Row
              label="译文位置"
              disabled={translationLayoutDisabled}
              disabledReason="双语显示时可调节"
            >
              <SegmentedControl
                value={lyricsTranslationPosition}
                options={translationPositionOptions}
                labels={translationPositionLabels}
                onChange={(v) =>
                  $lyricsTranslationPosition.set(v as typeof lyricsTranslationPosition)
                }
                disabled={translationLayoutDisabled}
              />
            </Row>
          )}
        </Section>
      )}

      {effectsVisible && (
        <Section title="歌词效果" className="sl-sp-section--appearance">
          {rSimple && (
            <Row label="简化歌词效果">
              <Toggle checked={simpleLyricsMode} onChange={(v) => $simpleLyricsMode.set(v)} />
            </Row>
          )}
          {rTransition && (
            <Row
              label="文字过渡"
              nested
              disabled={!simpleLyricsMode}
              disabledReason="开启简化歌词效果后可用"
            >
              <SegmentedControl
                value={simpleLyricsModeRenderingType}
                options={renderingTypeOptions}
                labels={renderingTypeLabels}
                onChange={(v) => $simpleLyricsModeRenderingType.set(v)}
                disabled={!simpleLyricsMode}
              />
            </Row>
          )}
          {rMinimal && (
            <Row label="隐藏已唱歌词" description="仅在全屏与影院模式下生效。">
              <Toggle checked={minimalLyricsMode} onChange={(v) => $minimalLyricsMode.set(v)} />
            </Row>
          )}
          {rHover && (
            <Row label="歌词行悬停背景">
              <Toggle checked={lineHoverBackground} onChange={(v) => $lineHoverBackground.set(v)} />
            </Row>
          )}
        </Section>
      )}
    </>
  );
}
