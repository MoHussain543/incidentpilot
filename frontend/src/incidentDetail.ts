import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveScopedUserId } from "./incidentAccess";
import { IncidentHistoryError } from "./incidentHistory";
import type {
  AnalyzeIncidentRequest,
  FollowUpAnswer,
  IncidentSeverity,
  IncidentTriageReport
} from "./types";

export type SavedReportVersion = {
  version: number;
  createdAt: string;
  report: IncidentTriageReport;
  followUpAnswers: FollowUpAnswer[] | null;
};

export type SavedIncidentDetail = {
  id: string;
  createdAt: string;
  updatedAt: string;
  context: AnalyzeIncidentRequest;
  reports: SavedReportVersion[];
  latestVersion: number;
};

type IncidentReportDetailRow = {
  version: number;
  summary: string;
  severity: IncidentSeverity;
  suspected_component: string;
  probable_causes: string[];
  next_steps: string[];
  confidence: number;
  clarifying_questions: string[];
  follow_up_answers: FollowUpAnswer[] | null;
  created_at: string;
};

type IncidentDetailRow = {
  id: string;
  title: string;
  service_name: string;
  environment: string;
  alert_message: string;
  logs_or_stack_trace: string;
  recent_deploy_notes: string | null;
  created_at: string;
  updated_at: string;
  incident_reports: IncidentReportDetailRow[] | null;
};

export async function fetchSavedIncidentDetail(
  client: SupabaseClient,
  userId: string,
  incidentId: string
): Promise<SavedIncidentDetail> {
  const scopedUserId = await resolveScopedUserId(client, userId);

  const { data, error } = await client
    .from("incidents")
    .select(
      `
        id,
        title,
        service_name,
        environment,
        alert_message,
        logs_or_stack_trace,
        recent_deploy_notes,
        created_at,
        updated_at,
        incident_reports (
          version,
          summary,
          severity,
          suspected_component,
          probable_causes,
          next_steps,
          confidence,
          clarifying_questions,
          follow_up_answers,
          created_at
        )
      `
    )
    .eq("id", incidentId)
    .eq("user_id", scopedUserId)
    .maybeSingle();

  if (error) {
    throw new IncidentHistoryError(error.message);
  }

  if (!data) {
    throw new IncidentHistoryError("Incident not found for the signed-in user.");
  }

  return mapIncidentDetail(data as IncidentDetailRow);
}

function mapIncidentDetail(row: IncidentDetailRow): SavedIncidentDetail {
  const reports = (row.incident_reports ?? [])
    .map(mapReportVersion)
    .sort((left, right) => right.version - left.version);

  const latestVersion = reports[0]?.version ?? 0;

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    context: {
      title: row.title,
      serviceName: row.service_name,
      environment: row.environment,
      alertMessage: row.alert_message,
      logsOrStackTrace: row.logs_or_stack_trace,
      recentDeployNotes: row.recent_deploy_notes ?? ""
    },
    reports,
    latestVersion
  };
}

function mapReportVersion(row: IncidentReportDetailRow): SavedReportVersion {
  return {
    version: row.version,
    createdAt: row.created_at,
    followUpAnswers: row.follow_up_answers,
    report: {
      summary: row.summary,
      severity: row.severity,
      suspectedComponent: row.suspected_component,
      probableCauses: row.probable_causes ?? [],
      nextSteps: row.next_steps ?? [],
      confidence: row.confidence,
      clarifyingQuestions: row.clarifying_questions ?? []
    }
  };
}
