import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  IncidentPersistenceError,
  persistAnalyzeResult,
  persistRefineResult
} from "./incidentPersistence";
import type { AnalyzeIncidentRequest, IncidentTriageReport } from "./types";

const incident: AnalyzeIncidentRequest = {
  title: "Checkout failures",
  serviceName: "payments",
  environment: "production",
  alertMessage: "HTTP 500 spike",
  logsOrStackTrace: "java.net.UnknownHostException: db.internal",
  recentDeployNotes: "Deployed build 204"
};

const report: IncidentTriageReport = {
  summary: "Payments cannot resolve the database host.",
  severity: "HIGH",
  suspectedComponent: "payment-adapter",
  probableCauses: ["Bad database host in config"],
  nextSteps: ["Compare deployed DB host with last known good value"],
  confidence: 0.84,
  clarifyingQuestions: ["Did this begin after the deployment?"]
};

function createMockClient() {
  const profilesUpsert = vi.fn(async () => ({ error: null }));
  const incidentsInsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({
        data: { id: "incident-123" },
        error: null
      }))
    }))
  }));
  const incidentsSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: { id: "incident-123" }, error: null }))
      }))
    }))
  }));
  const incidentsUpdate = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null }))
    }))
  }));
  const incidentsDelete = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null }))
    }))
  }));
  const reportsInsert = vi.fn(async () => ({ error: null as { message: string } | null }));
  const reportsSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: { version: 1 }, error: null }))
        }))
      }))
    }))
  }));

  const mockFrom = vi.fn() as ReturnType<typeof vi.fn>;
  mockFrom.mockImplementation((table: string) => {
    if (table === "profiles") {
      return { upsert: profilesUpsert };
    }
    if (table === "incidents") {
      return {
        insert: incidentsInsert,
        select: incidentsSelect,
        update: incidentsUpdate,
        delete: incidentsDelete
      };
    }
    if (table === "incident_reports") {
      return {
        insert: reportsInsert,
        select: reportsSelect
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  const client = {
    from: mockFrom
  };

  return {
    client: client as unknown as SupabaseClient,
    mockFrom,
    profilesUpsert,
    incidentsInsert,
    incidentsDelete,
    reportsInsert
  };
}

describe("incidentPersistence", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("persists a new incident and version 1 report on analyze", async () => {
    const { client, profilesUpsert, incidentsInsert, reportsInsert } = createMockClient();

    const result = await persistAnalyzeResult(
      client,
      "user-123",
      "tester@example.com",
      incident,
      report
    );

    expect(result).toEqual({ incidentId: "incident-123", reportVersion: 1 });
    expect(profilesUpsert).toHaveBeenCalledOnce();
    expect(incidentsInsert).toHaveBeenCalledOnce();
    expect(reportsInsert).toHaveBeenCalledOnce();
  });

  it("rolls back the incident row when report version 1 fails to save", async () => {
    const { client, incidentsDelete, reportsInsert } = createMockClient();
    reportsInsert.mockResolvedValueOnce({ error: { message: "report insert failed" } });

    await expect(
      persistAnalyzeResult(client, "user-123", "tester@example.com", incident, report)
    ).rejects.toBeInstanceOf(IncidentPersistenceError);

    expect(incidentsDelete).toHaveBeenCalledOnce();
  });

  it("persists a new report version on refine", async () => {
    const { client, reportsInsert } = createMockClient();

    const result = await persistRefineResult(client, "user-123", "incident-123", report, [
      { question: "Did this begin after the deployment?", answer: "Yes" }
    ]);

    expect(result).toEqual({ incidentId: "incident-123", reportVersion: 2 });
    expect(reportsInsert).toHaveBeenCalledOnce();
  });

  it("throws when incident insert fails", async () => {
    const { client, mockFrom } = createMockClient();
    const incidentsInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: null, error: { message: "insert failed" } }))
      }))
    }));
    (mockFrom as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "profiles") {
        return { upsert: vi.fn(async () => ({ error: null })) };
      }
      if (table === "incidents") {
        return { insert: incidentsInsert } as never;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      persistAnalyzeResult(client, "user-123", "tester@example.com", incident, report)
    ).rejects.toBeInstanceOf(IncidentPersistenceError);
  });
});
