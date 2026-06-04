import { formatIncidentDate } from "../incidentHistory";
import type { SavedReportVersion } from "../incidentDetail";
import type { IncidentSeverity } from "../types";

type ReportVersionListProps = {
  reports: SavedReportVersion[];
  latestVersion: number;
  selectedVersion: number;
  onSelectVersion: (version: number) => void;
};

export default function ReportVersionList({
  reports,
  latestVersion,
  selectedVersion,
  onSelectVersion
}: ReportVersionListProps) {
  return (
    <section className="version-list" aria-label="Report version history">
      <div className="version-list__header">
        <p className="panel__eyebrow">Report history</p>
        <h3>{reports.length} saved version{reports.length === 1 ? "" : "s"}</h3>
        <p className="panel__helper">Newest first. Refinements append a version without overwriting earlier reports.</p>
      </div>

      <ol className="version-list__items">
        {reports.map((entry) => {
          const isLatest = entry.version === latestVersion;
          const isSelected = entry.version === selectedVersion;

          return (
            <li key={entry.version}>
              <button
                type="button"
                className={`version-card${isSelected ? " version-card--selected" : ""}${isLatest ? " version-card--latest" : ""}`}
                onClick={() => onSelectVersion(entry.version)}
                aria-pressed={isSelected}
              >
                <div className="version-card__topline">
                  <span className="version-card__label">
                    Version {entry.version}
                    {isLatest ? " · Latest" : ""}
                  </span>
                  <SeverityBadge severity={entry.report.severity} />
                </div>
                <p className="version-card__summary">{entry.report.summary}</p>
                <p className="version-card__meta">
                  <time dateTime={entry.createdAt}>{formatIncidentDate(entry.createdAt)}</time>
                  {entry.followUpAnswers && entry.followUpAnswers.length > 0 ? (
                    <span> · Refined with {entry.followUpAnswers.length} answer(s)</span>
                  ) : entry.version === 1 ? (
                    <span> · Initial analysis</span>
                  ) : null}
                </p>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  return <span className={`severity-badge severity-badge--${severity.toLowerCase()}`}>{severity}</span>;
}
