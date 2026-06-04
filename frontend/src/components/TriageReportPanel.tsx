import type { PropsWithChildren } from "react";
import type { IncidentSeverity, IncidentTriageReport } from "../types";

type TriageReportPanelProps = {
  report: IncidentTriageReport;
  viewingLatest: boolean;
  selectedVersion: number;
  latestVersion: number;
  busy: boolean;
  requestPhase: "idle" | "analyzing" | "refining" | "success" | "error";
  followUpAnswers: Record<string, string>;
  onFollowUpChange: (questionKey: string, answer: string) => void;
  onRefine?: () => void;
  onCopySummary: () => void;
  onExportMarkdown: () => void;
};

export default function TriageReportPanel({
  report,
  viewingLatest,
  selectedVersion,
  latestVersion,
  busy,
  requestPhase,
  followUpAnswers,
  onFollowUpChange,
  onRefine,
  onCopySummary,
  onExportMarkdown
}: TriageReportPanelProps) {
  return (
    <div className="results-stack">
      {!viewingLatest ? (
        <div className="message-banner message-banner--warning" role="status">
          <strong>Viewing an earlier report</strong>
          <p>
            You are reading version {selectedVersion} of {latestVersion}. Select the latest version to continue
            refining this incident.
          </p>
        </div>
      ) : null}

      <div className="report-topline">
        <div className="report-topline__labels">
          {viewingLatest ? <span className="report-version-tag report-version-tag--latest">Latest report</span> : null}
          <SeverityBadge severity={report.severity} />
        </div>
        <div className="report-topline__actions">
          <button className="secondary-button" type="button" onClick={onCopySummary}>
            Copy summary
          </button>
          <button className="secondary-button" type="button" onClick={onExportMarkdown}>
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

      {viewingLatest && report.clarifyingQuestions.length > 0 && onRefine ? (
        <ResultCard title="Refine the analysis">
          <p className="result-card__note">
            Answer the questions you can. Unanswered questions are skipped and can be handled in a later refinement
            pass.
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
                  onChange={(event) => onFollowUpChange(`${index}:${question}`, event.target.value)}
                  rows={3}
                  placeholder="Add the missing evidence or answer here. Leave blank to skip for now."
                />
              </div>
            ))}
            <button className="primary-button" type="button" onClick={onRefine} disabled={busy}>
              {requestPhase === "refining" ? "Refining..." : "Refine analysis"}
            </button>
          </div>
        </ResultCard>
      ) : null}

      {viewingLatest && report.clarifyingQuestions.length === 0 ? (
        <ResultCard title="Follow-up">
          <p>
            This version has no open clarifying questions. Analyze again or add more evidence if the incident
            changes.
          </p>
        </ResultCard>
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
