import type { ReactNode } from "react";

/** Shared settings detail frame: one navigation, scroll area and action footer. */
export default function DetailShell({
  title,
  onBack,
  children,
  actions,
  className = "",
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={"sl-sp-detail " + className}>
      <div className="sl-sp-detail-header">
        <button type="button" className="sl-sp-back-btn" onClick={onBack} aria-label="返回设置">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M8.5 2.5L4 7l4.5 4.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          设置
        </button>
      </div>
      <h2 className="sl-sp-detail-title">{title}</h2>
      <div className="sl-sp-detail-body">{children}</div>
      {actions && <div className="sl-sp-detail-footer">{actions}</div>}
    </div>
  );
}
