import { describe, expect, it, vi } from "vitest";
import {
  assertExpectedUser,
  IncidentAccessError,
  requireAuthenticatedUser,
  resolveScopedUserId
} from "./incidentAccess";

describe("incidentAccess", () => {
  it("returns the authenticated user id", async () => {
    const client = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-123" } },
          error: null
        }))
      }
    };

    await expect(requireAuthenticatedUser(client as never)).resolves.toBe("user-123");
  });

  it("rejects cross-user access attempts", () => {
    expect(() => assertExpectedUser("user-123", "user-456")).toThrow(IncidentAccessError);
  });

  it("rejects when the session user does not match the requested workspace user", async () => {
    const client = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-123" } },
          error: null
        }))
      }
    };

    await expect(resolveScopedUserId(client as never, "user-456")).rejects.toMatchObject({
      code: "ACCESS_DENIED"
    });
  });
});
