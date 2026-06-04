import type { AnalyzeIncidentRequest } from "../types";
import { formatIncidentDate } from "../incidentHistory";

type IncidentContextPanelProps = {
  context: AnalyzeIncidentRequest;
  createdAt: string;
  updatedAt: string;
};

export default function IncidentContextPanel({ context, createdAt, updatedAt }: IncidentContextPanelProps) {
  return (
    <section className="panel panel--context">
      <div className="panel__header panel__header--stacked">
        <div>
          <p className="panel__eyebrow">Original signal</p>
          <h2>Incident context</h2>
          <p className="panel__helper">
            Saved at {formatIncidentDate(createdAt)}
            {updatedAt !== createdAt ? ` · Updated ${formatIncidentDate(updatedAt)}` : ""}
          </p>
        </div>
      </div>

      <dl className="context-list">
        <ContextItem label="Incident title" value={context.title} />
        <ContextItem label="Service name" value={context.serviceName} />
        <ContextItem label="Environment" value={context.environment} />
        <ContextItem label="Alert message" value={context.alertMessage} />
        <ContextItem label="Logs or stack trace" value={context.logsOrStackTrace} multiline />
        <ContextItem
          label="Recent deploy notes"
          value={context.recentDeployNotes.trim() || "Not provided"}
          multiline
        />
      </dl>
    </section>
  );
}

function ContextItem({
  label,
  value,
  multiline = false
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className={`context-list__item${multiline ? " context-list__item--multiline" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
