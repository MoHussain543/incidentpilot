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
  mockFetchSavedIncidents,
  mockFetchSavedIncidentDetail
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
  mockFetchSavedIncidents: vi.fn(async (_client: unknown, _userId: string) => [
    {
      id: "incident-123",
      title: "Checkout failures",
      serviceName: "payments",
      environment: "production",
      createdAt: "2026-06-01T12:00:00.000Z",
      latestSeverity: "HIGH",
      reportCount: 1
    }
  ]),
  mockFetchSavedIncidentDetail: vi.fn(async (_client: unknown, _userId: string, incidentId: string) => ({
    id: "incident-123",
    createdAt: "2026-06-01T12:00:00.000Z",
    updatedAt: "2026-06-01T12:00:00.000Z",
    latestVersion: 2,
    context: {
      title: "Checkout failures",
      serviceName: "payments",
      environment: "production",
      alertMessage: "HTTP 500 spike",
      logsOrStackTrace: "java.net.UnknownHostException: db.internal",
      recentDeployNotes: "Deployed build 204"
    },
    reports: [
      {
        version: 2,
        createdAt: "2026-06-01T13:00:00.000Z",
        followUpAnswers: [{ question: "Was there a deploy?", answer: "Yes" }],
        report: {
          summary: "Refined summary for checkout failures.",
          severity: "HIGH",
          suspectedComponent: "payment-adapter",
          probableCauses: ["Bad database host"],
          nextSteps: ["Rollback config"],
          confidence: 0.9,
          clarifyingQuestions: []
        }
      },
      {
        version: 1,
        createdAt: "2026-06-01T12:00:00.000Z",
        followUpAnswers: null,
        report: {
          summary: "Initial summary for checkout failures.",
          severity: "MEDIUM",
          suspectedComponent: "payment-adapter",
          probableCauses: ["Possible DNS issue"],
          nextSteps: ["Check DNS"],
          confidence: 0.7,
          clarifyingQuestions: ["Was there a deploy?"]
        }
      }
    ]
  }))
}));

vi.mock("./incidentHistory", () => ({
  IncidentHistoryError: class IncidentHistoryError extends Error {
    name = "IncidentHistoryError";
  },
  fetchSavedIncidents: mockFetchSavedIncidents,
  formatIncidentDate: () => "Jun 1, 2026, 8:00 AM"
}));

vi.mock("./incidentDetail", () => ({
  fetchSavedIncidentDetail: mockFetchSavedIncidentDetail
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
  mockFetchSavedIncidentDetail.mockClear();
});

async function openReportsView() {
  fireEvent.click(await screen.findByRole("button", { name: "Reports" }));
  await waitFor(() => expect(screen.getByText("Your saved reports")).toBeInTheDocument());
}

describe("App", () => {
  it("shows the public landing page when signed out", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } } as never);

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: /Turn noisy production alerts into actionable triage/i
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create workspace" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.queryByText("Your saved reports")).not.toBeInTheDocument();
  });

  it("opens the sign-in gate from the landing page", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } } as never);

    render(<App />);

    fireEvent.click((await screen.findAllByRole("button", { name: "Sign in" }))[0]!);

    expect(await screen.findByRole("heading", { name: "Sign in", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "← Back to home" })).toBeInTheDocument();
  });

  it("returns to the reports dashboard from incident detail", async () => {
    render(<App />);
    await openReportsView();

    const historyButton = screen
      .getAllByRole("button")
      .find((button) => button.textContent?.includes("Checkout failures"));
    fireEvent.click(historyButton!);

    await waitFor(() => expect(screen.getByText("Investigation workspace")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Back to all reports" }));
    expect(await screen.findByText("Your saved reports")).toBeInTheDocument();
  });

  it("shows the signed-in app shell with primary navigation", async () => {
    render(<App />);

    expect(await screen.findByRole("button", { name: "New Analysis" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reports" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open account menu for tester@example.com/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Incident intake", level: 1 })).toBeInTheDocument();
    expect(screen.queryByText("Your saved reports")).not.toBeInTheDocument();
  });

  it("opens the account menu with workspace links and logout", async () => {
    render(<App />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Open account menu for tester@example.com/i })
    );

    expect(screen.getByRole("menu", { name: "Account menu" })).toBeInTheDocument();
    expect(screen.getAllByText("tester@example.com").length).toBeGreaterThan(0);
    expect(screen.getByRole("menuitem", { name: "New Analysis" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Reports" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
  });

  it("navigates to reports from the account menu", async () => {
    render(<App />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Open account menu for tester@example.com/i })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Reports" }));

    expect(await screen.findByText("Your saved reports")).toBeInTheDocument();
  });

  it("logs out from the account menu", async () => {
    render(<App />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Open account menu for tester@example.com/i })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(mockSignOut).toHaveBeenCalled();
  });

  it("shows the reports dashboard with summary stats", async () => {
    render(<App />);

    await openReportsView();

    expect(screen.getByText("Total incidents")).toBeInTheDocument();
    expect(screen.getByText("Elevated severity")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Checkout failures", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("1 report version")).toBeInTheDocument();
  });

  it("submits the incident form and opens the investigation view", async () => {
    mockFetchSavedIncidentDetail.mockResolvedValueOnce({
      id: "incident-123",
      createdAt: "2026-06-01T12:00:00.000Z",
      updatedAt: "2026-06-01T12:00:00.000Z",
      latestVersion: 1,
      context: {
        title: "Checkout failures",
        serviceName: "payments",
        environment: "production",
        alertMessage: "HTTP 500 spike",
        logsOrStackTrace: "java.net.UnknownHostException: db.internal",
        recentDeployNotes: ""
      },
      reports: [
        {
          version: 1,
          createdAt: "2026-06-01T12:00:00.000Z",
          followUpAnswers: null,
          report: {
            summary: "Checkout failures point to a payment adapter database host issue.",
            severity: "HIGH",
            suspectedComponent: "payment-adapter",
            probableCauses: ["A bad database host was deployed"],
            nextSteps: ["Compare the current database host to the last good release"],
            confidence: 0.82,
            clarifyingQuestions: ["Did this begin immediately after the latest deployment?"]
          }
        }
      ]
    });

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

    await screen.findByRole("heading", { name: "Incident intake", level: 1 });

    fireEvent.change(await screen.findByLabelText("Incident title"), { target: { value: "Checkout failures" } });
    fireEvent.change(screen.getByLabelText("Service name"), { target: { value: "payments" } });
    fireEvent.change(screen.getByLabelText("Alert message"), { target: { value: "HTTP 500 spike" } });
    fireEvent.change(screen.getByLabelText("Logs or stack trace"), {
      target: { value: "java.net.UnknownHostException: db.internal" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Analyze incident" }));

    await waitFor(() => expect(screen.getByText("Investigation workspace")).toBeInTheDocument());
    expect(screen.getAllByText("Checkout failures point to a payment adapter database host issue.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("HIGH").length).toBeGreaterThan(0);
    expect(screen.getByText("Did this begin immediately after the latest deployment?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New incident" })).toBeInTheDocument();
    expect(mockFetchSavedIncidentDetail).toHaveBeenCalledWith(expect.anything(), "user-123", "incident-123");
  });

  it("opens a saved incident and shows report version history", async () => {
    render(<App />);

    await openReportsView();

    const historyButton = screen
      .getAllByRole("button")
      .find((button) => button.textContent?.includes("Checkout failures"));
    expect(historyButton).toBeDefined();
    fireEvent.click(historyButton!);

    await waitFor(() => expect(screen.getByText("Investigation workspace")).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getAllByText("Refined summary for checkout failures.").length).toBeGreaterThan(0)
    );
    expect(screen.getByText(/Version 2 · Latest/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View all versions" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View all versions" }));
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Version 1/i })).toBeInTheDocument();
    expect(mockFetchSavedIncidentDetail).toHaveBeenCalledWith(expect.anything(), "user-123", "incident-123");
  });

  it("loads saved incident history for the signed-in user", async () => {
    render(<App />);

    await openReportsView();
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

    await screen.findByRole("heading", { name: "Incident intake", level: 1 });

    fireEvent.change(await screen.findByLabelText("Incident title"), { target: { value: "Checkout failures" } });
    fireEvent.change(screen.getByLabelText("Service name"), { target: { value: "payments" } });
    fireEvent.change(screen.getByLabelText("Alert message"), { target: { value: "HTTP 500 spike" } });
    fireEvent.change(screen.getByLabelText("Logs or stack trace"), {
      target: { value: "java.net.UnknownHostException: db.internal" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Analyze incident" }));

    await waitFor(() => expect(screen.getByText("OpenAI request failed.")).toBeInTheDocument());
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.queryByText("Investigation workspace")).not.toBeInTheDocument();
  });

  it("renders a follow-up empty state when none are returned", async () => {
    mockFetchSavedIncidentDetail.mockResolvedValueOnce({
      id: "incident-123",
      createdAt: "2026-06-01T12:00:00.000Z",
      updatedAt: "2026-06-01T12:00:00.000Z",
      latestVersion: 1,
      context: {
        title: "Subset 503s",
        serviceName: "edge",
        environment: "production",
        alertMessage: "5xx increase",
        logsOrStackTrace: "cache node 7 timeout",
        recentDeployNotes: ""
      },
      reports: [
        {
          version: 1,
          createdAt: "2026-06-01T12:00:00.000Z",
          followUpAnswers: null,
          report: {
            summary: "A stale cache node is returning 503s to a subset of traffic.",
            severity: "MEDIUM",
            suspectedComponent: "edge-cache",
            probableCauses: ["One cache node failed to refresh upstream connections"],
            nextSteps: ["Drain the affected node and compare it with healthy peers"],
            confidence: 0.74,
            clarifyingQuestions: []
          }
        }
      ]
    });

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
        screen.getByText(/This version has no open clarifying questions/)
      ).toBeInTheDocument()
    );
  });

  it("returns to intake from the investigation view", async () => {
    mockFetchSavedIncidentDetail.mockResolvedValueOnce({
      id: "incident-123",
      createdAt: "2026-06-01T12:00:00.000Z",
      updatedAt: "2026-06-01T12:00:00.000Z",
      latestVersion: 1,
      context: {
        title: "Checkout failures",
        serviceName: "payments",
        environment: "production",
        alertMessage: "HTTP 500 spike",
        logsOrStackTrace: "error",
        recentDeployNotes: ""
      },
      reports: [
        {
          version: 1,
          createdAt: "2026-06-01T12:00:00.000Z",
          followUpAnswers: null,
          report: {
            summary: "Initial summary",
            severity: "MEDIUM",
            suspectedComponent: "payments",
            probableCauses: ["Config drift"],
            nextSteps: ["Check config"],
            confidence: 0.6,
            clarifyingQuestions: []
          }
        }
      ]
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          summary: "Initial summary",
          severity: "MEDIUM",
          suspectedComponent: "payments",
          probableCauses: ["Config drift"],
          nextSteps: ["Check config"],
          confidence: 0.6,
          clarifyingQuestions: []
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    render(<App />);

    fireEvent.change(await screen.findByLabelText("Incident title"), { target: { value: "Checkout failures" } });
    fireEvent.change(screen.getByLabelText("Service name"), { target: { value: "payments" } });
    fireEvent.change(screen.getByLabelText("Alert message"), { target: { value: "HTTP 500 spike" } });
    fireEvent.change(screen.getByLabelText("Logs or stack trace"), { target: { value: "error" } });
    fireEvent.click(screen.getByRole("button", { name: "Analyze incident" }));

    await waitFor(() => expect(screen.getByText("Investigation workspace")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "New incident" }));
    expect(await screen.findByRole("heading", { name: "Incident intake", level: 1 })).toBeInTheDocument();
  });

  it("allows refining with only one answered follow-up question", async () => {
    mockFetchSavedIncidentDetail
      .mockResolvedValueOnce({
        id: "incident-123",
        createdAt: "2026-06-01T12:00:00.000Z",
        updatedAt: "2026-06-01T12:00:00.000Z",
        latestVersion: 1,
        context: {
          title: "Checkout failures",
          serviceName: "payments",
          environment: "production",
          alertMessage: "HTTP 500 spike",
          logsOrStackTrace: "error",
          recentDeployNotes: ""
        },
        reports: [
          {
            version: 1,
            createdAt: "2026-06-01T12:00:00.000Z",
            followUpAnswers: null,
            report: {
              summary: "Initial summary",
              severity: "MEDIUM",
              suspectedComponent: "payments",
              probableCauses: ["Config drift"],
              nextSteps: ["Check config"],
              confidence: 0.6,
              clarifyingQuestions: ["Was there a deploy?", "Did traffic spike?"]
            }
          }
        ]
      })
      .mockResolvedValueOnce({
        id: "incident-123",
        createdAt: "2026-06-01T12:00:00.000Z",
        updatedAt: "2026-06-01T13:00:00.000Z",
        latestVersion: 2,
        context: {
          title: "Checkout failures",
          serviceName: "payments",
          environment: "production",
          alertMessage: "HTTP 500 spike",
          logsOrStackTrace: "error",
          recentDeployNotes: ""
        },
        reports: [
          {
            version: 2,
            createdAt: "2026-06-01T13:00:00.000Z",
            followUpAnswers: [{ question: "Was there a deploy?", answer: "Yes, five minutes before the alert." }],
            report: {
              summary: "Refined summary",
              severity: "HIGH",
              suspectedComponent: "payments",
              probableCauses: ["Bad deploy"],
              nextSteps: ["Rollback"],
              confidence: 0.8,
              clarifyingQuestions: []
            }
          },
          {
            version: 1,
            createdAt: "2026-06-01T12:00:00.000Z",
            followUpAnswers: null,
            report: {
              summary: "Initial summary",
              severity: "MEDIUM",
              suspectedComponent: "payments",
              probableCauses: ["Config drift"],
              nextSteps: ["Check config"],
              confidence: 0.6,
              clarifyingQuestions: ["Was there a deploy?", "Did traffic spike?"]
            }
          }
        ]
      });

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

    await screen.findByRole("heading", { name: "Incident intake", level: 1 });

    fireEvent.change(await screen.findByLabelText("Incident title"), { target: { value: "Checkout failures" } });
    fireEvent.change(screen.getByLabelText("Service name"), { target: { value: "payments" } });
    fireEvent.change(screen.getByLabelText("Alert message"), { target: { value: "HTTP 500 spike" } });
    fireEvent.change(screen.getByLabelText("Logs or stack trace"), { target: { value: "error" } });
    fireEvent.click(screen.getByRole("button", { name: "Analyze incident" }));

    await waitFor(() =>
      expect(screen.getAllByText("Initial summary").length).toBeGreaterThan(0)
    );

    fireEvent.change(screen.getByLabelText("Answer for question 1"), {
      target: { value: "Yes, five minutes before the alert." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit evidence and refine" }));

    await waitFor(() => expect(screen.getAllByText("Refined summary").length).toBeGreaterThan(0));
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

    await waitFor(() => expect(screen.getAllByText("Saved in UI only").length).toBeGreaterThan(0));
    expect(screen.getByText("Workspace save issue")).toBeInTheDocument();
    expect(mockFetchSavedIncidentDetail).not.toHaveBeenCalled();
  });
});
