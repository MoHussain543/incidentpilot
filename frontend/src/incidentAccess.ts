import type { SupabaseClient } from "@supabase/supabase-js";

export type IncidentAccessErrorCode = "UNAUTHENTICATED" | "ACCESS_DENIED";

export class IncidentAccessError extends Error {
  code: IncidentAccessErrorCode;

  constructor(message: string, code: IncidentAccessErrorCode) {
    super(message);
    this.name = "IncidentAccessError";
    this.code = code;
  }
}

export async function requireAuthenticatedUser(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw new IncidentAccessError("You must be signed in to access saved incidents.", "UNAUTHENTICATED");
  }

  return data.user.id;
}

export function assertExpectedUser(authenticatedUserId: string, requestedUserId: string): void {
  if (authenticatedUserId !== requestedUserId) {
    throw new IncidentAccessError(
      "This workspace action does not match the signed-in user.",
      "ACCESS_DENIED"
    );
  }
}

export async function resolveScopedUserId(
  client: SupabaseClient,
  requestedUserId: string
): Promise<string> {
  const authenticatedUserId = await requireAuthenticatedUser(client);
  assertExpectedUser(authenticatedUserId, requestedUserId);
  return authenticatedUserId;
}
