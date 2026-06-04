import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveScopedUserId } from "./incidentAccess";
import type {
  AnalyzeIncidentRequest,
  FollowUpAnswer,
  IncidentTriageReport
} from "./types";

export type PersistAnalyzeResult = {
  incidentId: string;
  reportVersion: number;
};

export type PersistRefineResult = {
  incidentId: string;
  reportVersion: number;
};

export class IncidentPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IncidentPersistenceError";
  }
}

export async function ensureProfile(
  client: SupabaseClient,
  userId: string,
  email: string | null | undefined
): Promise<void> {
  const scopedUserId = await resolveScopedUserId(client, userId);

  const { error } = await client.from("profiles").upsert(
    {
      id: scopedUserId,
      email: email ?? null
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new IncidentPersistenceError(`Could not sync profile: ${error.message}`);
  }
}

export async function persistAnalyzeResult(
  client: SupabaseClient,
  userId: string,
  email: string | null | undefined,
  incident: AnalyzeIncidentRequest,
  report: IncidentTriageReport
): Promise<PersistAnalyzeResult> {
  const scopedUserId = await resolveScopedUserId(client, userId);
  await ensureProfile(client, scopedUserId, email);

  const { data: incidentRow, error: incidentError } = await client
    .from("incidents")
    .insert(mapIncidentInsert(scopedUserId, incident))
    .select("id")
    .single();

  if (incidentError || !incidentRow) {
    throw new IncidentPersistenceError(
      incidentError?.message ?? "Incident could not be saved."
    );
  }

  const { error: reportError } = await client.from("incident_reports").insert(
    mapReportInsert(scopedUserId, incidentRow.id, 1, report, null)
  );

  if (reportError) {
    await cleanupIncident(client, scopedUserId, incidentRow.id);
    throw new IncidentPersistenceError(reportError.message);
  }

  return {
    incidentId: incidentRow.id,
    reportVersion: 1
  };
}

export async function persistRefineResult(
  client: SupabaseClient,
  userId: string,
  incidentId: string,
  report: IncidentTriageReport,
  followUpAnswers: FollowUpAnswer[]
): Promise<PersistRefineResult> {
  const scopedUserId = await resolveScopedUserId(client, userId);
  await assertIncidentOwnership(client, scopedUserId, incidentId);

  const nextVersion = await resolveNextReportVersion(client, scopedUserId, incidentId);
  const { error: reportError } = await client.from("incident_reports").insert(
    mapReportInsert(scopedUserId, incidentId, nextVersion, report, followUpAnswers)
  );

  if (reportError) {
    throw new IncidentPersistenceError(reportError.message);
  }

  const { error: incidentError } = await client
    .from("incidents")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", incidentId)
    .eq("user_id", scopedUserId);

  if (incidentError) {
    throw new IncidentPersistenceError(incidentError.message);
  }

  return {
    incidentId,
    reportVersion: nextVersion
  };
}

async function assertIncidentOwnership(
  client: SupabaseClient,
  userId: string,
  incidentId: string
): Promise<void> {
  const { data, error } = await client
    .from("incidents")
    .select("id")
    .eq("id", incidentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new IncidentPersistenceError(error.message);
  }

  if (!data) {
    throw new IncidentPersistenceError("Incident not found for the signed-in user.");
  }
}

async function resolveNextReportVersion(
  client: SupabaseClient,
  userId: string,
  incidentId: string
): Promise<number> {
  const { data, error } = await client
    .from("incident_reports")
    .select("version")
    .eq("incident_id", incidentId)
    .eq("user_id", userId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new IncidentPersistenceError(error.message);
  }

  return (data?.version ?? 0) + 1;
}

async function cleanupIncident(
  client: SupabaseClient,
  userId: string,
  incidentId: string
): Promise<void> {
  const { error } = await client
    .from("incidents")
    .delete()
    .eq("id", incidentId)
    .eq("user_id", userId);

  if (error) {
    throw new IncidentPersistenceError(
      `Report save failed, and the new incident row could not be rolled back: ${error.message}`
    );
  }
}

function mapIncidentInsert(userId: string, incident: AnalyzeIncidentRequest) {
  return {
    user_id: userId,
    title: incident.title.trim(),
    service_name: incident.serviceName.trim(),
    environment: incident.environment.trim(),
    alert_message: incident.alertMessage.trim(),
    logs_or_stack_trace: incident.logsOrStackTrace.trim(),
    recent_deploy_notes: incident.recentDeployNotes.trim() || null
  };
}

function mapReportInsert(
  userId: string,
  incidentId: string,
  version: number,
  report: IncidentTriageReport,
  followUpAnswers: FollowUpAnswer[] | null
) {
  return {
    incident_id: incidentId,
    user_id: userId,
    version,
    summary: report.summary,
    severity: report.severity,
    suspected_component: report.suspectedComponent,
    probable_causes: report.probableCauses,
    next_steps: report.nextSteps,
    confidence: report.confidence,
    clarifying_questions: report.clarifyingQuestions,
    follow_up_answers: followUpAnswers && followUpAnswers.length > 0 ? followUpAnswers : null
  };
}
