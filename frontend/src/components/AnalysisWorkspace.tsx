import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ApiError, analyzeIncident } from "../api";
import { INCIDENT_LIMITS } from "../incidentLimits";
import { fetchSavedIncidentDetail, type SavedIncidentDetail } from "../incidentDetail";
import { persistAnalyzeResult } from "../incidentPersistence";
import { supabase } from "../supabase";
import type { AnalyzeIncidentRequest } from "../types";
import { validateIncidentForm } from "../validateIncidentForm";
import {
  buildEphemeralIncidentDetail,
  initialFormValues,
  resolvePersistenceWarning,
  type RequestPhase
} from "../workspaceShared";
import AnalyzingOverlay from "./AnalyzingOverlay";
import IncidentIntakeForm from "./IncidentIntakeForm";
import InvestigationSession from "./InvestigationSession";

type AnalysisWorkspaceProps = {
  userId: string;
  userEmail: string;
  onIncidentSaved?: () => void;
};

type WorkspaceScreen = "intake" | "investigation";

export default function AnalysisWorkspace({ userId, userEmail, onIncidentSaved }: AnalysisWorkspaceProps) {
  const [screen, setScreen] = useState<WorkspaceScreen>("intake");
  const [formValues, setFormValues] = useState<AnalyzeIncidentRequest>(initialFormValues);
  const [requestPhase, setRequestPhase] = useState<RequestPhase>("idle");
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [investigationDetail, setInvestigationDetail] = useState<SavedIncidentDetail | null>(null);
  const [persistWarning, setPersistWarning] = useState<string | null>(null);

  const analyzing = requestPhase === "analyzing";
  const busy = analyzing;

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
      let detail: SavedIncidentDetail | null = null;
      let warning: string | null = null;

      if (supabase) {
        try {
          const persisted = await persistAnalyzeResult(supabase, userId, userEmail, formValues, nextReport);
          detail = await fetchSavedIncidentDetail(supabase, userId, persisted.incidentId);
          onIncidentSaved?.();
        } catch (error) {
          warning = resolvePersistenceWarning(error);
          detail = buildEphemeralIncidentDetail(formValues, nextReport);
        }
      } else {
        detail = buildEphemeralIncidentDetail(formValues, nextReport);
      }

      setInvestigationDetail(detail);
      setPersistWarning(warning);
      setScreen("investigation");
      setRequestPhase("success");
      setStatusMessage("Incident analysis is ready.");
    } catch (error) {
      handleApiError(error, "Incident analysis failed.");
    }
  }

  function handleApiError(error: unknown, fallbackMessage: string) {
    if (error instanceof ApiError) {
      setApiError(error.message);
      setFieldErrors(error.fieldErrors);
      setStatusMessage("Analysis failed. Review the highlighted fields and try again.");
    } else {
      setApiError(fallbackMessage);
      setFieldErrors({});
      setStatusMessage("Analysis failed. Review the error and try again.");
    }
    setRequestPhase("error");
  }

  function handleStartNewIncident() {
    setFormValues(initialFormValues);
    setInvestigationDetail(null);
    setPersistWarning(null);
    setScreen("intake");
    setRequestPhase("idle");
    setApiError(null);
    setFieldErrors({});
    setStatusMessage("Ready for a new incident.");
  }

  function updateField<K extends keyof AnalyzeIncidentRequest>(field: K, value: AnalyzeIncidentRequest[K]) {
    setFormValues((current) => ({
      ...current,
      [field]: value
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

  if (screen === "investigation" && investigationDetail) {
    return (
      <InvestigationSession
        userId={userId}
        detail={investigationDetail}
        backLabel="New incident"
        onBack={handleStartNewIncident}
        onIncidentUpdated={onIncidentSaved}
        initialPersistWarning={persistWarning}
        canRefine={investigationDetail.id !== "ephemeral"}
      />
    );
  }

  return (
    <div className={`workspace-page workspace-page--intake${analyzing ? " workspace-page--analyzing" : ""}`}>
      <section className="workspace-page-header">
        <div>
          <p className="eyebrow">New analysis</p>
          <h1>Incident intake</h1>
          <p className="workspace-page-header__lede">
            Gather the raw signal from your alert, logs, and deploy context. Analysis opens a dedicated investigation
            view when the triage report is ready.
          </p>
        </div>
        <div className="workspace-page-header__status">
          <span className={`status-pill status-pill--${analyzing ? "analyzing" : apiError ? "error" : "idle"}`}>
            {analyzing ? "Analyzing" : apiError ? "Needs attention" : "Ready to analyze"}
          </span>
          <p className="workspace-page-header__note">
            Built for production issues, not open-ended chatbot drift.
          </p>
        </div>
      </section>

      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>

      <section className="intake-layout">
        <IncidentIntakeForm
          formValues={formValues}
          fieldErrors={fieldErrors}
          apiError={apiError}
          busy={busy}
          onSubmit={handleAnalyzeSubmit}
          onFieldChange={updateField}
          onFileUpload={handleFileUpload}
        />

        <aside className="intake-guide" aria-label="Intake tips">
          <p className="panel__eyebrow">What to include</p>
          <h2>Stronger signal, sharper triage</h2>
          <ul className="intake-guide__list">
            <li>Alert text or paging summary that triggered the investigation.</li>
            <li>The most relevant stack trace or error lines — not the entire log stream.</li>
            <li>Deploy notes, config edits, or secret rotations from the last few hours.</li>
          </ul>
          <p className="intake-guide__note">
            After you submit, the workspace transitions into analysis mode and then opens your investigation report.
          </p>
        </aside>
      </section>

      {analyzing ? <AnalyzingOverlay phase="analyzing" incidentTitle={formValues.title || undefined} /> : null}
    </div>
  );
}
