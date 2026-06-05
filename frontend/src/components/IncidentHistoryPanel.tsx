import { formatIncidentDate, type SavedIncidentSummary } from "../incidentHistory";
import type { IncidentSeverity } from "../types";

type HistoryPhase = "loading" | "ready" | "error";

type IncidentHistoryPanelProps = {
  incidents: SavedIncidentSummary[];
  phase: HistoryPhase;
  errorMessage: string | null;
  activeIncidentId: string | null;
  selectedIncidentId: string | null;
  onRefresh: () => void;
  onSelectIncident: (incidentId: string) => void;
};

export default function IncidentHistoryPanel({
  incidents,
  phase,
  errorMessage,
  activeIncidentId,
  selectedIncidentId,
  onRefresh,
  onSelectIncident
}: IncidentHistoryPanelProps) {
  return (
    <section className="panel panel--history" aria-labelledby="incident-history-heading">
      <div className="history-panel__header">
        <div>
          <p className="panel__eyebrow">Your workspace</p>
          <h2 id="incident-history-heading">Saved incident history</h2>
          <p className="panel__helper">
            Every analyzed incident is stored to your account. Select one to review context and report versions.
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

      {phase === "loading" && incidents.length === 0 ? (
        <div className="history-panel__loading" aria-hidden="true">
          <div className="loading-panel__line" />
          <div className="loading-panel__line loading-panel__line--medium" />
          <div className="loading-panel__line loading-panel__line--short" />
        </div>
      ) : null}

      {errorMessage ? (
        <div className="message-banner message-banner--error" role="alert">
          <strong>History unavailable</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      {phase === "ready" && incidents.length === 0 ? (
        <div className="history-panel__empty">
          <p>No saved incidents yet.</p>
          <p className="history-panel__empty-note">
            Run your first analysis from New Analysis and it will appear here automatically.
          </p>
        </div>
      ) : null}

      {incidents.length > 0 ? (
        <ul className="history-list">
          {incidents.map((incident) => (
            <li key={incident.id}>
              <button
                type="button"
                className={`history-card${selectedIncidentId === incident.id || activeIncidentId === incident.id ? " history-card--active" : ""}`}
                onClick={() => onSelectIncident(incident.id)}
              >
                <div className="history-card__content">
                  <h3 className="history-card__title">{incident.title}</h3>
                  <p className="history-card__meta">
                    <span>{incident.serviceName}</span>
                    <span className="history-card__dot" aria-hidden="true">
                      ·
                    </span>
                    <span>{incident.environment}</span>
                    <span className="history-card__dot" aria-hidden="true">
                      ·
                    </span>
                    <time dateTime={incident.createdAt}>{formatIncidentDate(incident.createdAt)}</time>
                  </p>
                </div>
                <div className="history-card__status">
                  {incident.latestSeverity ? (
                    <SeverityBadge severity={incident.latestSeverity} />
                  ) : (
                    <span className="history-card__severity history-card__severity--unknown">No report</span>
                  )}
                  {incident.reportCount > 1 ? (
                    <span className="history-card__versions">{incident.reportCount} versions</span>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
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
