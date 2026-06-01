export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AnalyzeIncidentRequest = {
  title: string;
  serviceName: string;
  environment: string;
  alertMessage: string;
  logsOrStackTrace: string;
  recentDeployNotes: string;
};

export type IncidentTriageReport = {
  summary: string;
  severity: IncidentSeverity;
  suspectedComponent: string;
  probableCauses: string[];
  nextSteps: string[];
  confidence: number;
  clarifyingQuestions: string[];
};

export type FollowUpAnswer = {
  question: string;
  answer: string;
};

export type RefineIncidentRequest = {
  originalIncident: AnalyzeIncidentRequest;
  previousReport: IncidentTriageReport;
  followUpAnswers: FollowUpAnswer[];
};

export type ApiErrorResponse = {
  message: string;
  fieldErrors?: Record<string, string>;
};
