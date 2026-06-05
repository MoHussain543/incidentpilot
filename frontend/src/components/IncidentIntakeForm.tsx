import type { ChangeEvent, FormEvent } from "react";
import { INCIDENT_LIMITS } from "../incidentLimits";
import type { AnalyzeIncidentRequest } from "../types";
import { ENVIRONMENT_SUGGESTIONS } from "../workspaceShared";
import Field from "./Field";

type IncidentIntakeFormProps = {
  formValues: AnalyzeIncidentRequest;
  fieldErrors: Record<string, string>;
  apiError: string | null;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFieldChange: <K extends keyof AnalyzeIncidentRequest>(field: K, value: AnalyzeIncidentRequest[K]) => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
};

export default function IncidentIntakeForm({
  formValues,
  fieldErrors,
  apiError,
  busy,
  onSubmit,
  onFieldChange,
  onFileUpload
}: IncidentIntakeFormProps) {
  const logsLength = formValues.logsOrStackTrace.length;
  const logsNearLimit = logsLength > INCIDENT_LIMITS.logsOrStackTrace * 0.9;

  return (
    <form className="panel panel--form panel--intake" onSubmit={onSubmit} aria-busy={busy} noValidate>
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Signal in</p>
          <h2>Incident context</h2>
        </div>
        <p className="panel__helper">
          Paste the alert, logs, and deploy notes. IncidentPilot turns this into a structured triage report.
        </p>
      </div>

      {apiError ? (
        <div className="message-banner message-banner--error" role="alert">
          <strong>Could not analyze incident</strong>
          <p>{apiError}</p>
        </div>
      ) : null}

      <div className="field-grid field-grid--double">
        <Field
          id="title"
          label="Incident title"
          value={formValues.title}
          error={fieldErrors.title}
          onChange={(value) => onFieldChange("title", value)}
          placeholder="Checkout failures after deploy"
        />
        <Field
          id="serviceName"
          label="Service name"
          value={formValues.serviceName}
          error={fieldErrors.serviceName}
          onChange={(value) => onFieldChange("serviceName", value)}
          placeholder="payments-api"
        />
      </div>

      <div className="field-grid field-grid--double">
        <Field
          id="environment"
          label="Environment"
          value={formValues.environment}
          error={fieldErrors.environment}
          onChange={(value) => onFieldChange("environment", value)}
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
          onChange={(value) => onFieldChange("alertMessage", value)}
          placeholder="HTTP 500 spike in checkout"
        />
      </div>

      <Field
        id="logsOrStackTrace"
        label="Logs or stack trace"
        value={formValues.logsOrStackTrace}
        error={fieldErrors.logsOrStackTrace}
        onChange={(value) => onFieldChange("logsOrStackTrace", value)}
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
          onChange={onFileUpload}
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
        onChange={(value) => onFieldChange("recentDeployNotes", value)}
        placeholder="What changed recently? New release, config edit, secret rotation, migration, or rollback notes."
        multiline
        rows={5}
      />

      <div className="panel__footer">
        <div className="panel__actions">
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Analyzing incident..." : "Analyze incident"}
          </button>
        </div>
        <p className="panel__footnote">
          After analysis, you will land on an investigation view with the triage report and follow-up options.
        </p>
      </div>
    </form>
  );
}
