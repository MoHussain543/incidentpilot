import type { AnalyzeIncidentRequest } from "../types";
import { formatIncidentDate } from "../incidentHistory";

type IncidentContextPanelProps = {
  context: AnalyzeIncidentRequest;
  createdAt: string;
  updatedAt: string;
};

export default function IncidentContextPanel({ context, createdAt, updatedAt }: IncidentContextPanelProps) {
  return (
    <section className="panel investigation-context" aria-labelledby="investigation-context-heading">
      <div className="investigation-context__header">
        <p className="panel__eyebrow">Original signal</p>
        <h2 id="investigation-context-heading">Incident context</h2>
        <p className="panel__helper">
          The intake captured when this investigation was first saved.
        </p>
        <p className="investigation-context__timestamps">
          Saved <time dateTime={createdAt}>{formatIncidentDate(createdAt)}</time>
          {updatedAt !== createdAt ? (
            <>
              {" "}
              · Updated <time dateTime={updatedAt}>{formatIncidentDate(updatedAt)}</time>
            </>
          ) : null}
        </p>
      </div>

      <div className="investigation-context__section">
        <h3 className="investigation-context__section-title">Identity</h3>
        <dl className="context-list">
          <ContextItem label="Incident title" value={context.title} />
          <ContextItem label="Service name" value={context.serviceName} />
          <ContextItem label="Environment" value={context.environment} />
        </dl>
      </div>

      <div className="investigation-context__section">
        <h3 className="investigation-context__section-title">Alert</h3>
        <dl className="context-list">
          <ContextItem label="Alert message" value={context.alertMessage} />
        </dl>
      </div>

      <div className="investigation-context__section">
        <h3 className="investigation-context__section-title">Evidence</h3>
        <dl className="context-list">
          <ContextItem label="Logs or stack trace" value={context.logsOrStackTrace} multiline />
        </dl>
      </div>

      <div className="investigation-context__section">
        <h3 className="investigation-context__section-title">Deploy context</h3>
        <dl className="context-list">
          <ContextItem
            label="Recent deploy notes"
            value={context.recentDeployNotes.trim() || "Not provided"}
            multiline
          />
        </dl>
      </div>
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
