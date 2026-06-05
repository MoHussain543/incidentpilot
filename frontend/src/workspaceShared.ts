import { IncidentAccessError } from "./incidentAccess";
import { IncidentHistoryError } from "./incidentHistory";
import { IncidentPersistenceError } from "./incidentPersistence";
import type { SavedIncidentDetail } from "./incidentDetail";
import type { AnalyzeIncidentRequest, IncidentSeverity, IncidentTriageReport } from "./types";

export type RequestPhase = "idle" | "analyzing" | "refining" | "success" | "error";

export const initialFormValues: AnalyzeIncidentRequest = {
  title: "",
  serviceName: "",
  environment: "production",
  alertMessage: "",
  logsOrStackTrace: "",
  recentDeployNotes: ""
};

export const ENVIRONMENT_SUGGESTIONS = ["production", "staging", "development"];

export function resolveAssistantState(
  requestPhase: RequestPhase,
  severity: IncidentSeverity | undefined,
  apiError: string | null
): "idle" | "analyzing" | "ready" | "elevated" | "error" {
  if (requestPhase === "analyzing" || requestPhase === "refining") {
    return "analyzing";
  }
  if (apiError) {
    return "error";
  }
  if (severity === "HIGH" || severity === "CRITICAL") {
    return "elevated";
  }
  if (severity) {
    return "ready";
  }
  return "idle";
}

export function statusLabel(
  requestPhase: RequestPhase,
  severity: IncidentSeverity | undefined,
  apiError: string | null
) {
  if (requestPhase === "analyzing") {
    return "Analyzing";
  }
  if (requestPhase === "refining") {
    return "Refining";
  }
  if (apiError) {
    return "Needs attention";
  }
  if (severity === "HIGH" || severity === "CRITICAL") {
    return "Elevated";
  }
  if (severity) {
    return "Report ready";
  }
  return "Standing by";
}

export function resolveHistoryError(error: unknown) {
  if (error instanceof IncidentAccessError) {
    return error.message;
  }
  if (error instanceof IncidentHistoryError) {
    return error.message;
  }
  return "Saved incident history could not be loaded.";
}

export function resolvePersistenceWarning(error: unknown) {
  if (error instanceof IncidentPersistenceError) {
    return `${error.message} The analysis is still visible here, but it was not saved to your account history.`;
  }
  return "The analysis completed, but it could not be saved to your account history.";
}

export function buildEphemeralIncidentDetail(
  context: AnalyzeIncidentRequest,
  report: IncidentTriageReport,
  incidentId = "ephemeral"
): SavedIncidentDetail {
  const now = new Date().toISOString();

  return {
    id: incidentId,
    createdAt: now,
    updatedAt: now,
    context,
    latestVersion: 1,
    reports: [
      {
        version: 1,
        createdAt: now,
        followUpAnswers: null,
        report
      }
    ]
  };
}

export function createEmptyAnswers(questions: string[]) {
  return questions.reduce<Record<string, string>>((accumulator, question, index) => {
    accumulator[`${index}:${question}`] = "";
    return accumulator;
  }, {});
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createMarkdownReport(incident: AnalyzeIncidentRequest, report: IncidentTriageReport) {
  const followUpSection =
    report.clarifyingQuestions.length === 0
      ? "None."
      : report.clarifyingQuestions.map((question) => `- ${question}`).join("\n");

  return `# IncidentPilot Report

## Incident
- Title: ${incident.title}
- Service: ${incident.serviceName}
- Environment: ${incident.environment}
- Alert: ${incident.alertMessage}

## Logs / Stack Trace
\`\`\`
${incident.logsOrStackTrace}
\`\`\`

## Recent Deploy Notes
${incident.recentDeployNotes.trim() || "Not provided."}

## Summary
${report.summary}

## Severity
${report.severity}

## Suspected Component
${report.suspectedComponent}

## Probable Causes
${report.probableCauses.map((cause) => `- ${cause}`).join("\n")}

## Next Steps
${report.nextSteps.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## Confidence
${Math.round(report.confidence * 100)}%

## Clarifying Questions
${followUpSection}
`;
}
