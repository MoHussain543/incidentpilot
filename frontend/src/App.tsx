import { useState } from "react";
import type { ChangeEvent, FormEvent, PropsWithChildren } from "react";
import { ApiError, analyzeIncident, refineIncident } from "./api";
import AssistantBot from "./components/AssistantBot";
import { INCIDENT_LIMITS } from "./incidentLimits";
import type {
  AnalyzeIncidentRequest,
  IncidentSeverity,
  IncidentTriageReport
} from "./types";
import { incidentsMatch, validateIncidentForm } from "./validateIncidentForm";

type RequestPhase = "idle" | "analyzing" | "refining" | "success" | "error";

const initialFormValues: AnalyzeIncidentRequest = {
  title: "",
  serviceName: "",
  environment: "production",
  alertMessage: "",
  logsOrStackTrace: "",
  recentDeployNotes: ""
};

const ENVIRONMENT_SUGGESTIONS = ["production", "staging", "development"];

export default function App() {
  const [formValues, setFormValues] = useState<AnalyzeIncidentRequest>(initialFormValues);
  const [report, setReport] = useState<IncidentTriageReport | null>(null);
  const [lastSubmittedIncident, setLastSubmittedIncident] = useState<AnalyzeIncidentRequest | null>(null);
  const [requestPhase, setRequestPhase] = useState<RequestPhase>("idle");
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("");

  const reportIsStale = Boolean(report && lastSubmittedIncident && !incidentsMatch(lastSubmittedIncident, formValues));
  const assistantState = resolveAssistantState(requestPhase, report?.severity, apiError);
  const busy = requestPhase === "analyzing" || requestPhase === "refining";
  const logsLength = formValues.logsOrStackTrace.length;
  const logsNearLimit = logsLength > INCIDENT_LIMITS.logsOrStackTrace * 0.9;

  async function handleAnalyzeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateIncidentForm(formValues);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setApiError("Fix the highlighted fields before analyzing this incident.");
      setRequestPhase("error");
      setStatusMessage("Incident form has validation errors.");
      return;
    }

    setRequestPhase("analyzing");
    setApiError(null);
    setFieldErrors({});
    setStatusMessage("Analyzing incident context.");

    try {
      const nextReport = await analyzeIncident(formValues);
      setReport(nextReport);
      setLastSubmittedIncident({ ...formValues });
      setFollowUpAnswers(createEmptyAnswers(nextReport.clarifyingQuestions));
      setRequestPhase("success");
      setStatusMessage("Incident analysis is ready.");
    } catch (error) {
      handleApiError(error, "Incident analysis failed.");
    }
  }

  async function handleRefineSubmit() {
    if (!lastSubmittedIncident || !report) {
      return;
    }

    const answers = report.clarifyingQuestions
      .map((question, index) => ({
        question,
        answer: followUpAnswers[`${index}:${question}`]?.trim() ?? ""
      }))
      .filter((entry) => entry.answer.length > 0);

    if (answers.length === 0) {
      setApiError("Answer at least one follow-up question, or leave the rest blank and refine later.");
      setStatusMessage("Refine request needs at least one follow-up answer.");
      return;
    }

    setRequestPhase("refining");
    setApiError(null);
    setStatusMessage("Refining the incident report.");

    try {
      const nextReport = await refineIncident({
        originalIncident: lastSubmittedIncident,
        previousReport: report,
        followUpAnswers: answers
      });
      setReport(nextReport);
      setFollowUpAnswers(createEmptyAnswers(nextReport.clarifyingQuestions));
      setRequestPhase("success");
      setStatusMessage("Refined incident analysis is ready.");
    } catch (error) {
      handleApiError(error, "Refining the analysis failed.");
    }
  }

  function handleApiError(error: unknown, fallbackMessage: string) {
    if (error instanceof ApiError) {
      setApiError(error.message);
      setFieldErrors(error.fieldErrors);
      setStatusMessage("Analysis failed. Review the error details in the results panel.");
    } else {
      setApiError(fallbackMessage);
      setFieldErrors({});
      setStatusMessage("Analysis failed. Review the error details in the results panel.");
    }
    setRequestPhase("error");
  }

  function handleResetIncident() {
    setFormValues(initialFormValues);
    setReport(null);
    setLastSubmittedIncident(null);
    setRequestPhase("idle");
    setApiError(null);
    setFieldErrors({});
    setFollowUpAnswers({});
    setStatusMessage("Ready for a new incident.");
  }

  function updateField<K extends keyof AnalyzeIncidentRequest>(field: K, value: AnalyzeIncidentRequest[K]) {
    setFormValues((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateFollowUp(questionKey: string, answer: string) {
    setFollowUpAnswers((current) => ({
      ...current,
      [questionKey]: answer
    }));
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const fileContents = await file.text();
      const separator = formValues.logsOrStackTrace.trim() ? "\n\n" : "";
      const appended = formValues.logsOrStackTrace.trim()
        ? `${formValues.logsOrStackTrace.trim()}${separator}--- Uploaded file: ${file.name} ---\n${fileContents}`
        : `--- Uploaded file: ${file.name} ---\n${fileContents}`;

      if (appended.length > INCIDENT_LIMITS.logsOrStackTrace) {
        setApiError(
          `Adding "${file.name}" would exceed the ${INCIDENT_LIMITS.logsOrStackTrace.toLocaleString()} character log limit. Remove some existing text or upload a smaller file.`
        );
        setStatusMessage("Uploaded file is too large for the log field.");
        event.target.value = "";
        return;
      }

      setFormValues((current) => ({
        ...current,
        logsOrStackTrace: appended
      }));
      setApiError(null);
      event.target.value = "";
    } catch {
      setApiError("The uploaded file could not be read. Please try a plain text, .log, or .md file.");
      setStatusMessage("File upload failed.");
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

  async function copySummary() {
    if (!report) {
      return;
    }

    try {
      await navigator.clipboard.writeText(report.summary);
      setStatusMessage("Summary copied to clipboard.");
    } catch {
      setApiError("Could not copy the summary. Your browser may be blocking clipboard access.");
      setStatusMessage("Copy to clipboard failed.");
    }
  }

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
          <span className={`status-pill status-pill--${assistantState}`}>
            {statusLabel(requestPhase, report?.severity, apiError)}
          </span>
          <p className="hero-status__note">
            Built for production issues, not open-ended chatbot drift.
          </p>
        </div>
      </section>

      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>

      <section className="workspace-grid">
        <form
          className="panel panel--form"
          onSubmit={handleAnalyzeSubmit}
          aria-busy={busy}
          noValidate
        >
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
              list="environment-suggestions"
            />
            <datalist id="environment-suggestions">
              {ENVIRONMENT_SUGGESTIONS.map((environment) => (
                <option key={environment} value={environment} />
              ))}
            </datalist>
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
            hint={`${logsLength.toLocaleString()} / ${INCIDENT_LIMITS.logsOrStackTrace.toLocaleString()} characters`}
            hintTone={logsNearLimit ? "warning" : "default"}
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
            <span className="field__hint">
              Supported for raw incident context: `.log`, `.txt`, and `.md` files. Uploads are merged into the log field
              and must stay within the character limit.
            </span>
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
            <div className="panel__actions">
              <button className="primary-button" type="submit" disabled={busy}>
                {requestPhase === "analyzing" ? "Analyzing incident..." : "Analyze incident"}
              </button>
              {report ? (
                <button className="secondary-button" type="button" onClick={handleResetIncident} disabled={busy}>
                  New incident
                </button>
              ) : null}
            </div>
            <p className="panel__footnote">OpenAI output is constrained to a strict JSON report so the UI stays structured.</p>
          </div>
        </form>

        <section className="panel panel--results" aria-busy={busy}>
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

          {apiError ? (
            <div className="message-banner message-banner--error" role="alert">
              <strong>Analysis issue</strong>
              <p>{apiError}</p>
            </div>
          ) : null}

          {reportIsStale ? (
            <div className="message-banner message-banner--warning" role="status">
              <strong>Report is out of date</strong>
              <p>
                The form on the left no longer matches the incident used for this report. Re-run Analyze incident to
                refresh the analysis.
              </p>
            </div>
          ) : null}

          {requestPhase === "idle" && !report ? (
            <div className="empty-state">
              <h3>Waiting on incident context</h3>
              <p>Provide the title, service, alert, and the most relevant logs to start a first-pass triage report.</p>
              <ul>
                <li>Best for alerts, exceptions, rollback fallout, latency spikes, and deploy regressions.</li>
                <li>Clarifying questions appear automatically when the evidence is incomplete.</li>
                <li>High and critical severity reports shift the workspace into an elevated alert posture.</li>
              </ul>
            </div>
          ) : null}

          {busy ? (
            <div className="loading-panel" aria-hidden="true">
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
                <div className="report-topline__actions">
                  <button className="secondary-button" type="button" onClick={copySummary}>
                    Copy summary
                  </button>
                  <button className="secondary-button" type="button" onClick={exportMarkdown}>
                    Export markdown
                  </button>
                </div>
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
                  <p className="result-card__note">
                    How strongly the available evidence supports this report. Lower values mean more missing context.
                  </p>
                </ResultCard>
              </div>

              <div className="metric-grid">
                <ResultCard title="Probable causes">
                  <ListBlock items={report.probableCauses} emptyLabel="No probable causes were returned." />
                </ResultCard>
                <ResultCard title="Next steps">
                  <OrderedListBlock items={report.nextSteps} emptyLabel="No next steps were returned." />
                </ResultCard>
              </div>

              {report.clarifyingQuestions.length > 0 ? (
                <ResultCard title="Refine the analysis">
                  <p className="result-card__note">
                    Answer the questions you can. Unanswered questions are skipped and can be handled in a later
                    refinement pass.
                  </p>
                  <div className="follow-up-stack">
                    {report.clarifyingQuestions.map((question, index) => (
                      <div className="field" key={`${index}:${question}`}>
                        <label className="field__label" htmlFor={`follow-up-${index}`}>
                          {question}
                        </label>
                        <textarea
                          id={`follow-up-${index}`}
                          className="field__input field__input--textarea"
                          value={followUpAnswers[`${index}:${question}`] ?? ""}
                          onChange={(event) => updateFollowUp(`${index}:${question}`, event.target.value)}
                          rows={3}
                          placeholder="Add the missing evidence or answer here. Leave blank to skip for now."
                        />
                      </div>
                    ))}
                    <button className="primary-button" type="button" onClick={handleRefineSubmit} disabled={busy}>
                      {requestPhase === "refining" ? "Refining..." : "Refine analysis"}
                    </button>
                  </div>
                </ResultCard>
              ) : (
                <ResultCard title="Follow-up">
                  <p>
                    The model had enough context to produce a first-pass report without follow-up questions. Update
                    the incident form and analyze again if new evidence arrives.
                  </p>
                </ResultCard>
              )}
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
  hint?: string;
  hintTone?: "default" | "warning";
  multiline?: boolean;
  rows?: number;
  list?: string;
};

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  hint,
  hintTone = "default",
  multiline = false,
  rows = 4,
  list
}: FieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className="field__input field__input--textarea"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />
      ) : (
        <input
          id={id}
          className="field__input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          list={list}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />
      )}
      {hint ? (
        <span
          id={hintId}
          className={`field__hint${hintTone === "warning" ? " field__hint--warning" : ""}`}
        >
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
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
      {items.map((item, index) => (
        <li key={`${index}:${item}`}>{item}</li>
      ))}
    </ul>
  );
}

function OrderedListBlock({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p>{emptyLabel}</p>;
  }

  return (
    <ol className="result-list result-list--ordered">
      {items.map((item, index) => (
        <li key={`${index}:${item}`}>{item}</li>
      ))}
    </ol>
  );
}

function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  return (
    <span
      className={`severity-badge severity-badge--${severity.toLowerCase()}`}
      aria-label={`Severity ${severity}`}
    >
      {severity}
    </span>
  );
}

function resolveAssistantState(
  requestPhase: RequestPhase,
  severity: IncidentSeverity | undefined,
  apiError: string | null
): "idle" | "analyzing" | "ready" | "elevated" | "error" {
  if (requestPhase === "analyzing" || requestPhase === "refining") {
    return "analyzing";
  }
  if (apiError) {
    return "error";
  }
  if (severity === "HIGH" || severity === "CRITICAL") {
    return "elevated";
  }
  if (severity) {
    return "ready";
  }
  return "idle";
}

function statusLabel(
  requestPhase: RequestPhase,
  severity: IncidentSeverity | undefined,
  apiError: string | null
) {
  if (requestPhase === "analyzing") {
    return "Analyzing";
  }
  if (requestPhase === "refining") {
    return "Refining";
  }
  if (apiError) {
    return "Needs attention";
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
  return questions.reduce<Record<string, string>>((accumulator, question, index) => {
    accumulator[`${index}:${question}`] = "";
    return accumulator;
  }, {});
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createMarkdownReport(incident: AnalyzeIncidentRequest, report: IncidentTriageReport) {
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

## Logs / Stack Trace
\`\`\`
${incident.logsOrStackTrace}
\`\`\`

## Recent Deploy Notes
${incident.recentDeployNotes.trim() || "Not provided."}

## Summary
${report.summary}

## Severity
${report.severity}

## Suspected Component
${report.suspectedComponent}

## Probable Causes
${report.probableCauses.map((cause) => `- ${cause}`).join("\n")}

## Next Steps
${report.nextSteps.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## Confidence
${Math.round(report.confidence * 100)}%

## Clarifying Questions
${followUpSection}
`;
}
