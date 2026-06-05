import AssistantBot from "./AssistantBot";
import IncidentContextPanel from "./IncidentContextPanel";
import ReportVersionList from "./ReportVersionList";
import TriageReportPanel from "./TriageReportPanel";
import type { SavedIncidentDetail } from "../incidentDetail";
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

  return (
    <section className="detail-layout">
      <div className="detail-layout__toolbar">
        <button className="secondary-button" type="button" onClick={onBack}>
          {backLabel}
        </button>
        <div>
          <p className="panel__eyebrow">Saved incident</p>
          <h2 className="detail-layout__title">{detail.context.title}</h2>
          <p className="detail-layout__meta">
            {detail.context.serviceName} · {detail.context.environment}
          </p>
        </div>
      </div>

      <div className="detail-grid">
        <IncidentContextPanel
          context={detail.context}
          createdAt={detail.createdAt}
          updatedAt={detail.updatedAt}
        />

        <section className="panel panel--results panel--detail" aria-busy={busy || detailLoading}>
          <div className="results-hero">
            <div>
              <p className="panel__eyebrow">Saved analysis</p>
              <h2>Report workspace</h2>
              <p className="panel__helper">
                Review prior refinements or continue from the latest report without losing earlier versions.
              </p>
            </div>
            <AssistantBot state={assistantState} />
          </div>

          <ReportVersionList
            reports={detail.reports}
            latestVersion={detail.latestVersion}
            selectedVersion={selectedVersion}
            onSelectVersion={onSelectVersion}
          />

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
            />
          )}
        </section>
      </div>
    </section>
  );
}
