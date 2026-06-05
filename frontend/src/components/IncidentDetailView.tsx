import { useEffect, useState } from "react";
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
  onRefine?: () => void;
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
  const selectedIndex = detail.reports.findIndex((entry) => entry.version === selectedVersion);
  const newerEntry = selectedIndex > 0 ? detail.reports[selectedIndex - 1] : null;
  const olderEntry =
    selectedIndex >= 0 && selectedIndex < detail.reports.length - 1 ? detail.reports[selectedIndex + 1] : null;
  const hasRefinementHistory = detail.reports.length > 1;
  const [historyExpanded, setHistoryExpanded] = useState(selectedVersion !== detail.latestVersion);
  const [contextExpanded, setContextExpanded] = useState(false);

  useEffect(() => {
    if (selectedVersion !== detail.latestVersion) {
      setHistoryExpanded(true);
    }
  }, [selectedVersion, detail.latestVersion]);

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
            <div className="investigation-header__status-top">
              <AssistantBot state={assistantState} />
              <span className={`status-pill status-pill--${assistantState}`}>
                {statusLabel(requestPhase, report.severity, apiError)}
              </span>
            </div>
            <p className="investigation-header__status-note">
              {viewingLatest
                ? "Viewing the latest report. Refinement is available when clarifying questions remain."
                : `Reading version ${selectedVersion}. Return to version ${detail.latestVersion} to refine.`}
            </p>
          </div>
        </div>
      </header>

      <div className="investigation-layout">
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

        <aside className="investigation-zone investigation-zone--supporting">
          <section className="panel investigation-support">
            <div className="investigation-support__header">
              <div>
                <p className="panel__eyebrow">Refinement history</p>
                <h3 id="investigation-timeline-heading">
                  Version {selectedVersion} of {detail.reports.length}
                </h3>
                <p className="panel__helper">
                  {selectedEntry ? (
                    <>
                      Saved <time dateTime={selectedEntry.createdAt}>{formatIncidentDate(selectedEntry.createdAt)}</time>
                      {selectedEntry.followUpAnswers && selectedEntry.followUpAnswers.length > 0
                        ? ` · ${selectedEntry.followUpAnswers.length} follow-up answer(s)`
                        : selectedEntry.version === 1
                          ? " · Initial analysis"
                          : ""}
                    </>
                  ) : (
                    "Each refinement creates a new report version without overwriting earlier analysis."
                  )}
                </p>
              </div>

              {hasRefinementHistory ? (
                <button
                  className="secondary-button secondary-button--compact"
                  type="button"
                  onClick={() => setHistoryExpanded((current) => !current)}
                  aria-expanded={historyExpanded}
                  aria-controls="report-version-history"
                >
                  {historyExpanded ? "Hide timeline" : "View all versions"}
                </button>
              ) : null}
            </div>

            <div className="investigation-support__actions">
              <button
                className="secondary-button secondary-button--compact"
                type="button"
                onClick={() => newerEntry && onSelectVersion(newerEntry.version)}
                disabled={!newerEntry}
              >
                Newer version
              </button>
              <button
                className="secondary-button secondary-button--compact"
                type="button"
                onClick={() => olderEntry && onSelectVersion(olderEntry.version)}
                disabled={!olderEntry}
              >
                Older version
              </button>
            </div>

            {hasRefinementHistory ? (
              <div
                id="report-version-history"
                className={`investigation-support__content${historyExpanded ? "" : " investigation-support__content--collapsed"}`}
              >
                <ReportVersionList
                  reports={detail.reports}
                  latestVersion={detail.latestVersion}
                  selectedVersion={selectedVersion}
                  onSelectVersion={onSelectVersion}
                  showHeader={false}
                />
              </div>
            ) : (
              <p className="investigation-support__empty">This incident has one report version so far.</p>
            )}
          </section>

          <section className="panel investigation-support">
            <div className="investigation-support__header">
              <div>
                <p className="panel__eyebrow">Original signal</p>
                <h3 id="investigation-context-heading">Incident context</h3>
                <p className="panel__helper">
                  Kept on hand for handoffs, but tucked away so the latest report stays in focus.
                </p>
              </div>

              <button
                className="secondary-button secondary-button--compact"
                type="button"
                onClick={() => setContextExpanded((current) => !current)}
                aria-expanded={contextExpanded}
                aria-controls="incident-context-panel"
              >
                {contextExpanded ? "Hide context" : "View original context"}
              </button>
            </div>

            <ul className="investigation-support__snapshot" aria-label="Incident snapshot">
              <li>{detail.context.serviceName}</li>
              <li>{detail.context.environment}</li>
              <li>
                Alert: {detail.context.alertMessage.length > 80
                  ? `${detail.context.alertMessage.slice(0, 80).trimEnd()}...`
                  : detail.context.alertMessage}
              </li>
            </ul>

            {contextExpanded ? (
              <div id="incident-context-panel" className="investigation-support__content">
                <IncidentContextPanel
                  context={detail.context}
                  createdAt={detail.createdAt}
                  updatedAt={detail.updatedAt}
                />
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </section>
  );
}
