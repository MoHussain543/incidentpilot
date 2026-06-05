import type { ReactNode } from "react";
import AccountMenu from "./AccountMenu";
import ProductMark from "./ProductMark";

export type AppView = "analysis" | "reports";

type AppShellProps = {
  activeView: AppView;
  userEmail: string;
  onNavigate: (view: AppView) => void;
  onSignOut: () => void;
  children: ReactNode;
};

export default function AppShell({
  activeView,
  userEmail,
  onNavigate,
  onSignOut,
  children
}: AppShellProps) {
  return (
    <div className="signed-in-shell">
      <div className="signed-in-shell__backdrop signed-in-shell__backdrop--grid" aria-hidden="true" />
      <div className="signed-in-shell__backdrop signed-in-shell__backdrop--glow" aria-hidden="true" />

      <header className="app-nav">
        <button
          className="app-nav__brand"
          type="button"
          onClick={() => onNavigate("analysis")}
        >
          <ProductMark />
          <span className="app-nav__name">IncidentPilot</span>
        </button>

        <nav className="app-nav__links" aria-label="Workspace">
          <button
            type="button"
            className={`app-nav__link${activeView === "analysis" ? " app-nav__link--active" : ""}`}
            aria-current={activeView === "analysis" ? "page" : undefined}
            onClick={() => onNavigate("analysis")}
          >
            New Analysis
          </button>
          <button
            type="button"
            className={`app-nav__link${activeView === "reports" ? " app-nav__link--active" : ""}`}
            aria-current={activeView === "reports" ? "page" : undefined}
            onClick={() => onNavigate("reports")}
          >
            Reports
          </button>
        </nav>

        <AccountMenu
          userEmail={userEmail}
          activeView={activeView}
          onNavigate={onNavigate}
          onSignOut={onSignOut}
        />
      </header>

      <main className="signed-in-shell__content page-enter">{children}</main>
    </div>
  );
}
