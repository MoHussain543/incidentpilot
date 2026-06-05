import AssistantBot from "./AssistantBot";

type AnalyzingOverlayProps = {
  phase: "analyzing" | "refining";
  incidentTitle?: string;
};

export default function AnalyzingOverlay({ phase, incidentTitle }: AnalyzingOverlayProps) {
  const isRefining = phase === "refining";

  return (
    <div className="analyzing-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="analyzing-overlay__backdrop" aria-hidden="true" />
      <div className="analyzing-overlay__card">
        <AssistantBot state="analyzing" />
        <p className="analyzing-overlay__eyebrow">{isRefining ? "Refining report" : "Analyzing incident"}</p>
        <h2 className="analyzing-overlay__title">
          {isRefining ? "Updating the diagnosis with your evidence" : "Reviewing the incident signal"}
        </h2>
        {incidentTitle ? <p className="analyzing-overlay__context">{incidentTitle}</p> : null}
        <div className="analyzing-overlay__progress" aria-hidden="true">
          <div className="analyzing-overlay__progress-bar" />
        </div>
        <p className="analyzing-overlay__note">
          {isRefining
            ? "Merging your follow-up answers into a new report version."
            : "Building severity, suspected component, probable causes, and next steps."}
        </p>
      </div>
    </div>
  );
}
