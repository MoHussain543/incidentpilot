import { describe, expect, it, vi } from "vitest";
import { fetchSavedIncidents, formatIncidentDate } from "./incidentHistory";

function createAuthClient(mockFrom: ReturnType<typeof vi.fn>) {
  return {
    from: mockFrom,
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-123" } },
        error: null
      }))
    }
  };
}

describe("incidentHistory", () => {
  it("maps incidents with the latest report severity by version", async () => {
    const eq = vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(async () => ({
          data: [
            {
              id: "incident-1",
              title: "Checkout failures",
              service_name: "payments-api",
              environment: "production",
              created_at: "2026-06-01T12:00:00.000Z",
              incident_reports: [
                { severity: "MEDIUM", version: 1 },
                { severity: "HIGH", version: 2 }
              ]
            }
          ],
          error: null
        }))
      }))
    }));
    const select = vi.fn(() => ({ eq }));

    const client = createAuthClient(vi.fn(() => ({ select })));

    const incidents = await fetchSavedIncidents(client as never, "user-123");
    expect(eq).toHaveBeenCalledWith("user_id", "user-123");

    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      id: "incident-1",
      title: "Checkout failures",
      serviceName: "payments-api",
      environment: "production",
      latestSeverity: "HIGH",
      reportCount: 2
    });
  });

  it("formats incident timestamps for display", () => {
    const formatted = formatIncidentDate("2026-06-01T12:00:00.000Z");
    expect(formatted.length).toBeGreaterThan(0);
  });
});
