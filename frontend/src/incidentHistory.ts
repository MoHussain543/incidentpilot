import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveScopedUserId } from "./incidentAccess";
import type { IncidentSeverity } from "./types";

export type SavedIncidentSummary = {
  id: string;
  title: string;
  serviceName: string;
  environment: string;
  createdAt: string;
  latestSeverity: IncidentSeverity | null;
  reportCount: number;
};

type IncidentReportRow = {
  severity: IncidentSeverity;
  version: number;
};

type IncidentHistoryRow = {
  id: string;
  title: string;
  service_name: string;
  environment: string;
  created_at: string;
  incident_reports: IncidentReportRow[] | null;
};

export class IncidentHistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IncidentHistoryError";
  }
}

export async function fetchSavedIncidents(
  client: SupabaseClient,
  userId: string
): Promise<SavedIncidentSummary[]> {
  const scopedUserId = await resolveScopedUserId(client, userId);

  const { data, error } = await client
    .from("incidents")
    .select(
      `
        id,
        title,
        service_name,
        environment,
        created_at,
        incident_reports (
          severity,
          version
        )
      `
    )
    .eq("user_id", scopedUserId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new IncidentHistoryError(error.message);
  }

  return (data as IncidentHistoryRow[] | null ?? []).map(mapIncidentSummary);
}

function mapIncidentSummary(row: IncidentHistoryRow): SavedIncidentSummary {
  const reports = row.incident_reports ?? [];
  const latestReport = reports.reduce<IncidentReportRow | null>((latest, current) => {
    if (!latest || current.version > latest.version) {
      return current;
    }
    return latest;
  }, null);

  return {
    id: row.id,
    title: row.title,
    serviceName: row.service_name,
    environment: row.environment,
    createdAt: row.created_at,
    latestSeverity: latestReport?.severity ?? null,
    reportCount: reports.length
  };
}

export function formatIncidentDate(isoTimestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(isoTimestamp));
}
