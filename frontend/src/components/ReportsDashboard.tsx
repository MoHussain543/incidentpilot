import { formatIncidentDate, type SavedIncidentSummary } from "../incidentHistory";
import type { IncidentSeverity } from "../types";

type DashboardPhase = "loading" | "ready" | "error";

type ReportsDashboardProps = {
  incidents: SavedIncidentSummary[];
  phase: DashboardPhase;
  errorMessage: string | null;
  onRefresh: () => void;
  onSelectIncident: (incidentId: string) => void;
};

export default function ReportsDashboard({
  incidents,
  phase,
  errorMessage,
  onRefresh,
  onSelectIncident
}: ReportsDashboardProps) {
  const elevatedCount = incidents.filter(
    (incident) => incident.latestSeverity === "HIGH" || incident.latestSeverity === "CRITICAL"
  ).length;
  const refinedCount = incidents.filter((incident) => incident.reportCount > 1).length;

  return (
    <section className="reports-dashboard" aria-labelledby="reports-dashboard-heading">
      <div className="reports-dashboard__toolbar">
        <div>
          <h2 id="reports-dashboard-heading" className="reports-dashboard__title">
            Your saved reports
          </h2>
          <p className="reports-dashboard__subtitle">
            Incidents analyzed under your account, newest first. Open any report to review versions or refine.
          </p>
        </div>
        <button
          className="secondary-button secondary-button--compact"
          type="button"
          onClick={onRefresh}
          disabled={phase === "loading"}
        >
          {phase === "loading" ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {incidents.length > 0 ? (
        <div className="reports-dashboard__stats" aria-label="Report summary">
          <StatCard label="Total incidents" value={String(incidents.length)} />
          <StatCard label="Elevated severity" value={String(elevatedCount)} tone={elevatedCount > 0 ? "warning" : "default"} />
          <StatCard label="Refined reports" value={String(refinedCount)} tone={refinedCount > 0 ? "accent" : "default"} />
        </div>
      ) : null}

      {phase === "loading" && incidents.length === 0 ? (
        <div className="reports-dashboard__grid" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="reports-card reports-card--skeleton" key={index}>
              <div className="loading-panel__line" />
              <div className="loading-panel__line loading-panel__line--medium" />
              <div className="loading-panel__line loading-panel__line--short" />
            </div>
          ))}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="message-banner message-banner--error" role="alert">
          <strong>Reports unavailable</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      {phase === "ready" && incidents.length === 0 ? (
        <div className="reports-dashboard__empty">
          <p className="reports-dashboard__empty-title">No saved reports yet</p>
          <p>
            Run an analysis from <strong>New Analysis</strong> and your first incident will land here automatically.
          </p>
        </div>
      ) : null}

      {incidents.length > 0 ? (
        <ul className="reports-dashboard__grid">
          {incidents.map((incident) => (
            <li key={incident.id}>
              <button
                type="button"
                className="reports-card"
                onClick={() => onSelectIncident(incident.id)}
              >
                <div className="reports-card__header">
                  <h3 className="reports-card__title">{incident.title}</h3>
                  {incident.latestSeverity ? (
                    <SeverityBadge severity={incident.latestSeverity} />
                  ) : (
                    <span className="reports-card__severity reports-card__severity--unknown">No report</span>
                  )}
                </div>

                <dl className="reports-card__meta">
                  <div className="reports-card__meta-item">
                    <dt>Service</dt>
                    <dd>{incident.serviceName}</dd>
                  </div>
                  <div className="reports-card__meta-item">
                    <dt>Environment</dt>
                    <dd>{incident.environment}</dd>
                  </div>
                  <div className="reports-card__meta-item">
                    <dt>Created</dt>
                    <dd>
                      <time dateTime={incident.createdAt}>{formatIncidentDate(incident.createdAt)}</time>
                    </dd>
                  </div>
                </dl>

                <div className="reports-card__footer">
                  <span className="reports-card__versions">
                    {incident.reportCount === 1
                      ? "1 report version"
                      : `${incident.reportCount} report versions`}
                  </span>
                  <span className="reports-card__action" aria-hidden="true">
                    Open report →
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function StatCard({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "warning" | "accent";
}) {
  return (
    <div className={`reports-stat reports-stat--${tone}`}>
      <span className="reports-stat__label">{label}</span>
      <strong className="reports-stat__value">{value}</strong>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  return (
    <span
      className={`severity-badge severity-badge--${severity.toLowerCase()}`}
      aria-label={`Latest severity ${severity}`}
    >
      {severity}
    </span>
  );
}
