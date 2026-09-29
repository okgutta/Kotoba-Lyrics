import { ProjectName } from "../../../project/config.ts";
import type { UpdateState } from "../../updater/contracts.ts";
import DetailShell from "./SettingsPanel/DetailShell.tsx";
import UpdateReleaseNotes from "./UpdateReleaseNotes.tsx";

interface Props {
  state: UpdateState;
  automaticUpdates: boolean;
  onCheck: () => void;
  onRetry: () => void;
  onReload: () => void;
  onClose: () => void;
  onBack?: () => void;
}
const RELEASES_URL = "https://github.com/okgutta/Kotoba-Lyrics/releases/latest";
function releaseLink(value?: string): string {
  if (!value) return RELEASES_URL;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "github.com" &&
      url.pathname.startsWith("/okgutta/Kotoba-Lyrics/releases/")
      ? url.href
      : RELEASES_URL;
  } catch {
    return RELEASES_URL;
  }
}
export default function UpdatePanel({
  state,
  automaticUpdates,
  onCheck,
  onRetry,
  onReload,
  onClose,
  onBack,
}: Props) {
  const { phase, latestVersion, loaderUpdateRequired } = state;
  const required = Boolean(state.updateRequired);
  const pending = Boolean(latestVersion && latestVersion !== state.currentVersion);
  const manual = !automaticUpdates || Boolean(loaderUpdateRequired);
  const busy = phase === "checking" || phase === "downloading" || phase === "available";
  const progress =
    typeof state.progress === "number" && Number.isFinite(state.progress)
      ? Math.max(0, Math.min(100, state.progress))
      : undefined;
  const title = required
    ? "更新后继续使用歌词"
    : manual
      ? loaderUpdateRequired
        ? "需要手动更新加载器"
        : "手动更新 " + ProjectName
      : phase === "ready"
        ? "新版本已就绪"
        : phase === "downloading"
          ? "正在下载更新"
          : phase === "available"
            ? "发现新版本"
            : phase === "checking"
              ? "正在检查更新"
              : phase === "error"
                ? "更新未完成"
                : "已是最新版本";
  const description = manual
    ? "下载 kotoba-lyrics.js，按发布页说明停用旧文件并启用新文件，再运行 spicetify apply。"
    : phase === "ready"
      ? required
        ? "更新已下载并校验，重新加载后即可恢复歌词功能。"
        : "更新已下载并校验，重新加载后生效，也可以留到下次启动。"
      : phase === "downloading" || phase === "available"
        ? required
          ? "正在下载更新，Spotify 播放不受影响。"
          : "正在后台下载，Spotify 播放不受影响。"
        : phase === "checking"
          ? "正在获取最新版本信息。"
          : phase === "error"
            ? state.error || "暂时无法连接更新服务，请稍后重试。"
            : required
              ? "检查更新或前往发布页手动安装新版。"
              : "发现新版后自动下载，下次启动时生效。";
  const secondary = required
    ? "暂时停用歌词"
    : phase === "ready" && !manual
      ? "下次启动生效"
      : busy && phase !== "checking" && !manual
        ? "后台下载"
        : "关闭";
  const showSecondary =
    required ||
    (!manual && (phase === "ready" || phase === "downloading" || phase === "available"));
  const notes = state.notes?.trim();
  const actions = (
    <>
      <a
        className="sl-sp-update-link"
        href={releaseLink(state.releaseUrl)}
        target="_blank"
        rel="noopener noreferrer"
      >
        发布说明 ↗
      </a>
      <div className="sl-sp-inline-controls sl-sp-detail-actions">
        {showSecondary && (
          <button type="button" className="sl-sp-btn sl-sp-update-later" onClick={onClose}>
            {secondary}
          </button>
        )}
        {manual ? (
          <a
            className="sl-sp-btn sl-sp-btn--primary"
            href={releaseLink(state.releaseUrl)}
            target="_blank"
            rel="noopener noreferrer"
          >
            下载新版
          </a>
        ) : phase === "ready" ? (
          <button type="button" className="sl-sp-btn sl-sp-btn--primary" onClick={onReload}>
            {required ? "更新并重新加载" : "立即重新加载"}
          </button>
        ) : phase === "error" ? (
          <button type="button" className="sl-sp-btn sl-sp-btn--primary" onClick={onRetry}>
            重试
          </button>
        ) : busy ? (
          <button type="button" className="sl-sp-btn sl-sp-btn--primary" disabled aria-busy="true">
            {phase === "checking" ? "正在检查…" : "正在下载…"}
          </button>
        ) : (
          <button type="button" className="sl-sp-btn sl-sp-btn--primary" onClick={onCheck}>
            检查更新
          </button>
        )}
      </div>
    </>
  );
  return (
    <DetailShell
      title="版本与更新"
      onBack={onBack ?? onClose}
      actions={actions}
      className="sl-sp-update-page"
    >
      <section className="sl-sp-update-summary" aria-label={`${ProjectName} 版本信息`}>
        <p className="sl-sp-update-product">{pending ? "可用更新" : "当前安装"}</p>
        <div className="sl-sp-update-versions" aria-label="当前与可更新版本">
          <span
            className={"sl-sp-update-version" + (pending ? " sl-sp-update-version--previous" : "")}
            aria-label={`当前版本 v${state.currentVersion}`}
          >
            v{state.currentVersion}
          </span>
          {pending && (
            <>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M4 10h12m-5-5 5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="sl-sp-update-version" aria-label={`可更新版本 v${latestVersion}`}>
                v{latestVersion}
              </span>
            </>
          )}
        </div>
        <div
          className="sl-sp-update-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-attention={required || phase === "error" ? "true" : undefined}
        >
          <p className="sl-sp-update-status-title">{title}</p>
          <p
            className={
              "sl-sp-update-description" +
              (phase === "error" && !manual ? " sl-sp-update-error" : "")
            }
          >
            {description}
          </p>
        </div>
        {required && (
          <div className="sl-sp-update-required" role="note">
            <p>{state.updateReason || "当前版本已不再受支持，需要更新后才能继续使用歌词。"}</p>
            <p>最低支持 v{state.minimumSupportedVersion}。歌词已暂停，Spotify 播放不受影响。</p>
          </div>
        )}
        {!manual && busy && (
          <div className="sl-sp-update-progress">
            <progress
              aria-label={phase === "checking" ? "检查更新进度" : "更新下载进度"}
              max={100}
              value={phase === "downloading" ? progress : undefined}
            />
            {phase === "downloading" && progress !== undefined && (
              <span aria-hidden="true">{Math.round(progress)}%</span>
            )}
          </div>
        )}
      </section>
      <section className="sl-sp-update-changelog" aria-label="更新内容">
        <h3 className="sl-sp-update-changelog-title">
          {pending || notes ? "本次更新" : "更新说明"}
        </h3>
        {notes ? (
          <div className="sl-sp-update-notes">
            <UpdateReleaseNotes notes={notes} />
          </div>
        ) : (
          <p className="sl-sp-update-empty">
            {pending
              ? "此版本暂未提供更新内容，可在发布说明中查看详情。"
              : "新版本发布后，更新内容会显示在这里。"}
          </p>
        )}
      </section>
    </DetailShell>
  );
}
