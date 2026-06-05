import PublicNav from "./PublicNav";

type LandingPageProps = {
  onSignIn: () => void;
  onSignUp: () => void;
};

const FEATURES = [
  {
    title: "Structured triage, not chat drift",
    body: "Feed alerts, stack traces, and deploy notes into a fixed report schema: severity, suspected component, causes, and next steps.",
    tag: "Core workflow"
  },
  {
    title: "Refine when evidence lands",
    body: "Answer clarifying questions and append a new report version. Earlier analysis stays in the timeline instead of being overwritten.",
    tag: "Versioned reports"
  },
  {
    title: "History that survives the shift change",
    body: "Every analyzed incident is saved to your account with context and report versions, so handoffs do not start from scratch.",
    tag: "Persistent workspace"
  },
  {
    title: "Built for production signal",
    body: "Designed around real incident intake fields and log uploads — the kind of messy input on-call engineers actually have at 2 a.m.",
    tag: "Ops-first"
  }
] as const;

const STEPS = [
  {
    step: "01",
    title: "Paste the raw signal",
    body: "Title, service, environment, alert text, logs, and recent deploy notes — no prompt engineering required."
  },
  {
    step: "02",
    title: "Get a triage report",
    body: "IncidentPilot returns a structured diagnosis with severity, likely causes, and concrete debugging steps."
  },
  {
    step: "03",
    title: "Refine as facts emerge",
    body: "Add follow-up answers when you learn more. Each refinement creates a new version in your incident history."
  }
] as const;

export default function LandingPage({ onSignIn, onSignUp }: LandingPageProps) {
  return (
    <div className="landing" id="top">
      <div className="landing__backdrop landing__backdrop--grid" aria-hidden="true" />
      <div className="landing__backdrop landing__backdrop--glow" aria-hidden="true" />

      <PublicNav onSignIn={onSignIn} onSignUp={onSignUp} />

      <main className="landing__main">
        <section className="landing-hero" id="hero">
          <div className="landing-hero__copy">
            <p className="eyebrow">AI incident triage for on-call engineers</p>
            <h1 className="landing-hero__title">
              Turn noisy production alerts into{" "}
              <span className="landing-hero__accent">actionable triage</span>.
            </h1>
            <p className="landing-hero__lede">
              IncidentPilot reads your alerts, logs, and deploy context — then returns a structured report with
              severity, suspected component, probable causes, and next debugging steps. Built for engineers
              holding the pager, not for open-ended chatbot threads.
            </p>
            <div className="landing-hero__actions">
              <button className="primary-button" type="button" onClick={onSignUp}>
                Create workspace
              </button>
              <button className="secondary-button" type="button" onClick={onSignIn}>
                Sign in
              </button>
            </div>
            <p className="landing-hero__note">
              For platform teams, on-call developers, and small ops groups who need fast, repeatable incident intake.
            </p>
          </div>

          <aside className="landing-preview" aria-label="Example triage output">
            <div className="landing-preview__chrome">
              <span className="landing-preview__dot" />
              <span className="landing-preview__dot" />
              <span className="landing-preview__dot" />
              <span className="landing-preview__label">triage_report.json</span>
            </div>
            <pre className="landing-preview__body">
{`{
  "summary": "Checkout 500s began after
    build 204 deployed a bad DB host.",
  "severity": "HIGH",
  "suspectedComponent": "payment-adapter",
  "probableCauses": [
    "Invalid DATABASE_HOST in config",
    "Secret not refreshed on deploy"
  ],
  "nextSteps": [
    "Diff env vars vs last good release",
    "Verify DNS for db.internal resolves"
  ],
  "confidence": 0.86
}`}
            </pre>
            <div className="landing-preview__footer">
              <span className="severity-badge severity-badge--high">HIGH</span>
              <span className="landing-preview__caption">Structured output · ready to share with the team</span>
            </div>
          </aside>
        </section>

        <section className="landing-audience">
          <div className="landing-section-heading">
            <p className="panel__eyebrow">Who it is for</p>
            <h2>Built for people who actually run the incident</h2>
          </div>
          <ul className="landing-audience__list">
            <li>
              <strong>On-call software engineers</strong> who need a fast read on unfamiliar failures.
            </li>
            <li>
              <strong>Platform and SRE teams</strong> standardizing how incidents are captured and handed off.
            </li>
            <li>
              <strong>Small product teams</strong> without a dedicated incident commander but plenty of production risk.
            </li>
          </ul>
        </section>

        <section className="landing-features" id="features">
          <div className="landing-section-heading">
            <p className="panel__eyebrow">Why teams use it</p>
            <h2>Less thrashing. More signal.</h2>
            <p className="landing-section-heading__lede">
              IncidentPilot keeps the investigation structured from the first alert through the follow-up refinement loop.
            </p>
          </div>
          <div className="landing-features__grid">
            {FEATURES.map((feature) => (
              <article className="landing-feature-card" key={feature.title}>
                <span className="landing-feature-card__tag">{feature.tag}</span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-steps" id="how-it-works">
          <div className="landing-section-heading">
            <p className="panel__eyebrow">How it works</p>
            <h2>From alert noise to a report you can act on</h2>
          </div>
          <ol className="landing-steps__list">
            {STEPS.map((item) => (
              <li className="landing-step" key={item.step}>
                <span className="landing-step__index">{item.step}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-cta">
          <div className="landing-cta__panel">
            <p className="eyebrow">Ready when the pager fires</p>
            <h2>Start your incident workspace</h2>
            <p>
              Sign up to save investigations, build versioned report history, and keep context across shifts.
              The triage workflow you saw above unlocks as soon as you are signed in.
            </p>
            <div className="landing-cta__actions">
              <button className="primary-button" type="button" onClick={onSignUp}>
                Get started free
              </button>
              <button className="secondary-button" type="button" onClick={onSignIn}>
                I already have an account
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p>IncidentPilot · structured AI triage for production incidents</p>
      </footer>
    </div>
  );
}
