import { describe, expect, it, vi } from "vitest";
import { fetchSavedIncidents, formatIncidentDate } from "./incidentHistory";

describe("incidentHistory", () => {
  it("maps incidents with the latest report severity by version", async () => {
    const order = vi.fn(() => ({
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
    }));

    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ order }))
      }))
    };

    const incidents = await fetchSavedIncidents(client as never);

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
