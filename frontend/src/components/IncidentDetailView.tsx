import { formatIncidentDate } from "../incidentHistory";
import type { SavedIncidentDetail } from "../incidentDetail";
import { statusLabel } from "../workspaceShared";
import AssistantBot from "./AssistantBot";
import IncidentContextPanel from "./IncidentContextPanel";
import ReportVersionList from "./ReportVersionList";
import TriageReportPanel from "./TriageReportPanel";
import type { IncidentTriageReport } from "../types";

type IncidentDetailViewProps = {
  detail: SavedIncidentDetail;
  selectedVersion: number;
  report: IncidentTriageReport;
  assistantState: "idle" | "analyzing" | "ready" | "elevated" | "error";
  busy: boolean;
  requestPhase: "idle" | "analyzing" | "refining" | "success" | "error";
  followUpAnswers: Record<string, string>;
  apiError: string | null;
  persistWarning: string | null;
  detailLoading: boolean;
  onBack: () => void;
  backLabel?: string;
  onSelectVersion: (version: number) => void;
  onFollowUpChange: (questionKey: string, answer: string) => void;
  onRefine: () => void;
  onCopySummary: () => void;
  onExportMarkdown: () => void;
};

export default function IncidentDetailView({
  detail,
  selectedVersion,
  report,
  assistantState,
  busy,
  requestPhase,
  followUpAnswers,
  apiError,
  persistWarning,
  detailLoading,
  onBack,
  backLabel = "Back to new analysis",
  onSelectVersion,
  onFollowUpChange,
  onRefine,
  onCopySummary,
  onExportMarkdown
}: IncidentDetailViewProps) {
  const viewingLatest = selectedVersion === detail.latestVersion;
  const selectedEntry = detail.reports.find((entry) => entry.version === selectedVersion);

  return (
    <section className="investigation-workspace" aria-labelledby="investigation-title">
      <header className="investigation-header">
        <div className="investigation-header__top">
          <button className="investigation-header__back secondary-button secondary-button--compact" type="button" onClick={onBack}>
            {backLabel}
          </button>
          <p className="investigation-header__crumb">
            Reports <span aria-hidden="true">/</span> {detail.context.title}
          </p>
        </div>

        <div className="investigation-header__main">
          <div className="investigation-header__identity">
            <p className="eyebrow">Investigation workspace</p>
            <h2 id="investigation-title" className="investigation-header__title">
              {detail.context.title}
            </h2>
            <ul className="investigation-header__chips" aria-label="Incident metadata">
              <li>{detail.context.serviceName}</li>
              <li>{detail.context.environment}</li>
              <li>
                Opened <time dateTime={detail.updatedAt}>{formatIncidentDate(detail.updatedAt)}</time>
              </li>
              <li>
                {detail.reports.length} version{detail.reports.length === 1 ? "" : "s"}
              </li>
            </ul>
          </div>

          <div className="investigation-header__status">
            <AssistantBot state={assistantState} />
            <span className={`status-pill status-pill--${assistantState}`}>
              {statusLabel(requestPhase, report.severity, apiError)}
            </span>
            <p className="investigation-header__status-note">
              {viewingLatest
                ? "Viewing the latest report. Refinement is available when clarifying questions remain."
                : `Reading version ${selectedVersion}. Return to version ${detail.latestVersion} to refine.`}
            </p>
          </div>
        </div>
      </header>

      <div className="investigation-layout">
        <aside className="investigation-zone investigation-zone--context" aria-labelledby="investigation-context-heading">
          <IncidentContextPanel
            context={detail.context}
            createdAt={detail.createdAt}
            updatedAt={detail.updatedAt}
          />
        </aside>

        <aside className="investigation-zone investigation-zone--timeline" aria-labelledby="investigation-timeline-heading">
          <ReportVersionList
            reports={detail.reports}
            latestVersion={detail.latestVersion}
            selectedVersion={selectedVersion}
            onSelectVersion={onSelectVersion}
          />
        </aside>

        <main className="investigation-zone investigation-zone--report" aria-labelledby="investigation-report-heading">
          <div className="investigation-report__header">
            <div>
              <p className="panel__eyebrow" id="investigation-report-heading">
                {viewingLatest ? "Latest report" : "Prior report"}
              </p>
              <h3 className="investigation-report__title">
                Version {selectedVersion}
                {viewingLatest ? (
                  <span className="investigation-report__latest-badge">Latest</span>
                ) : null}
              </h3>
              {selectedEntry ? (
                <p className="panel__helper">
                  Saved <time dateTime={selectedEntry.createdAt}>{formatIncidentDate(selectedEntry.createdAt)}</time>
                  {selectedEntry.followUpAnswers && selectedEntry.followUpAnswers.length > 0
                    ? ` · Refined with ${selectedEntry.followUpAnswers.length} follow-up answer(s)`
                    : selectedEntry.version === 1
                      ? " · Initial analysis"
                      : ""}
                </p>
              ) : null}
            </div>
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

          {detailLoading || busy ? (
            <div className="loading-panel" aria-hidden="true">
              <div className="loading-panel__line" />
              <div className="loading-panel__line loading-panel__line--medium" />
              <div className="loading-panel__line loading-panel__line--short" />
              <p>{requestPhase === "refining" ? "Refining the report..." : "Loading saved incident..."}</p>
            </div>
          ) : (
            <TriageReportPanel
              report={report}
              viewingLatest={viewingLatest}
              selectedVersion={selectedVersion}
              latestVersion={detail.latestVersion}
              busy={busy}
              requestPhase={requestPhase}
              followUpAnswers={followUpAnswers}
              onFollowUpChange={onFollowUpChange}
              onRefine={viewingLatest ? onRefine : undefined}
              onCopySummary={onCopySummary}
              onExportMarkdown={onExportMarkdown}
              compactHeader
            />
          )}
        </main>
      </div>
    </section>
  );
}
