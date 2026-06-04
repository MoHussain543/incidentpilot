import { describe, expect, it, vi } from "vitest";
import { fetchSavedIncidentDetail } from "./incidentDetail";

describe("fetchSavedIncidentDetail", () => {
  it("loads incident context and report versions for the signed-in user", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: "incident-123",
        title: "Checkout failures",
        service_name: "payments-api",
        environment: "production",
        alert_message: "HTTP 500 spike",
        logs_or_stack_trace: "UnknownHostException",
        recent_deploy_notes: "Build 204",
        created_at: "2026-06-01T12:00:00.000Z",
        updated_at: "2026-06-01T13:00:00.000Z",
        incident_reports: [
          {
            version: 1,
            summary: "Initial summary",
            severity: "MEDIUM",
            suspected_component: "payments-api",
            probable_causes: ["Bad host"],
            next_steps: ["Check DNS"],
            confidence: 0.6,
            clarifying_questions: ["Was there a deploy?"],
            follow_up_answers: null,
            created_at: "2026-06-01T12:05:00.000Z"
          },
          {
            version: 2,
            summary: "Refined summary",
            severity: "HIGH",
            suspected_component: "payments-api",
            probable_causes: ["Confirmed bad host"],
            next_steps: ["Rollback config"],
            confidence: 0.82,
            clarifying_questions: [],
            follow_up_answers: [{ question: "Was there a deploy?", answer: "Yes" }],
            created_at: "2026-06-01T13:00:00.000Z"
          }
        ]
      },
      error: null
    }));

    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle
          }))
        }))
      }))
    };

    const detail = await fetchSavedIncidentDetail(client as never, "incident-123");

    expect(detail.latestVersion).toBe(2);
    expect(detail.reports).toHaveLength(2);
    expect(detail.reports[0].version).toBe(2);
    expect(detail.context.title).toBe("Checkout failures");
    expect(detail.reports[1].followUpAnswers).toBeNull();
  });
});
