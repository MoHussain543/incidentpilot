import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { ApiError, analyzeIncident, refineIncident } from "./api";
import { IncidentAccessError } from "./incidentAccess";
import AssistantBot from "./components/AssistantBot";
import IncidentDetailView from "./components/IncidentDetailView";
import IncidentHistoryPanel from "./components/IncidentHistoryPanel";
import TriageReportPanel from "./components/TriageReportPanel";
import {
  fetchSavedIncidentDetail,
  type SavedIncidentDetail
} from "./incidentDetail";
import { INCIDENT_LIMITS } from "./incidentLimits";
import {
  fetchSavedIncidents,
  IncidentHistoryError,
  type SavedIncidentSummary
} from "./incidentHistory";
import {
  IncidentPersistenceError,
  persistAnalyzeResult,
  persistRefineResult
} from "./incidentPersistence";
import { hasSupabaseConfig, supabase } from "./supabase";
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
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setAuthReady(true);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (!hasSupabaseConfig || !supabase) {
    return <SupabaseConfigNotice />;
  }

  if (!authReady) {
    return <LoadingShell message="Restoring your session." />;
  }

  if (!session) {
    return <AuthGate />;
  }

  return (
    <IncidentWorkspace
      userId={session.user.id}
      userEmail={session.user.email ?? "Signed-in user"}
    />
  );
}

function IncidentWorkspace({ userId, userEmail }: { userId: string; userEmail: string }) {
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
  const [savedIncidents, setSavedIncidents] = useState<SavedIncidentSummary[]>([]);
  const [historyPhase, setHistoryPhase] = useState<"loading" | "ready" | "error">("loading");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [openedIncidentDetail, setOpenedIncidentDetail] = useState<SavedIncidentDetail | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedReportVersion, setSelectedReportVersion] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const reportIsStale = Boolean(
    !openedIncidentDetail &&
      report &&
      lastSubmittedIncident &&
      !incidentsMatch(lastSubmittedIncident, formValues)
  );
  const assistantState = resolveAssistantState(requestPhase, report?.severity, apiError);
  const busy = requestPhase === "analyzing" || requestPhase === "refining";
  const logsLength = formValues.logsOrStackTrace.length;
  const logsNearLimit = logsLength > INCIDENT_LIMITS.logsOrStackTrace * 0.9;

  const refreshHistory = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setHistoryPhase("loading");
    setHistoryError(null);

    try {
      const incidents = await fetchSavedIncidents(supabase, userId);
      setSavedIncidents(incidents);
      setHistoryPhase("ready");
    } catch (error) {
      setHistoryPhase("error");
      setHistoryError(resolveHistoryError(error));
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  function applyReportVersion(detail: SavedIncidentDetail, version: number) {
    const entry = detail.reports.find((reportVersion) => reportVersion.version === version);
    if (!entry) {
      return;
    }

    setSelectedReportVersion(version);
    setFormValues(detail.context);
    setLastSubmittedIncident(detail.context);
    setPersistedIncidentId(detail.id);
    setReport(entry.report);
    setFollowUpAnswers(createEmptyAnswers(entry.report.clarifyingQuestions));
    setRequestPhase("success");
    setApiError(null);
  }

  async function reloadOpenedIncident(incidentId: string) {
    if (!supabase) {
      return;
    }

    const detail = await fetchSavedIncidentDetail(supabase, userId, incidentId);
    setOpenedIncidentDetail(detail);
    applyReportVersion(detail, detail.latestVersion);
  }

  async function handleOpenIncident(incidentId: string) {
    if (!supabase) {
      return;
    }

    setDetailLoading(true);
    setSelectedIncidentId(incidentId);
    setApiError(null);
    setPersistWarning(null);

    try {
      const detail = await fetchSavedIncidentDetail(supabase, userId, incidentId);
      setOpenedIncidentDetail(detail);
      applyReportVersion(detail, detail.latestVersion);
      setStatusMessage(`Opened saved incident: ${detail.context.title}`);
    } catch (error) {
      setOpenedIncidentDetail(null);
      setSelectedIncidentId(null);
      setSelectedReportVersion(null);
      setApiError(resolveHistoryError(error));
      setStatusMessage("Could not open the saved incident.");
    } finally {
      setDetailLoading(false);
    }
  }

  function handleCloseDetail() {
    setOpenedIncidentDetail(null);
    setSelectedIncidentId(null);
    setSelectedReportVersion(null);
    setDetailLoading(false);
    handleResetIncident();
  }

  function handleSelectReportVersion(version: number) {
    if (!openedIncidentDetail) {
      return;
    }

    applyReportVersion(openedIncidentDetail, version);
  }

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
    setOpenedIncidentDetail(null);
    setSelectedIncidentId(null);
    setSelectedReportVersion(null);

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
          await refreshHistory();
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
          await refreshHistory();
          if (openedIncidentDetail) {
            setDetailLoading(true);
            await reloadOpenedIncident(persistedIncidentId);
            setDetailLoading(false);
          }
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
    setOpenedIncidentDetail(null);
    setSelectedIncidentId(null);
    setSelectedReportVersion(null);
    setDetailLoading(false);
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
        <div className="hero-status hero-status--account">
          <div className="hero-status__account">
            <span className="hero-status__label">Signed in</span>
            <strong>{userEmail}</strong>
          </div>
          <span className={`status-pill status-pill--${assistantState}`}>
            {statusLabel(requestPhase, report?.severity, apiError)}
          </span>
          <p className="hero-status__note">
            Built for production issues, not open-ended chatbot drift.
          </p>
          <button className="secondary-button secondary-button--compact" type="button" onClick={handleSignOut}>
            Log out
          </button>
        </div>
      </section>

      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>

      <IncidentHistoryPanel
        incidents={savedIncidents}
        phase={historyPhase}
        errorMessage={historyError}
        activeIncidentId={persistedIncidentId}
        selectedIncidentId={selectedIncidentId}
        onRefresh={refreshHistory}
        onSelectIncident={handleOpenIncident}
      />

      {openedIncidentDetail && selectedReportVersion !== null && report ? (
        <IncidentDetailView
          detail={openedIncidentDetail}
          selectedVersion={selectedReportVersion}
          report={report}
          assistantState={assistantState}
          busy={busy}
          requestPhase={requestPhase}
          followUpAnswers={followUpAnswers}
          apiError={apiError}
          persistWarning={persistWarning}
          detailLoading={detailLoading}
          onBack={handleCloseDetail}
          onSelectVersion={handleSelectReportVersion}
          onFollowUpChange={updateFollowUp}
          onRefine={handleRefineSubmit}
          onCopySummary={copySummary}
          onExportMarkdown={exportMarkdown}
        />
      ) : (
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
      )}
    </main>
  );

  async function handleSignOut() {
    await supabase?.auth.signOut();
  }
}

function AuthGate() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState("Create an account to save incidents and make IncidentPilot a real workspace.");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });
        if (error) {
          throw error;
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password
        });
        if (error) {
          throw error;
        }

        if (!data.session) {
          setNotice("Check your email to confirm your account, then come back and sign in.");
        } else {
          setNotice("Account created. You are now signed in.");
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed. Please try again.";
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="app-shell app-shell--auth">
      <div className="app-shell__backdrop app-shell__backdrop--left" />
      <div className="app-shell__backdrop app-shell__backdrop--right" />

      <section className="auth-layout">
        <div className="auth-copy">
          <p className="eyebrow">Incident triage SaaS</p>
          <h1>IncidentPilot</h1>
          <p className="hero-copy">
            Sign in to save incident investigations, build history over time, and turn the MVP into a persistent
            ops workspace.
          </p>
          <ul className="auth-copy__list">
            <li>Secure session handling with Supabase Auth</li>
            <li>Room for saved incidents, reports, and account-level history</li>
            <li>The existing AI triage workflow stays exactly where it is once you are signed in</li>
          </ul>
        </div>

        <section className="panel panel--auth">
          <div className="panel__header panel__header--stacked">
            <div>
              <p className="panel__eyebrow">{mode === "sign-in" ? "Welcome back" : "Create your workspace"}</p>
              <h2>{mode === "sign-in" ? "Sign in" : "Create account"}</h2>
            </div>
            <p className="panel__helper">{notice}</p>
          </div>

          {errorMessage ? (
            <div className="message-banner message-banner--error" role="alert">
              <strong>Authentication issue</strong>
              <p>{errorMessage}</p>
            </div>
          ) : null}

          <form className="auth-form" onSubmit={handleSubmit}>
            <Field
              id="auth-email"
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="you@company.com"
            />
            <Field
              id="auth-password"
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="Choose a strong password"
            />

            <div className="panel__actions panel__actions--stacked">
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? "Working..." : mode === "sign-in" ? "Sign in" : "Create account"}
              </button>
              <button
                className="secondary-button secondary-button--compact"
                type="button"
                onClick={() => {
                  setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
                  setErrorMessage(null);
                  setNotice(
                    mode === "sign-in"
                      ? "Use a strong password. Supabase will create the linked profile record automatically."
                      : "Create an account to save incidents and make IncidentPilot a real workspace."
                  );
                }}
              >
                {mode === "sign-in" ? "Need an account?" : "Already have an account?"}
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}

function SupabaseConfigNotice() {
  return (
    <main className="app-shell app-shell--auth">
      <div className="app-shell__backdrop app-shell__backdrop--left" />
      <div className="app-shell__backdrop app-shell__backdrop--right" />
      <section className="auth-layout">
        <div className="auth-copy">
          <p className="eyebrow">Supabase setup</p>
          <h1>IncidentPilot</h1>
          <p className="hero-copy">
            Supabase auth is not configured yet. Add the publishable frontend credentials locally, then reload the app.
          </p>
        </div>

        <section className="panel panel--auth">
          <div className="panel__header panel__header--stacked">
            <div>
              <p className="panel__eyebrow">Missing environment variables</p>
              <h2>Frontend config needed</h2>
            </div>
          </div>
          <pre className="config-block">VITE_SUPABASE_URL=...\nVITE_SUPABASE_PUBLISHABLE_KEY=...\nVITE_API_BASE_URL=http://localhost:8080</pre>
        </section>
      </section>
    </main>
  );
}

function LoadingShell({ message }: { message: string }) {
  return (
    <main className="app-shell app-shell--auth">
      <div className="app-shell__backdrop app-shell__backdrop--left" />
      <div className="app-shell__backdrop app-shell__backdrop--right" />
      <section className="auth-layout">
        <section className="panel panel--auth">
          <div className="loading-panel">
            <div className="loading-panel__line" />
            <div className="loading-panel__line loading-panel__line--medium" />
            <div className="loading-panel__line loading-panel__line--short" />
            <p>{message}</p>
          </div>
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

function resolveHistoryError(error: unknown) {
  if (error instanceof IncidentAccessError) {
    return error.message;
  }
  if (error instanceof IncidentHistoryError) {
    return error.message;
  }
  return "Saved incident history could not be loaded.";
}

function resolvePersistenceWarning(error: unknown) {
  if (error instanceof IncidentPersistenceError) {
    return `${error.message} The analysis is still visible here, but it was not saved to your account history.`;
  }
  return "The analysis completed, but it could not be saved to your account history.";
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
