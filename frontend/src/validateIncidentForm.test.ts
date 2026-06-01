import { describe, expect, it } from "vitest";
import { validateIncidentForm } from "./validateIncidentForm";

describe("validateIncidentForm", () => {
  it("returns field-specific messages for missing required values", () => {
    const errors = validateIncidentForm({
      title: "",
      serviceName: "",
      environment: "",
      alertMessage: "",
      logsOrStackTrace: "",
      recentDeployNotes: ""
    });

    expect(errors.title).toBe("Incident title is required.");
    expect(errors.logsOrStackTrace).toBe("Logs or a stack trace are required.");
  });
});
