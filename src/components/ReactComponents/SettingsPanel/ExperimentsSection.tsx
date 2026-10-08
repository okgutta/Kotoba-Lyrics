import { useStore } from "@nanostores/react";
import { $experiment, EXPERIMENTS, type RegisteredExperiment } from "../../../utils/experiments.ts";
import { matches, Row, Section, Toggle } from "./components.tsx";

const LABEL = "实验功能";
const DESCRIPTION = "尝试尚未完成的功能，如果不喜欢可以随时切换回旧行为。";
type ExperimentCategory = "appearance" | "advanced";

// 视觉实验按用途归入外观；未分类的新实验仍默认出现在高级。
const EXPERIMENT_CATEGORIES: Partial<Record<RegisteredExperiment["id"], ExperimentCategory>> = {
  newProgressBarStyling: "appearance",
};

interface Props {
  query: string;
  sectionFilter: string;
  category: ExperimentCategory;
}

/** 实验仍由注册表提供开关与持久化状态，只按用途分配设置入口。 */
export default function ExperimentsSection({ query, sectionFilter, category }: Props) {
  if (sectionFilter !== "All" && sectionFilter !== category) return null;

  const title = category === "appearance" ? "实验样式" : LABEL;
  const groupMatches = matches(query, `${LABEL} ${title}`, DESCRIPTION);
  const visibleExperiments = EXPERIMENTS.filter(
    (exp) =>
      (EXPERIMENT_CATEGORIES[exp.id] ?? "advanced") === category &&
      (groupMatches || matches(query, exp.label, exp.description))
  );
  if (visibleExperiments.length === 0) return null;

  return (
    <Section
      title={title}
      className={category === "appearance" ? "sl-sp-section--appearance" : undefined}
    >
      {visibleExperiments.map((exp) => (
        <ExperimentRow key={exp.id} experiment={exp} />
      ))}
    </Section>
  );
}

function ExperimentRow({ experiment }: { experiment: RegisteredExperiment }) {
  const store = $experiment(experiment.id);
  const enabled = useStore(store);

  return (
    <Row label={experiment.label} description={experiment.description}>
      <Toggle checked={enabled} onChange={(v) => store.set(v)} />
    </Row>
  );
}
