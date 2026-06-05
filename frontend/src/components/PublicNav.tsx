import ProductMark from "./ProductMark";

type PublicNavProps = {
  onSignIn: () => void;
  onSignUp: () => void;
  onHome?: () => void;
  active?: "landing" | "auth";
};

export default function PublicNav({ onSignIn, onSignUp, onHome, active = "landing" }: PublicNavProps) {
  return (
    <header className="public-nav">
      <a
        className="public-nav__brand"
        href="#top"
        onClick={(event) => {
          if (onHome) {
            event.preventDefault();
            onHome();
          }
        }}
      >
        <ProductMark animated />
        <span className="public-nav__name">IncidentPilot</span>
      </a>

      {active === "landing" ? (
        <nav className="public-nav__links" aria-label="Primary">
          <a className="public-nav__link" href="#top">
            Home
          </a>
          <a className="public-nav__link" href="#example">
            Example
          </a>
          <a className="public-nav__link" href="#compare">
            Why not chat?
          </a>
          <a className="public-nav__link" href="#included">
            Included
          </a>
        </nav>
      ) : (
        <p className="public-nav__auth-label">Account access</p>
      )}

      <div className="public-nav__actions">
        <button className="secondary-button secondary-button--compact" type="button" onClick={onSignIn}>
          Sign in
        </button>
        <button className="primary-button public-nav__cta" type="button" onClick={onSignUp}>
          Sign up
        </button>
      </div>
    </header>
  );
}
