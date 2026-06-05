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
    <section className="version-timeline" aria-labelledby="investigation-timeline-heading">
      <div className="version-timeline__header">
        <p className="panel__eyebrow">Refinement history</p>
        <h3 id="investigation-timeline-heading">Report versions</h3>
        <p className="panel__helper">
          Newest at the top. Each refinement adds a version without overwriting earlier analysis.
        </p>
      </div>

      <ol className="version-timeline__list">
        {reports.map((entry, index) => {
          const isLatest = entry.version === latestVersion;
          const isSelected = entry.version === selectedVersion;
          const isInitial = entry.version === 1;
          const refinementLabel =
            entry.followUpAnswers && entry.followUpAnswers.length > 0
              ? `Refined · ${entry.followUpAnswers.length} answer(s)`
              : isInitial
                ? "Initial analysis"
                : "Refinement";

          return (
            <li
              key={entry.version}
              className={`version-timeline__item${isLatest ? " version-timeline__item--latest" : ""}${isSelected ? " version-timeline__item--selected" : ""}`}
            >
              <span className="version-timeline__marker" aria-hidden="true">
                <span className="version-timeline__dot" />
                {index < reports.length - 1 ? <span className="version-timeline__line" /> : null}
              </span>

              <button
                type="button"
                className="version-timeline__card"
                onClick={() => onSelectVersion(entry.version)}
                aria-pressed={isSelected}
                aria-label={`Version ${entry.version}${isLatest ? ", latest" : ""}, ${entry.report.severity} severity`}
              >
                <div className="version-timeline__card-top">
                  <div className="version-timeline__labels">
                    <span className="version-timeline__version">
                      Version {entry.version}
                      {isLatest ? " · Latest" : ""}
                    </span>
                    {isLatest ? <span className="version-timeline__latest-pill">Current</span> : null}
                  </div>
                  <SeverityBadge severity={entry.report.severity} />
                </div>

                <p className="version-timeline__kind">{refinementLabel}</p>
                <p className="version-timeline__summary">{entry.report.summary}</p>
                <p className="version-timeline__meta">
                  <time dateTime={entry.createdAt}>{formatIncidentDate(entry.createdAt)}</time>
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
  return (
    <span
      className={`severity-badge severity-badge--${severity.toLowerCase()}`}
      aria-label={`Severity ${severity}`}
    >
      {severity}
    </span>
  );
}
