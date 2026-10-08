import { useStore } from "@nanostores/react";
import {
  $showNpvDynamicBg,
  $staticBackgroundBlur,
  $staticBackgroundMode,
} from "../../../utils/stores.ts";
import { matches, Row, Section, Select, Slider, Toggle } from "./components.tsx";

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
  const r3 =
    (blurApplies || query.trim().length > 0) && matches(query, "背景模糊", "柔化静态背景图片。");

  if (!r1 && !r2 && !r3) return null;

  return (
    <Section title="背景" className="sl-sp-section--appearance sl-sp-section--background">
      {r1 && (
        <Row label="背景模式">
          <Select
            value={staticBackgroundMode}
            options={bgModeOptions}
            labels={bgModeLabels}
            onChange={(v) => $staticBackgroundMode.set(v)}
          />
        </Row>
      )}

      {r3 && (
        <Row
          label="背景模糊"
          disabled={!blurApplies}
          disabledReason="选择自动、艺人头图或封面背景后可调节"
        >
          <Slider
            value={staticBackgroundBlur}
            min={0}
            // 视觉上限：更大的模糊值几乎不再改变观感
            max={67}
            step={1}
            defaultValue={0}
            unit="px"
            onChange={(v) => $staticBackgroundBlur.set(v)}
            disabled={!blurApplies}
          />
        </Row>
      )}

      {r2 && (
        <Row label="播放面板动态背景">
          <Toggle checked={showNpvDynamicBg} onChange={(v) => $showNpvDynamicBg.set(v)} />
        </Row>
      )}
    </Section>
  );
}
