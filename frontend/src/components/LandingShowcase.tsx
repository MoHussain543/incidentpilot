type MockFieldProps = {
  label: string;
  value: string;
  mono?: boolean;
};

function MockField({ label, value, mono = false }: MockFieldProps) {
  return (
    <div className="landing-mock-field">
      <span className="landing-mock-field__label">{label}</span>
      <span className={`landing-mock-field__value${mono ? " landing-mock-field__value--mono" : ""}`}>{value}</span>
    </div>
  );
}

function HeroStageHeader({
  step,
  title,
  state
}: {
  step: string;
  title: string;
  state: "done" | "active" | "next";
}) {
  return (
    <header className={`landing-hero-frame__stage-head landing-hero-frame__stage-head--${state}`}>
      <p className="panel__eyebrow">{step}</p>
      <h3 className="landing-hero-frame__stage-title">{title}</h3>
    </header>
  );
}

export function HeroWorkflowShowcase() {
  return (
    <aside className="landing-hero-frame" aria-label="IncidentPilot workflow preview">
      <div className="landing-hero-frame__chrome" aria-hidden="true">
        <span className="landing-hero-frame__dots">
          <span />
          <span />
          <span />
        </span>
        <span className="landing-hero-frame__chrome-label">IncidentPilot workspace</span>
      </div>

      <div className="landing-hero-frame__board">
        <section className="landing-hero-frame__stage">
          <HeroStageHeader step="Step 1" title="Intake" state="done" />
          <div className="landing-hero-frame__stage-body">
            <MockField label="Incident title" value="Checkout failures" />
            <div className="landing-mock-field-row">
              <MockField label="Service" value="payments-api" />
              <MockField label="Environment" value="production" />
            </div>
            <MockField label="Logs" value="UnknownHostException: db.internal" mono />
            <span className="landing-hero-frame__action">Analyze incident</span>
          </div>
        </section>

        <section className="landing-hero-frame__stage landing-hero-frame__stage--analyzing">
          <HeroStageHeader step="Step 2" title="Analyze" state="active" />
          <div className="landing-hero-frame__stage-body landing-hero-frame__stage-body--centered">
            <span className="landing-hero-frame__pulse" aria-hidden="true" />
            <p className="landing-hero-frame__status">Reviewing incident signal</p>
            <span className="landing-hero-frame__progress" aria-hidden="true">
              <span />
            </span>
            <p className="landing-hero-frame__hint">Building severity, causes, and next steps</p>
          </div>
        </section>

        <section className="landing-hero-frame__stage">
          <HeroStageHeader step="Step 3" title="Investigate" state="next" />
          <div className="landing-hero-frame__stage-body">
            <div className="landing-hero-frame__report-meta">
              <span className="severity-badge severity-badge--high">HIGH</span>
              <span className="landing-hero-frame__meta-note">86% confidence</span>
            </div>
            <p className="landing-hero-frame__summary">
              Checkout 500s trace to a bad database host introduced in build 204.
            </p>
            <MockField label="Suspected component" value="payment-adapter" />
            <MockField label="Next step" value="Diff env vars vs last good release" />
            <div className="landing-hero-frame__versions">
              <span className="landing-hero-frame__version landing-hero-frame__version--active">v2 Latest</span>
              <span className="landing-hero-frame__version">v1</span>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}

export function ExampleIncidentShowcase() {
  return (
    <div className="landing-example" id="example">
      <div className="landing-section-heading">
        <p className="panel__eyebrow">Realistic scenario</p>
        <h2>Checkout 500s after a deploy</h2>
        <p className="landing-section-heading__lede">
          See one incident move through the workflow: raw signal in, structured triage out, then a sharper report
          once one follow-up answer lands.
        </p>
      </div>

      <div className="landing-example__grid">
        <article className="landing-example__panel">
          <p className="landing-example__step">Step 1 · Input</p>
          <h3>What the engineer pastes in</h3>
          <p className="landing-example__summary">
            IncidentPilot starts with the messy signal you already have during the first few minutes of an incident.
          </p>
          <dl className="landing-example__facts">
            <div>
              <dt>Alert</dt>
              <dd>HTTP 500 rate crossed 18% on /checkout after build 204 shipped.</dd>
            </div>
            <div>
              <dt>Logs</dt>
              <dd>
                <code>java.net.UnknownHostException: db.internal</code>
              </dd>
            </div>
            <div>
              <dt>Deploy notes</dt>
              <dd>Build 204 rotated database connection settings and expanded the canary to 100%.</dd>
            </div>
          </dl>
        </article>

        <article className="landing-example__panel landing-example__panel--report">
          <p className="landing-example__step">Step 2 · First report</p>
          <h3>What IncidentPilot returns first</h3>
          <p className="landing-example__summary">
            The first report gives the on-call engineer a starting point: severity, likely component, causes, and
            concrete next steps.
          </p>
          <div className="landing-example__report">
            <div className="landing-example__report-top">
              <span className="severity-badge severity-badge--high">HIGH</span>
              <span>payment-adapter · 91% confidence</span>
            </div>
            <p>
              The latest evidence points to build 204 shipping a bad database host or resolver path in the payment
              adapter.
            </p>
            <div>
              <p className="landing-example__label">Probable causes</p>
              <ul>
                <li>DATABASE_HOST changed in build 204</li>
                <li>Misconfigured secret promoted during canary expansion</li>
              </ul>
            </div>
            <div>
              <p className="landing-example__label">Next steps</p>
              <ol>
                <li>Diff build 204 config against the last healthy release</li>
                <li>Roll back or pin traffic to healthy pods</li>
                <li>Verify DNS resolution for db.internal inside failing pods</li>
              </ol>
            </div>
          </div>
        </article>

        <article className="landing-example__panel landing-example__panel--refine">
          <p className="landing-example__step">Step 3 · Refined version</p>
          <h3>What changes after one follow-up answer</h3>
          <p className="landing-example__refine-lede">
            IncidentPilot asks targeted questions. One answer narrows the diagnosis and creates a new version instead
            of overwriting the earlier report.
          </p>
          <div className="landing-example__refine-card">
            <p className="landing-example__question">
              <span>Q1</span> Did the failure rate start immediately after the deploy?
            </p>
            <p className="landing-example__answer">Yes — within four minutes of the rollout reaching 100%.</p>
          </div>
          <div className="landing-example__delta">
            <p className="landing-example__label">What the latest version adds</p>
            <ul>
              <li>Confirms the rollout timing is part of the root-cause story</li>
              <li>Narrows the likely failure to build 204 changing the database host path</li>
              <li>Keeps the earlier analysis visible for handoffs and comparison</li>
            </ul>
          </div>
          <div className="landing-example__timeline">
            <span>Version 1 · Initial analysis</span>
            <span>Version 2 · Refined with deploy timing</span>
            <span className="landing-example__timeline-current">Version 3 · Latest report</span>
          </div>
        </article>
      </div>
    </div>
  );
}

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Gather incident context",
    body: "Paste the alert, logs, deploy notes, and optional file uploads into structured intake fields.",
    mock: "intake" as const
  },
  {
    step: "02",
    title: "Analyze with focus",
    body: "The workspace transitions into analysis mode while IncidentPilot reviews the signal.",
    mock: "analyzing" as const
  },
  {
    step: "03",
    title: "Read the investigation report",
    body: "Severity, suspected component, probable causes, next steps, and confidence land in a dedicated view.",
    mock: "report" as const
  },
  {
    step: "04",
    title: "Submit new evidence",
    body: "Answer clarifying questions when you learn more. Each refinement creates a new report version.",
    mock: "refine" as const
  },
  {
    step: "05",
    title: "Keep the history",
    body: "Saved incidents, report versions, and exports stay in your account for shift handoffs.",
    mock: "history" as const
  }
] as const;

function WorkflowMiniMock({ kind }: { kind: (typeof WORKFLOW_STEPS)[number]["mock"] }) {
  if (kind === "intake") {
    return (
      <div className="landing-workflow-mock">
        <span className="landing-workflow-mock__line landing-workflow-mock__line--wide" />
        <span className="landing-workflow-mock__line" />
        <span className="landing-workflow-mock__line landing-workflow-mock__line--tall" />
      </div>
    );
  }

  if (kind === "analyzing") {
    return (
      <div className="landing-workflow-mock landing-workflow-mock--analyzing">
        <span className="landing-workflow-mock__bot" />
        <span className="landing-workflow-mock__line landing-workflow-mock__line--medium" />
      </div>
    );
  }

  if (kind === "report") {
    return (
      <div className="landing-workflow-mock landing-workflow-mock--report">
        <span className="severity-badge severity-badge--high">HIGH</span>
        <span className="landing-workflow-mock__line landing-workflow-mock__line--wide" />
        <span className="landing-workflow-mock__line" />
      </div>
    );
  }

  if (kind === "refine") {
    return (
      <div className="landing-workflow-mock landing-workflow-mock--refine">
        <span className="landing-workflow-mock__q">Q1</span>
        <span className="landing-workflow-mock__line landing-workflow-mock__line--wide" />
        <span className="landing-workflow-mock__line landing-workflow-mock__line--medium" />
      </div>
    );
  }

  return (
    <div className="landing-workflow-mock landing-workflow-mock--history">
      <span className="landing-workflow-mock__history-item landing-workflow-mock__history-item--active" />
      <span className="landing-workflow-mock__history-item" />
      <span className="landing-workflow-mock__history-item" />
    </div>
  );
}

export function WorkflowStepsShowcase() {
  return (
    <section className="landing-workflow" id="how-it-works">
      <div className="landing-section-heading">
        <p className="panel__eyebrow">How it works</p>
        <h2>From alert noise to a report you can act on</h2>
        <p className="landing-section-heading__lede">
          The workflow is staged on purpose: intake, analysis, investigation, refinement, and saved history are separate
          moments instead of one crowded screen.
        </p>
      </div>

      <ol className="landing-workflow__list">
        {WORKFLOW_STEPS.map((item) => (
          <li className="landing-workflow__item" key={item.step}>
            <WorkflowMiniMock kind={item.mock} />
            <div>
              <span className="landing-workflow__index">{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const COMPARISON_ROWS = [
  {
    chat: "Conversation keeps growing and old conclusions get buried",
    incidentpilot: "Fixed report schema every time: summary, severity, causes, next steps"
  },
  {
    chat: "Hard to hand off because context lives in a thread",
    incidentpilot: "Saved investigation workspace with original context and report versions"
  },
  {
    chat: "You have to prompt-engineer the investigation",
    incidentpilot: "Structured intake fields designed for real incident signal"
  },
  {
    chat: "New facts overwrite the previous answer",
    incidentpilot: "Refinement creates version 2, 3, and so on without losing version 1"
  }
] as const;

export function ComparisonShowcase() {
  return (
    <section className="landing-compare" id="compare">
      <div className="landing-section-heading">
        <p className="panel__eyebrow">Why not just use chat?</p>
        <h2>Built for incident triage, not open-ended conversation</h2>
      </div>

      <div className="landing-compare__table" role="table" aria-label="IncidentPilot versus generic chat">
        <div className="landing-compare__row landing-compare__row--head" role="row">
          <span role="columnheader">Generic chat</span>
          <span role="columnheader">IncidentPilot</span>
        </div>
        {COMPARISON_ROWS.map((row) => (
          <div className="landing-compare__row" role="row" key={row.chat}>
            <span role="cell">{row.chat}</span>
            <span role="cell">{row.incidentpilot}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const INCLUDED_ITEMS = [
  "Structured incident intake with log file upload",
  "AI triage report with severity, causes, and next steps",
  "Dedicated investigation workspace after analysis",
  "Clarifying questions and evidence-based refinement",
  "Versioned report history per incident",
  "Saved reports library across your account",
  "Copy summary and export markdown"
] as const;

export function IncludedTodayShowcase() {
  return (
    <section className="landing-included" id="included">
      <div className="landing-section-heading">
        <p className="panel__eyebrow">Included today</p>
        <h2>What you get after sign-in</h2>
        <p className="landing-section-heading__lede">
          No integrations required to start. Paste the signal, run the analysis, and build a report history from real
          incidents.
        </p>
      </div>

      <ul className="landing-included__list">
        {INCLUDED_ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

const FAQ_ITEMS = [
  {
    question: "Is this just ChatGPT with a form?",
    answer:
      "No. IncidentPilot always returns the same structured report shape and keeps version history as you refine. It is designed for incident intake, not general conversation."
  },
  {
    question: "Do I need to write prompts?",
    answer:
      "No prompt engineering. You fill in incident fields — title, service, alert, logs, deploy notes — and IncidentPilot handles the analysis."
  },
  {
    question: "What happens after the first report?",
    answer:
      "You land on an investigation view with the triage report, clarifying questions, and report versions. You can refine when new evidence appears or return later from your saved reports."
  },
  {
    question: "Is my incident data saved?",
    answer:
      "Yes. Successful analyses are saved to your account with the original context and each report version. You can reopen them from the Reports library."
  }
] as const;

export function FaqShowcase() {
  return (
    <section className="landing-faq" id="faq">
      <div className="landing-section-heading">
        <p className="panel__eyebrow">FAQ</p>
        <h2>Common questions</h2>
      </div>

      <div className="landing-faq__list">
        {FAQ_ITEMS.map((item) => (
          <details className="landing-faq__item" key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

const FEATURE_VISUALS = {
  triage: (
    <div className="landing-feature-visual" aria-hidden="true">
      <span className="severity-badge severity-badge--high">HIGH</span>
      <span className="landing-feature-visual__line landing-feature-visual__line--wide" />
      <span className="landing-feature-visual__line" />
    </div>
  ),
  versions: (
    <div className="landing-feature-visual landing-feature-visual--versions" aria-hidden="true">
      <span>v3 Latest</span>
      <span>v2</span>
      <span>v1</span>
    </div>
  ),
  history: (
    <div className="landing-feature-visual landing-feature-visual--history" aria-hidden="true">
      <span className="landing-feature-visual__history-card" />
      <span className="landing-feature-visual__history-card" />
      <span className="landing-feature-visual__history-card" />
    </div>
  ),
  intake: (
    <div className="landing-feature-visual landing-feature-visual--intake" aria-hidden="true">
      <span className="landing-feature-visual__line landing-feature-visual__line--wide" />
      <span className="landing-feature-visual__line landing-feature-visual__line--tall" />
    </div>
  )
} as const;

export function FeatureVisual({ kind }: { kind: keyof typeof FEATURE_VISUALS }) {
  return FEATURE_VISUALS[kind];
}
