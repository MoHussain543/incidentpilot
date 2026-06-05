import PublicNav from "./PublicNav";
import {
  ComparisonShowcase,
  ExampleIncidentShowcase,
  HeroWorkflowShowcase,
  IncludedTodayShowcase
} from "./LandingShowcase";

type LandingPageProps = {
  onSignIn: () => void;
  onSignUp: () => void;
  embedded?: boolean;
  heroPrimaryLabel?: string;
  heroSecondaryLabel?: string;
  ctaPrimaryLabel?: string;
  ctaSecondaryLabel?: string;
};

export default function LandingPage({
  onSignIn,
  onSignUp,
  embedded = false,
  heroPrimaryLabel = "Create workspace",
  heroSecondaryLabel = "Sign in",
  ctaPrimaryLabel = "Create workspace",
  ctaSecondaryLabel = "Sign in"
}: LandingPageProps) {
  const content = (
    <>
      <section className="landing-hero" id="hero">
        <div className="landing-hero__copy">
          <p className="eyebrow">AI incident triage for on-call engineers</p>
          <h1 className="landing-hero__title">
            Turn noisy production alerts into{" "}
            <span className="landing-hero__accent">actionable triage</span>.
          </h1>
          <p className="landing-hero__lede">
            IncidentPilot gives on-call engineers a structured incident workflow: capture the raw signal, generate a
            triage report, refine it with new evidence, and keep the version history for handoffs. It is built for the
            moment when generic chat starts to sprawl.
          </p>
          <div className="landing-hero__actions">
            <button className="primary-button" type="button" onClick={onSignUp}>
              {heroPrimaryLabel}
            </button>
            <button className="secondary-button" type="button" onClick={onSignIn}>
              {heroSecondaryLabel}
            </button>
          </div>
          <p className="landing-hero__note">
            For platform teams, on-call developers, and small ops groups who need fast, repeatable incident intake.
          </p>
        </div>

        <HeroWorkflowShowcase />
      </section>

      <ExampleIncidentShowcase />

      <ComparisonShowcase />

      <IncludedTodayShowcase />

      <section className="landing-cta" id="get-started">
        <div className="landing-cta__panel">
          <p className="eyebrow">Ready when the pager fires</p>
          <h2>Run your first incident analysis</h2>
          <p>
            Create your workspace, paste the alert, get a structured triage report, refine it as evidence lands, and
            keep the investigation history in one place.
          </p>
          <div className="landing-cta__actions">
            <button className="primary-button" type="button" onClick={onSignUp}>
              {ctaPrimaryLabel}
            </button>
            <button className="secondary-button" type="button" onClick={onSignIn}>
              {ctaSecondaryLabel}
            </button>
          </div>
        </div>
      </section>
    </>
  );

  if (embedded) {
    return (
      <div className="workspace-home" id="top">
        <div className="workspace-home__main">{content}</div>
      </div>
    );
  }

  return (
    <div className="landing" id="top">
      <div className="landing__backdrop landing__backdrop--grid" aria-hidden="true" />
      <div className="landing__backdrop landing__backdrop--glow" aria-hidden="true" />

      <PublicNav onSignIn={onSignIn} onSignUp={onSignUp} />

      <main className="landing__main page-enter">{content}</main>

      <footer className="landing-footer">
        <nav className="landing-footer__links" aria-label="Footer">
          <a href="#example">Example incident</a>
          <a href="#compare">Why not chat?</a>
          <a href="#included">Included today</a>
          <a href="#get-started">Get started</a>
        </nav>
        <p>IncidentPilot · structured AI triage for production incidents</p>
      </footer>
    </div>
  );
}
