import { supabase } from "./supabase";
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
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: await createRequestHeaders(),
      body: JSON.stringify(payload)
    });
  } catch {
    throw new ApiError(
      `Could not reach the IncidentPilot API at ${API_BASE_URL}. Check that the backend is running and VITE_API_BASE_URL is correct.`
    );
  }

  const data = (await response.json().catch(() => null)) as ApiErrorResponse | TResponse | null;
  if (!response.ok) {
    const errorPayload = (data ?? { message: defaultErrorMessage(response.status) }) as ApiErrorResponse;
    throw new ApiError(errorPayload.message, errorPayload.fieldErrors ?? {});
  }

  return data as TResponse;
}

async function createRequestHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (!supabase) {
    return headers;
  }

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

function defaultErrorMessage(status: number) {
  if (status === 400) {
    return "Please correct the highlighted fields.";
  }
  if (status === 401) {
    return "Your session expired or is invalid. Sign in again and retry the analysis.";
  }
  if (status === 403) {
    return "You are not allowed to run this analysis.";
  }
  if (status === 502) {
    return "The AI analysis service failed. Check the backend logs and OpenAI configuration, then try again.";
  }
  if (status === 503) {
    return "The analysis service is not configured. Set OPENAI_API_KEY on the backend.";
  }
  return "The request failed. Please try again.";
}
