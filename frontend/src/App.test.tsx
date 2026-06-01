import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

    fireEvent.change(screen.getByLabelText("Incident title"), { target: { value: "Checkout failures" } });
    fireEvent.change(screen.getByLabelText("Service name"), { target: { value: "payments" } });
    fireEvent.change(screen.getByLabelText("Alert message"), { target: { value: "HTTP 500 spike" } });
    fireEvent.change(screen.getByLabelText("Logs or stack trace"), {
      target: { value: "java.net.UnknownHostException: db.internal" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Analyze incident" }));

    await waitFor(() =>
      expect(screen.getByText("Checkout failures point to a payment adapter database host issue.")).toBeInTheDocument()
    );

    expect(screen.getByText("HIGH")).toBeInTheDocument();
    expect(screen.getAllByText("Did this begin immediately after the latest deployment?")).toHaveLength(2);
  });

  it("renders a backend error message when analysis fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "OpenAI request failed.", fieldErrors: {} }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      })
    );

    render(<App />);

    fireEvent.change(screen.getByLabelText("Incident title"), { target: { value: "Checkout failures" } });
    fireEvent.change(screen.getByLabelText("Service name"), { target: { value: "payments" } });
    fireEvent.change(screen.getByLabelText("Alert message"), { target: { value: "HTTP 500 spike" } });
    fireEvent.change(screen.getByLabelText("Logs or stack trace"), {
      target: { value: "java.net.UnknownHostException: db.internal" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Analyze incident" }));

    await waitFor(() => expect(screen.getByText("OpenAI request failed.")).toBeInTheDocument());
  });

  it("renders a clarifying-questions empty state when none are returned", async () => {
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

    fireEvent.change(screen.getByLabelText("Incident title"), { target: { value: "Subset 503s" } });
    fireEvent.change(screen.getByLabelText("Service name"), { target: { value: "edge" } });
    fireEvent.change(screen.getByLabelText("Alert message"), { target: { value: "5xx increase" } });
    fireEvent.change(screen.getByLabelText("Logs or stack trace"), { target: { value: "cache node 7 timeout" } });

    fireEvent.click(screen.getByRole("button", { name: "Analyze incident" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "The model had enough context to produce a first-pass report without follow-up questions."
        )
      ).toBeInTheDocument()
    );
  });
});
