import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";

const {
  mockGetSession,
  mockSignIn,
  mockSignOut,
  mockSignUp,
  mockPersistAnalyze,
  mockPersistRefine,
  mockFetchSavedIncidents
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(async () => ({
    data: {
      session: {
        user: {
          id: "user-123",
          email: "tester@example.com"
        }
      }
    }
  })),
  mockSignIn: vi.fn(),
  mockSignOut: vi.fn(),
  mockSignUp: vi.fn(),
  mockPersistAnalyze: vi.fn(async () => ({ incidentId: "incident-123", reportVersion: 1 })),
  mockPersistRefine: vi.fn(async () => ({ incidentId: "incident-123", reportVersion: 2 })),
  mockFetchSavedIncidents: vi.fn(async () => [
    {
      id: "incident-123",
      title: "Checkout failures",
      serviceName: "payments",
      environment: "production",
      createdAt: "2026-06-01T12:00:00.000Z",
      latestSeverity: "HIGH",
      reportCount: 1
    }
  ])
}));

vi.mock("./incidentHistory", () => ({
  IncidentHistoryError: class IncidentHistoryError extends Error {
    name = "IncidentHistoryError";
  },
  fetchSavedIncidents: mockFetchSavedIncidents,
  formatIncidentDate: () => "Jun 1, 2026, 8:00 AM"
}));

vi.mock("./incidentPersistence", () => ({
  IncidentPersistenceError: class IncidentPersistenceError extends Error {
    name = "IncidentPersistenceError";
  },
  persistAnalyzeResult: mockPersistAnalyze,
  persistRefineResult: mockPersistRefine
}));

vi.mock("./supabase", () => ({
  hasSupabaseConfig: true,
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: vi.fn()
          }
        }
      }),
      signOut: mockSignOut,
      signInWithPassword: mockSignIn,
      signUp: mockSignUp
    }
  }
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mockGetSession.mockClear();
  mockSignIn.mockClear();
  mockSignOut.mockClear();
  mockSignUp.mockClear();
  mockPersistAnalyze.mockClear();
  mockPersistRefine.mockClear();
  mockFetchSavedIncidents.mockClear();
});

describe("App", () => {
  it("submits the incident form and renders the triage report", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          summary: "Checkout failures point to a payment adapter database host issue.",
          severity: "HIGH",
          suspectedComponent: "payment-adapter",
          probableCauses: ["A bad database host was deployed"],
          nextSteps: ["Compare the current database host to the last good release"],
          confidence: 0.82,
          clarifyingQuestions: ["Did this begin immediately after the latest deployment?"]
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    render(<App />);

    await waitFor(() => expect(screen.getByText("Saved incident history")).toBeInTheDocument());

    fireEvent.change(await screen.findByLabelText("Incident title"), { target: { value: "Checkout failures" } });
    fireEvent.change(screen.getByLabelText("Service name"), { target: { value: "payments" } });
    fireEvent.change(screen.getByLabelText("Alert message"), { target: { value: "HTTP 500 spike" } });
    fireEvent.change(screen.getByLabelText("Logs or stack trace"), {
      target: { value: "java.net.UnknownHostException: db.internal" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Analyze incident" }));

    await waitFor(() =>
      expect(screen.getByText("Checkout failures point to a payment adapter database host issue.")).toBeInTheDocument()
    );

    expect(screen.getAllByText("HIGH").length).toBeGreaterThan(0);
    expect(screen.getByText("Did this begin immediately after the latest deployment?")).toBeInTheDocument();
    expect(screen.getByText(/20,000 characters/)).toBeInTheDocument();
  });

  it("loads saved incident history for the signed-in user", async () => {
    render(<App />);

    expect(await screen.findByText("Saved incident history")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Checkout failures", level: 3 })).toBeInTheDocument()
    );
    expect(mockFetchSavedIncidents).toHaveBeenCalled();
  });

  it("shows client-side validation before calling the API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Analyze incident" }));

    expect(await screen.findByText("Incident title is required.")).toBeInTheDocument();
    expect(screen.getByText("Fix the highlighted fields before analyzing this incident.")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("renders a backend error message when analysis fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "OpenAI request failed.", fieldErrors: {} }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      })
    );

    render(<App />);

    await waitFor(() => expect(screen.getByText("Saved incident history")).toBeInTheDocument());

    fireEvent.change(await screen.findByLabelText("Incident title"), { target: { value: "Checkout failures" } });
    fireEvent.change(screen.getByLabelText("Service name"), { target: { value: "payments" } });
    fireEvent.change(screen.getByLabelText("Alert message"), { target: { value: "HTTP 500 spike" } });
    fireEvent.change(screen.getByLabelText("Logs or stack trace"), {
      target: { value: "java.net.UnknownHostException: db.internal" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Analyze incident" }));

    await waitFor(() => expect(screen.getByText("OpenAI request failed.")).toBeInTheDocument());
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
  });

  it("renders a follow-up empty state when none are returned", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          summary: "A stale cache node is returning 503s to a subset of traffic.",
          severity: "MEDIUM",
          suspectedComponent: "edge-cache",
          probableCauses: ["One cache node failed to refresh upstream connections"],
          nextSteps: ["Drain the affected node and compare it with healthy peers"],
          confidence: 0.74,
          clarifyingQuestions: []
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    render(<App />);

    fireEvent.change(await screen.findByLabelText("Incident title"), { target: { value: "Subset 503s" } });
    fireEvent.change(screen.getByLabelText("Service name"), { target: { value: "edge" } });
    fireEvent.change(screen.getByLabelText("Alert message"), { target: { value: "5xx increase" } });
    fireEvent.change(screen.getByLabelText("Logs or stack trace"), { target: { value: "cache node 7 timeout" } });

    fireEvent.click(screen.getByRole("button", { name: "Analyze incident" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "The model had enough context to produce a first-pass report without follow-up questions. Update the incident form and analyze again if new evidence arrives."
        )
      ).toBeInTheDocument()
    );
  });

  it("warns when the form no longer matches the analyzed incident", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          summary: "Checkout failures point to a payment adapter database host issue.",
          severity: "MEDIUM",
          suspectedComponent: "payment-adapter",
          probableCauses: ["A bad database host was deployed"],
          nextSteps: ["Compare the current database host to the last good release"],
          confidence: 0.82,
          clarifyingQuestions: []
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    render(<App />);

    await waitFor(() => expect(screen.getByText("Saved incident history")).toBeInTheDocument());

    fireEvent.change(await screen.findByLabelText("Incident title"), { target: { value: "Checkout failures" } });
    fireEvent.change(screen.getByLabelText("Service name"), { target: { value: "payments" } });
    fireEvent.change(screen.getByLabelText("Alert message"), { target: { value: "HTTP 500 spike" } });
    fireEvent.change(screen.getByLabelText("Logs or stack trace"), {
      target: { value: "java.net.UnknownHostException: db.internal" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze incident" }));

    await waitFor(() => expect(screen.getByText("Report ready")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Incident title"), { target: { value: "Updated checkout failures" } });

    expect(screen.getByText("Report is out of date")).toBeInTheDocument();
  });

  it("allows refining with only one answered follow-up question", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            summary: "Initial summary",
            severity: "MEDIUM",
            suspectedComponent: "payments",
            probableCauses: ["Config drift"],
            nextSteps: ["Check config"],
            confidence: 0.6,
            clarifyingQuestions: ["Was there a deploy?", "Did traffic spike?"]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            summary: "Refined summary",
            severity: "HIGH",
            suspectedComponent: "payments",
            probableCauses: ["Bad deploy"],
            nextSteps: ["Rollback"],
            confidence: 0.8,
            clarifyingQuestions: []
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    render(<App />);

    await waitFor(() => expect(screen.getByText("Saved incident history")).toBeInTheDocument());

    fireEvent.change(await screen.findByLabelText("Incident title"), { target: { value: "Checkout failures" } });
    fireEvent.change(screen.getByLabelText("Service name"), { target: { value: "payments" } });
    fireEvent.change(screen.getByLabelText("Alert message"), { target: { value: "HTTP 500 spike" } });
    fireEvent.change(screen.getByLabelText("Logs or stack trace"), { target: { value: "error" } });
    fireEvent.click(screen.getByRole("button", { name: "Analyze incident" }));

    await waitFor(() => expect(screen.getByText("Initial summary")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Was there a deploy?"), {
      target: { value: "Yes, five minutes before the alert." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Refine analysis" }));

    await waitFor(() => expect(screen.getByText("Refined summary")).toBeInTheDocument());
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(mockPersistAnalyze).toHaveBeenCalledOnce();
    expect(mockPersistRefine).toHaveBeenCalledOnce();
  });

  it("shows a persistence warning when analyze succeeds but saving fails", async () => {
    mockPersistAnalyze.mockRejectedValueOnce(new Error("insert failed"));

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          summary: "Saved in UI only",
          severity: "LOW",
          suspectedComponent: "web-app",
          probableCauses: ["Unknown"],
          nextSteps: ["Gather metrics"],
          confidence: 0.4,
          clarifyingQuestions: []
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    render(<App />);

    fireEvent.change(await screen.findByLabelText("Incident title"), { target: { value: "Slow app" } });
    fireEvent.change(screen.getByLabelText("Service name"), { target: { value: "web-app" } });
    fireEvent.change(screen.getByLabelText("Alert message"), { target: { value: "Tickets up" } });
    fireEvent.change(screen.getByLabelText("Logs or stack trace"), { target: { value: "latency_ms=420" } });
    fireEvent.click(screen.getByRole("button", { name: "Analyze incident" }));

    await waitFor(() => expect(screen.getByText("Saved in UI only")).toBeInTheDocument());
    expect(screen.getByText("Workspace save issue")).toBeInTheDocument();
  });
});
