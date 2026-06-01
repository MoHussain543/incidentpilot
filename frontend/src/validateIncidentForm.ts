import type { AnalyzeIncidentRequest } from "./types";
import { INCIDENT_LIMITS } from "./incidentLimits";

export function validateIncidentForm(values: AnalyzeIncidentRequest): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.title.trim()) {
    errors.title = "Incident title is required.";
  } else if (values.title.length > INCIDENT_LIMITS.title) {
    errors.title = `Incident title must be ${INCIDENT_LIMITS.title} characters or fewer.`;
  }

  if (!values.serviceName.trim()) {
    errors.serviceName = "Service name is required.";
  } else if (values.serviceName.length > INCIDENT_LIMITS.serviceName) {
    errors.serviceName = `Service name must be ${INCIDENT_LIMITS.serviceName} characters or fewer.`;
  }

  if (!values.environment.trim()) {
    errors.environment = "Environment is required.";
  } else if (values.environment.length > INCIDENT_LIMITS.environment) {
    errors.environment = `Environment must be ${INCIDENT_LIMITS.environment} characters or fewer.`;
  }

  if (!values.alertMessage.trim()) {
    errors.alertMessage = "Alert message is required.";
  } else if (values.alertMessage.length > INCIDENT_LIMITS.alertMessage) {
    errors.alertMessage = `Alert message must be ${INCIDENT_LIMITS.alertMessage} characters or fewer.`;
  }

  if (!values.logsOrStackTrace.trim()) {
    errors.logsOrStackTrace = "Logs or a stack trace are required.";
  } else if (values.logsOrStackTrace.length > INCIDENT_LIMITS.logsOrStackTrace) {
    errors.logsOrStackTrace = `Logs or stack trace must be ${INCIDENT_LIMITS.logsOrStackTrace.toLocaleString()} characters or fewer.`;
  }

  if (values.recentDeployNotes.length > INCIDENT_LIMITS.recentDeployNotes) {
    errors.recentDeployNotes = `Recent deploy notes must be ${INCIDENT_LIMITS.recentDeployNotes.toLocaleString()} characters or fewer.`;
  }

  return errors;
}

export function incidentsMatch(
  left: AnalyzeIncidentRequest | null,
  right: AnalyzeIncidentRequest
): boolean {
  if (!left) {
    return false;
  }

  return (
    left.title === right.title &&
    left.serviceName === right.serviceName &&
    left.environment === right.environment &&
    left.alertMessage === right.alertMessage &&
    left.logsOrStackTrace === right.logsOrStackTrace &&
    left.recentDeployNotes === right.recentDeployNotes
  );
}
