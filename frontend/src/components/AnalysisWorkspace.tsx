import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ApiError, analyzeIncident, refineIncident } from "../api";
import { INCIDENT_LIMITS } from "../incidentLimits";
import { persistAnalyzeResult, persistRefineResult } from "../incidentPersistence";
import { supabase } from "../supabase";
import type { AnalyzeIncidentRequest, IncidentTriageReport } from "../types";
import { incidentsMatch, validateIncidentForm } from "../validateIncidentForm";
import {
  createEmptyAnswers,
  createMarkdownReport,
  ENVIRONMENT_SUGGESTIONS,
  initialFormValues,
  resolveAssistantState,
  resolvePersistenceWarning,
  slugify,
  statusLabel,
  type RequestPhase
} from "../workspaceShared";
import AssistantBot from "./AssistantBot";
import Field from "./Field";
import TriageReportPanel from "./TriageReportPanel";

type AnalysisWorkspaceProps = {
  userId: string;
  userEmail: string;
  onIncidentSaved?: () => void;
};

export default function AnalysisWorkspace({ userId, userEmail, onIncidentSaved }: AnalysisWorkspaceProps) {
  const [formValues, setFormValues] = useState<AnalyzeIncidentRequest>(initialFormValues);
  const [report, setReport] = useState<IncidentTriageReport | null>(null);
  const [lastSubmittedIncident, setLastSubmittedIncident] = useState<AnalyzeIncidentRequest | null>(null);
  const [requestPhase, setRequestPhase] = useState<RequestPhase>("idle");
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [persistedIncidentId, setPersistedIncidentId] = useState<string | null>(null);
  const [persistWarning, setPersistWarning] = useState<string | null>(null);

  const reportIsStale = Boolean(
    report && lastSubmittedIncident && !incidentsMatch(lastSubmittedIncident, formValues)
  );
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
      setPersistWarning(null);

      if (supabase) {
        try {
          const persisted = await persistAnalyzeResult(
            supabase,
            userId,
            userEmail,
            formValues,
            nextReport
          );
          setPersistedIncidentId(persisted.incidentId);
          onIncidentSaved?.();
        } catch (error) {
          setPersistedIncidentId(null);
          setPersistWarning(resolvePersistenceWarning(error));
        }
      }

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

    if (!persistedIncidentId) {
      setApiError("This analysis is not linked to a saved incident yet. Run Analyze incident again before refining.");
      setStatusMessage("Refine requires a saved incident record.");
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
      setPersistWarning(null);

      if (supabase) {
        try {
          await persistRefineResult(supabase, userId, persistedIncidentId, nextReport, answers);
          onIncidentSaved?.();
        } catch (error) {
          setPersistWarning(resolvePersistenceWarning(error));
        }
      }

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
    setPersistedIncidentId(null);
    setPersistWarning(null);
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
    <div className="workspace-page">
      <section className="workspace-page-header">
        <div>
          <p className="eyebrow">New analysis</p>
          <h1>Incident intake</h1>
          <p className="workspace-page-header__lede">
            Paste the raw signal, get a structured diagnosis, and refine the report when the incident still has gaps.
          </p>
        </div>
        <div className="workspace-page-header__status">
          <span className={`status-pill status-pill--${assistantState}`}>
            {statusLabel(requestPhase, report?.severity, apiError)}
          </span>
          <p className="workspace-page-header__note">
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
            <p className="panel__footnote">
              Saved reports appear under Reports after a successful analysis.
            </p>
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

          {persistWarning ? (
            <div className="message-banner message-banner--warning" role="status">
              <strong>Workspace save issue</strong>
              <p>{persistWarning}</p>
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
            <TriageReportPanel
              report={report}
              viewingLatest
              selectedVersion={1}
              latestVersion={1}
              busy={busy}
              requestPhase={requestPhase}
              followUpAnswers={followUpAnswers}
              onFollowUpChange={updateFollowUp}
              onRefine={handleRefineSubmit}
              onCopySummary={copySummary}
              onExportMarkdown={exportMarkdown}
            />
          ) : null}
        </section>
      </section>
    </div>
  );
}
