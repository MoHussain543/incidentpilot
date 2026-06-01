import type {
  AnalyzeIncidentRequest,
  ApiErrorResponse,
  IncidentTriageReport,
  RefineIncidentRequest
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  fieldErrors: Record<string, string>;

  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.fieldErrors = fieldErrors;
  }
}

export async function analyzeIncident(
  payload: AnalyzeIncidentRequest
): Promise<IncidentTriageReport> {
  return request<IncidentTriageReport>("/api/v1/incidents/analyze", payload);
}

export async function refineIncident(
  payload: RefineIncidentRequest
): Promise<IncidentTriageReport> {
  return request<IncidentTriageReport>("/api/v1/incidents/refine", payload);
}

async function request<TResponse>(path: string, payload: unknown): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = (await response.json().catch(() => null)) as ApiErrorResponse | TResponse | null;
  if (!response.ok) {
    const errorPayload = (data ?? { message: "The request failed." }) as ApiErrorResponse;
    throw new ApiError(errorPayload.message, errorPayload.fieldErrors ?? {});
  }

  return data as TResponse;
}
