import { useEffect, useId, useRef, useState } from "react";
import type { AppView } from "./AppShell";

type AccountMenuProps = {
  userEmail: string;
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onSignOut: () => void;
};

export default function AccountMenu({ userEmail, activeView, onNavigate, onSignOut }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const accountEmail = userEmail.trim() || "Signed-in user";
  const accountInitial = accountEmail.charAt(0).toUpperCase();
  const displayEmail = formatDisplayEmail(accountEmail);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function navigateTo(view: AppView) {
    setOpen(false);
    onNavigate(view);
  }

  function handleSignOut() {
    setOpen(false);
    void onSignOut();
  }

  return (
    <div className="account-menu" ref={containerRef}>
      <button
        type="button"
        className={`account-menu__trigger${open ? " account-menu__trigger--open" : ""}`}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        aria-label={`Open account menu for ${accountEmail}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="account-menu__avatar" aria-hidden="true">
          {accountInitial}
        </span>
        <span className="account-menu__identity">
          <span className="account-menu__label">Account</span>
          <span className="account-menu__email">{displayEmail}</span>
        </span>
        <span className="account-menu__chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div className="account-menu__dropdown" id={menuId} role="menu" aria-label="Account menu">
          <div className="account-menu__header">
            <span className="account-menu__avatar account-menu__avatar--large" aria-hidden="true">
              {accountInitial}
            </span>
            <div className="account-menu__header-copy">
              <span className="account-menu__eyebrow">Signed in as</span>
              <strong className="account-menu__header-email">{accountEmail}</strong>
              <span className="account-menu__header-note">Personal workspace</span>
            </div>
          </div>

          <div className="account-menu__section" role="none">
            <p className="account-menu__section-label">Workspace</p>
            <button
              type="button"
              className={`account-menu__item${activeView === "analysis" ? " account-menu__item--active" : ""}`}
              role="menuitem"
              onClick={() => navigateTo("analysis")}
            >
              New Analysis
            </button>
            <button
              type="button"
              className={`account-menu__item${activeView === "reports" ? " account-menu__item--active" : ""}`}
              role="menuitem"
              onClick={() => navigateTo("reports")}
            >
              Reports
            </button>
          </div>

          <div className="account-menu__section account-menu__section--footer" role="none">
            <button
              type="button"
              className="account-menu__item account-menu__item--logout"
              role="menuitem"
              onClick={handleSignOut}
            >
              Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatDisplayEmail(email: string) {
  if (email === "Signed-in user") {
    return email;
  }

  const atIndex = email.indexOf("@");
  if (atIndex <= 0) {
    return email;
  }

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  const compactLocal = localPart.length > 14 ? `${localPart.slice(0, 12)}…` : localPart;
  const compactDomain = domain.length > 18 ? `${domain.slice(0, 16)}…` : domain;
  return `${compactLocal}@${compactDomain}`;
}
