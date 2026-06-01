import { useState } from "react";
import type { ChangeEvent, FormEvent, PropsWithChildren } from "react";
import { ApiError, analyzeIncident, refineIncident } from "./api";
import AssistantBot from "./components/AssistantBot";
import type {
  AnalyzeIncidentRequest,
  FollowUpAnswer,
  IncidentSeverity,
  IncidentTriageReport
} from "./types";

type RequestPhase = "idle" | "analyzing" | "refining" | "success" | "error";

const initialFormValues: AnalyzeIncidentRequest = {
  title: "",
  serviceName: "",
  environment: "production",
  alertMessage: "",
  logsOrStackTrace: "",
  recentDeployNotes: ""
};

export default function App() {
  const [formValues, setFormValues] = useState<AnalyzeIncidentRequest>(initialFormValues);
  const [report, setReport] = useState<IncidentTriageReport | null>(null);
  const [lastSubmittedIncident, setLastSubmittedIncident] = useState<AnalyzeIncidentRequest | null>(null);
  const [requestPhase, setRequestPhase] = useState<RequestPhase>("idle");
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({});

  async function handleAnalyzeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestPhase("analyzing");
    setApiError(null);
    setFieldErrors({});

    try {
      const nextReport = await analyzeIncident(formValues);
      setReport(nextReport);
      setLastSubmittedIncident(formValues);
      setFollowUpAnswers(createEmptyAnswers(nextReport.clarifyingQuestions));
      setRequestPhase("success");
    } catch (error) {
      handleApiError(error);
    }
  }

  async function handleRefineSubmit() {
    if (!lastSubmittedIncident || !report) {
      return;
    }

    const answers = report.clarifyingQuestions.map((question) => ({
      question,
      answer: followUpAnswers[question]?.trim() ?? ""
    }));
    const missingAnswer = answers.some((answer) => answer.answer.length === 0);
    if (missingAnswer) {
      setApiError("Answer each follow-up question before refining the analysis.");
      return;
    }

    setRequestPhase("refining");
    setApiError(null);

    try {
      const nextReport = await refineIncident({
        originalIncident: lastSubmittedIncident,
        previousReport: report,
        followUpAnswers: answers
      });
      setReport(nextReport);
      setFollowUpAnswers(createEmptyAnswers(nextReport.clarifyingQuestions));
      setRequestPhase("success");
    } catch (error) {
      handleApiError(error);
    }
  }

  function handleApiError(error: unknown) {
    if (error instanceof ApiError) {
      setApiError(error.message);
      setFieldErrors(error.fieldErrors);
    } else {
      setApiError("The analysis failed. Please try again.");
      setFieldErrors({});
    }
    setRequestPhase("error");
  }

  function updateField<K extends keyof AnalyzeIncidentRequest>(field: K, value: AnalyzeIncidentRequest[K]) {
    setFormValues((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateFollowUp(question: string, answer: string) {
    setFollowUpAnswers((current) => ({
      ...current,
      [question]: answer
    }));
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const fileContents = await file.text();
      setFormValues((current) => ({
        ...current,
        logsOrStackTrace: current.logsOrStackTrace.trim()
          ? `${current.logsOrStackTrace.trim()}\n\n--- Uploaded file: ${file.name} ---\n${fileContents}`
          : `--- Uploaded file: ${file.name} ---\n${fileContents}`
      }));
      setApiError(null);
      event.target.value = "";
    } catch {
      setApiError("The uploaded file could not be read. Please try a plain text, .log, or .md file.");
    }
  }

  function exportMarkdown() {
    if (!report) {
      return;
    }

    const incidentSource = lastSubmittedIncident ?? formValues;
    const markdown = createMarkdownReport(incidentSource, report);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `incidentpilot-${slugify(incidentSource.title || "incident-report")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const assistantState = resolveAssistantState(requestPhase, report?.severity, apiError);
  const busy = requestPhase === "analyzing" || requestPhase === "refining";

  return (
    <main className="app-shell">
      <div className="app-shell__backdrop app-shell__backdrop--left" />
      <div className="app-shell__backdrop app-shell__backdrop--right" />

      <section className="hero-bar">
        <div>
          <p className="eyebrow">Incident triage workspace</p>
          <h1>IncidentPilot</h1>
          <p className="hero-copy">
            Paste the raw signal, get a structured diagnosis, and refine the report when the incident still has
            gaps.
          </p>
        </div>
        <div className="hero-status">
          <span className={`status-pill status-pill--${assistantState}`}>{statusLabel(requestPhase, report?.severity)}</span>
          <p className="hero-status__note">
            Built for production issues, not open-ended chatbot drift.
          </p>
        </div>
      </section>

      <section className="workspace-grid">
        <form className="panel panel--form" onSubmit={handleAnalyzeSubmit}>
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">Incident intake</p>
              <h2>Signal in</h2>
            </div>
            <p className="panel__helper">Structured fields make the report more reliable and easier to refine later.</p>
          </div>

          <div className="field-grid field-grid--double">
            <Field
              id="title"
              label="Incident title"
              value={formValues.title}
              error={fieldErrors.title}
              onChange={(value) => updateField("title", value)}
              placeholder="Checkout failures after deploy"
            />
            <Field
              id="serviceName"
              label="Service name"
              value={formValues.serviceName}
              error={fieldErrors.serviceName}
              onChange={(value) => updateField("serviceName", value)}
              placeholder="payments-api"
            />
          </div>

          <div className="field-grid field-grid--double">
            <Field
              id="environment"
              label="Environment"
              value={formValues.environment}
              error={fieldErrors.environment}
              onChange={(value) => updateField("environment", value)}
              placeholder="production"
            />
            <Field
              id="alertMessage"
              label="Alert message"
              value={formValues.alertMessage}
              error={fieldErrors.alertMessage}
              onChange={(value) => updateField("alertMessage", value)}
              placeholder="HTTP 500 spike in checkout"
            />
          </div>

          <Field
            id="logsOrStackTrace"
            label="Logs or stack trace"
            value={formValues.logsOrStackTrace}
            error={fieldErrors.logsOrStackTrace}
            onChange={(value) => updateField("logsOrStackTrace", value)}
            placeholder="Paste the relevant logs, stack trace, or alert payload here."
            multiline
            rows={12}
          />

          <label className="field" htmlFor="contextFile">
            <span className="field__label">Attach a text file</span>
            <input
              id="contextFile"
              className="field__input"
              type="file"
              accept=".log,.txt,.md,text/plain,text/markdown"
              onChange={handleFileUpload}
            />
            <span className="field__hint">Supported for raw incident context: `.log`, `.txt`, and `.md` files.</span>
          </label>

          <Field
            id="recentDeployNotes"
            label="Recent deploy notes"
            value={formValues.recentDeployNotes}
            error={fieldErrors.recentDeployNotes}
            onChange={(value) => updateField("recentDeployNotes", value)}
            placeholder="What changed recently? New release, config edit, secret rotation, migration, or rollback notes."
            multiline
            rows={5}
          />

          <div className="panel__footer">
            <button className="primary-button" type="submit" disabled={busy}>
              {requestPhase === "analyzing" ? "Analyzing incident..." : "Analyze incident"}
            </button>
            <p className="panel__footnote">OpenAI output is constrained to a strict JSON report so the UI stays structured.</p>
          </div>
        </form>

        <section className="panel panel--results">
          <div className="results-hero">
            <div>
              <p className="panel__eyebrow">Analysis workspace</p>
              <h2>Signal out</h2>
              <p className="panel__helper">
                IncidentPilot turns the raw context into a triage summary, concrete next steps, and the missing
                evidence it still wants.
              </p>
            </div>
            <AssistantBot state={assistantState} />
          </div>

          {apiError ? <div className="message-banner message-banner--error">{apiError}</div> : null}

          {requestPhase === "idle" && !report ? (
            <div className="empty-state">
              <h3>Waiting on incident context</h3>
              <p>Provide the title, service, alert, and the most relevant logs to start a first-pass triage report.</p>
              <ul>
                <li>Best for alerts, exceptions, rollback fallout, latency spikes, and deploy regressions.</li>
                <li>Clarifying questions appear automatically when the evidence is incomplete.</li>
                <li>High and critical severity reports shift the workspace into an alert posture.</li>
              </ul>
            </div>
          ) : null}

          {busy ? (
            <div className="loading-panel">
              <div className="loading-panel__line" />
              <div className="loading-panel__line loading-panel__line--medium" />
              <div className="loading-panel__line loading-panel__line--short" />
              <p>{requestPhase === "refining" ? "Refining the report with your answers..." : "Reviewing the incident signal..."}</p>
            </div>
          ) : null}

          {report ? (
            <div className="results-stack">
              <div className="report-topline">
                <SeverityBadge severity={report.severity} />
                <button className="secondary-button" type="button" onClick={exportMarkdown}>
                  Export markdown
                </button>
              </div>

              <ResultCard title="Summary">
                <p>{report.summary}</p>
              </ResultCard>

              <div className="metric-grid">
                <ResultCard title="Suspected component">
                  <p>{report.suspectedComponent}</p>
                </ResultCard>
                <ResultCard title="Confidence">
                  <p>{Math.round(report.confidence * 100)}%</p>
                </ResultCard>
              </div>

              <div className="metric-grid">
                <ResultCard title="Probable causes">
                  <ListBlock items={report.probableCauses} emptyLabel="No probable causes were returned." />
                </ResultCard>
                <ResultCard title="Next steps">
                  <ListBlock items={report.nextSteps} emptyLabel="No next steps were returned." />
                </ResultCard>
              </div>

              <ResultCard title="Clarifying questions">
                <ListBlock
                  items={report.clarifyingQuestions}
                  emptyLabel="The model had enough context to produce a first-pass report without follow-up questions."
                />
              </ResultCard>

              {report.clarifyingQuestions.length > 0 ? (
                <ResultCard title="Refine the analysis">
                  <div className="follow-up-stack">
                    {report.clarifyingQuestions.map((question) => (
                      <label className="field" key={question}>
                        <span className="field__label">{question}</span>
                        <textarea
                          className="field__input field__input--textarea"
                          value={followUpAnswers[question] ?? ""}
                          onChange={(event) => updateFollowUp(question, event.target.value)}
                          rows={3}
                          placeholder="Add the missing evidence or answer here."
                        />
                      </label>
                    ))}
                    <button className="primary-button" type="button" onClick={handleRefineSubmit} disabled={busy}>
                      {requestPhase === "refining" ? "Refining..." : "Refine analysis"}
                    </button>
                  </div>
                </ResultCard>
              ) : null}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
  rows?: number;
};

function Field({ id, label, value, onChange, placeholder, error, multiline = false, rows = 4 }: FieldProps) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      {multiline ? (
        <textarea
          id={id}
          className="field__input field__input--textarea"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
        />
      ) : (
        <input
          id={id}
          className="field__input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

function ResultCard({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <article className="result-card">
      <div className="result-card__header">
        <h3>{title}</h3>
      </div>
      <div className="result-card__body">{children}</div>
    </article>
  );
}

function ListBlock({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p>{emptyLabel}</p>;
  }

  return (
    <ul className="result-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  return <span className={`severity-badge severity-badge--${severity.toLowerCase()}`}>{severity}</span>;
}

function resolveAssistantState(
  requestPhase: RequestPhase,
  severity: IncidentSeverity | undefined,
  apiError: string | null
): "idle" | "analyzing" | "ready" | "warning" {
  if (requestPhase === "analyzing" || requestPhase === "refining") {
    return "analyzing";
  }
  if (apiError || severity === "HIGH" || severity === "CRITICAL") {
    return "warning";
  }
  if (severity) {
    return "ready";
  }
  return "idle";
}

function statusLabel(requestPhase: RequestPhase, severity: IncidentSeverity | undefined) {
  if (requestPhase === "analyzing") {
    return "Analyzing";
  }
  if (requestPhase === "refining") {
    return "Refining";
  }
  if (severity === "HIGH" || severity === "CRITICAL") {
    return "Elevated";
  }
  if (severity) {
    return "Report ready";
  }
  return "Standing by";
}

function createEmptyAnswers(questions: string[]) {
  return questions.reduce<Record<string, string>>((accumulator, question) => {
    accumulator[question] = "";
    return accumulator;
  }, {});
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createMarkdownReport(
  incident: AnalyzeIncidentRequest,
  report: IncidentTriageReport
) {
  const followUpSection =
    report.clarifyingQuestions.length === 0
      ? "None."
      : report.clarifyingQuestions.map((question) => `- ${question}`).join("\n");

  return `# IncidentPilot Report

## Incident
- Title: ${incident.title}
- Service: ${incident.serviceName}
- Environment: ${incident.environment}
- Alert: ${incident.alertMessage}

## Summary
${report.summary}

## Severity
${report.severity}

## Suspected Component
${report.suspectedComponent}

## Probable Causes
${report.probableCauses.map((cause) => `- ${cause}`).join("\n")}

## Next Steps
${report.nextSteps.map((step) => `- ${step}`).join("\n")}

## Confidence
${Math.round(report.confidence * 100)}%

## Clarifying Questions
${followUpSection}
`;
}
