import { useStore } from "@nanostores/react";
import { $updateState } from "../../../updater/runtimeState.ts";
import { matches, NavigationRow, Section } from "./components.tsx";

export default function UpdateSection({
  query,
  sectionFilter,
  onOpenDetail,
  compact = false,
}: {
  query: string;
  sectionFilter: string;
  onOpenDetail: () => void;
  compact?: boolean;
}) {
  const state = useStore($updateState);
  if (sectionFilter !== "All" && sectionFilter !== "advanced") return null;
  if (!matches(query, "版本与更新", "检查更新 自动下载 重新加载 强制更新 最低版本")) return null;
  const pending = Boolean(state.latestVersion && state.latestVersion !== state.currentVersion);
  const shortVersion = state.currentVersion.split(".").slice(0, 2).join(".");
  const value = compact
    ? `v${shortVersion}`
    : pending
      ? `v${state.currentVersion} → v${state.latestVersion}`
      : `v${state.currentVersion}`;
  const description = state.updateRequired
    ? "歌词功能已暂停，请更新后继续使用"
    : state.loaderUpdateRequired
      ? "需要手动更新加载器"
      : state.phase === "error"
        ? "更新未完成，点击查看并重试"
        : state.phase === "ready"
          ? "更新已下载，下次启动自动生效"
          : state.phase === "downloading"
            ? "正在下载更新"
            : undefined;
  const indicator = pending || Boolean(state.updateRequired) || Boolean(state.loaderUpdateRequired);
  if (compact) {
    return (
      <button
        type="button"
        className="sl-sp-version-link"
        onClick={onOpenDetail}
        aria-label={`打开版本与更新，当前版本 ${value}${indicator ? "，有可用更新" : ""}`}
      >
        <span className="sl-sp-version-label">{value}</span>
        {indicator && <span className="sl-sp-version-dot" aria-hidden="true" />}
      </button>
    );
  }
  return (
    <Section>
      <NavigationRow
        label="版本与更新"
        value={value}
        description={description}
        onClick={onOpenDetail}
      />
    </Section>
  );
}
