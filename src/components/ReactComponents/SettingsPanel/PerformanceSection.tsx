import { useStore } from "@nanostores/react";
import { $animationFpsCap, $animationFpsCapEnabled } from "../../../utils/stores.ts";
import { matches, Row, Section, Slider, Toggle } from "./components.tsx";

interface Props {
  query: string;
  sectionFilter: string;
}

export default function PerformanceSection({ query, sectionFilter }: Props) {
  const animationFpsCapEnabled = useStore($animationFpsCapEnabled);
  const animationFpsCap = useStore($animationFpsCap);

  if (sectionFilter !== "All" && sectionFilter !== "advanced") return null;
  if (
    !matches(
      query,
      "性能 限制动画帧率 动画帧率上限 FPS",
      "限制歌词和动态背景的动画帧率，降低 CPU 占用。"
    )
  )
    return null;

  return (
    <Section title="性能">
      <Row label="限制动画帧率" description="限制歌词和动态背景的动画帧率，降低 CPU 占用。">
        <Toggle checked={animationFpsCapEnabled} onChange={(v) => $animationFpsCapEnabled.set(v)} />
      </Row>
      {(animationFpsCapEnabled || query.trim().length > 0) && (
        <Row
          label="动画帧率上限"
          nested
          stacked
          disabled={!animationFpsCapEnabled}
          disabledReason="开启限制动画帧率后可调节"
        >
          <Slider
            value={animationFpsCap}
            min={15}
            max={240}
            step={1}
            defaultValue={60}
            unit="FPS"
            onChange={(v) => $animationFpsCap.set(v)}
            disabled={!animationFpsCapEnabled}
          />
        </Row>
      )}
    </Section>
  );
}
