import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

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
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuId = useId();
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileOpen]);

  const accountLabel = userEmail.trim() || "Signed-in user";
  const accountInitial = accountLabel.charAt(0).toUpperCase();

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
          <span className="app-nav__mark" aria-hidden="true">
            <span className="app-nav__mark-core" />
            <span className="app-nav__mark-ring" />
          </span>
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

        <div className="app-nav__profile" ref={profileRef}>
          <button
            type="button"
            className="app-nav__profile-button"
            aria-expanded={profileOpen}
            aria-controls={profileMenuId}
            aria-haspopup="menu"
            onClick={() => setProfileOpen((open) => !open)}
          >
            <span className="app-nav__avatar" aria-hidden="true">
              {accountInitial}
            </span>
            <span className="app-nav__profile-label">Account</span>
          </button>

          {profileOpen ? (
            <div className="app-nav__menu" id={profileMenuId} role="menu">
              <div className="app-nav__menu-header">
                <span className="app-nav__menu-eyebrow">Signed in as</span>
                <strong>{accountLabel}</strong>
              </div>
              <button
                type="button"
                className="app-nav__menu-item"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false);
                  void onSignOut();
                }}
              >
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="signed-in-shell__content">{children}</main>
    </div>
  );
}
