import { useStore } from "@nanostores/react";
import {
  $animationFpsCap,
  $animationFpsCapEnabled,
  $showNpvDynamicBg,
  $skipSpicyFont,
  $staticBackgroundBlur,
  $staticBackgroundMode,
} from "../../../utils/stores.ts";
import { matches, Row, Section, SegmentedControl, Slider, Toggle } from "./components.tsx";

const SECTION_NAME = "appearance";
const bgModeOptions = ["off", "auto", "artistHeader", "coverArt", "color"];
const bgModeLabels = ["动态", "自动", "艺人头图", "封面", "纯色"];

interface Props {
  query: string;
  sectionFilter: string;
}

export default function BackgroundSection({ query, sectionFilter }: Props) {
  const staticBackgroundMode = useStore($staticBackgroundMode);
  const staticBackgroundBlur = useStore($staticBackgroundBlur);
  const showNpvDynamicBg = useStore($showNpvDynamicBg);
  const skipSpicyFont = useStore($skipSpicyFont);
  const animationFpsCapEnabled = useStore($animationFpsCapEnabled);
  const animationFpsCap = useStore($animationFpsCap);

  if (sectionFilter !== "All" && sectionFilter !== SECTION_NAME) return null;

  const r1 = matches(
    query,
    "背景模式 静态背景",
    "动态 自动 艺人头图 封面 纯色 关闭静态背景后使用动态背景"
  );
  const r2 = matches(
    query,
    "播放面板动态背景 正在播放面板显示动态背景",
    "在正在播放面板中显示动画背景。"
  );
  const blurApplies = staticBackgroundMode !== "off" && staticBackgroundMode !== "color";
  const r3 = blurApplies && matches(query, "背景模糊", "柔化静态背景图片。");
  const r4 = matches(
    query,
    "使用系统字体",
    "不加载 Kotoba Lyrics 内置字体，跟随 Spotify 当前字体。"
  );

  const r5 = matches(query, "限制动画帧率 FPS", "限制歌词和动态背景的动画帧率，降低 CPU 占用。");

  if (!r1 && !r2 && !r3 && !r4 && !r5) return null;

  return (
    <Section>
      {r1 && (
        <Row label="背景模式" stacked>
          <SegmentedControl
            value={staticBackgroundMode}
            options={bgModeOptions}
            labels={bgModeLabels}
            onChange={(v) => $staticBackgroundMode.set(v)}
          />
        </Row>
      )}

      {r3 && (
        <Row label="背景模糊" stacked>
          <Slider
            value={staticBackgroundBlur}
            min={0}
            // 视觉上限：更大的模糊值几乎不再改变观感
            max={67}
            step={1}
            defaultValue={0}
            unit="px"
            onChange={(v) => $staticBackgroundBlur.set(v)}
          />
        </Row>
      )}

      {r2 && (
        <Row label="播放面板动态背景">
          <Toggle checked={showNpvDynamicBg} onChange={(v) => $showNpvDynamicBg.set(v)} />
        </Row>
      )}

      {r5 && (
        <>
          <Row label="限制动画帧率" description="限制歌词和动态背景的动画帧率，降低 CPU 占用。">
            <Toggle
              checked={animationFpsCapEnabled}
              onChange={(v) => $animationFpsCapEnabled.set(v)}
            />
          </Row>
          {animationFpsCapEnabled && (
            <Row label="动画帧率上限" nested stacked>
              <Slider
                value={animationFpsCap}
                min={15}
                max={240}
                step={1}
                defaultValue={60}
                unit="FPS"
                onChange={(v) => $animationFpsCap.set(v)}
              />
            </Row>
          )}
        </>
      )}

      {r4 && (
        <Row label="使用系统字体">
          <Toggle checked={skipSpicyFont} onChange={(v) => $skipSpicyFont.set(v)} />
        </Row>
      )}
    </Section>
  );
}
