import {
  SessionSummary,
  TimelineBucket,
  Anomaly,
  CausalityGraph,
  IncidentReport,
  ChatResponse,
  LogEntry,
  AuthUser,
  IncidentAnalysis,
  DependencyEdge
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const GOOGLE_LOGIN_URL = `${API_BASE_URL}/api/auth/google/login`;

export async function getCurrentUser(): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    credentials: "include",
    cache: "no-store",
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to load authentication session");
  return res.json();
}

export async function logout(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Logout failed");
}

export async function uploadLogs(files: File[], sources: string[]): Promise<{ session_id: string; message: string }> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  sources.forEach((src) => formData.append("sources", src));

  const res = await fetch(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Upload failed");
  }

  return res.json();
}

export async function loadDemoData(): Promise<{ session_id: string; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/demo/load`, {
    method: "POST",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Demo load failed" }));
    throw new Error(err.detail || "Demo load failed");
  }

  return res.json();
}

export async function getSessionSummary(sessionId: string): Promise<SessionSummary> {
  const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/summary`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load session summary");
  return res.json();
}

export async function getTimeline(sessionId: string): Promise<TimelineBucket[]> {
  const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/timeline`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load timeline");
  return res.json();
}

export async function getAnomalies(sessionId: string): Promise<Anomaly[]> {
  const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/anomalies`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load anomalies");
  return res.json();
}

export async function getCausalityGraph(sessionId: string): Promise<CausalityGraph> {
  const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/graph`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load graph");
  return res.json();
}

export async function getIncidentReport(sessionId: string): Promise<IncidentReport | null> {
  const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/incident`, {
    cache: "no-store",
  });
  if (res.status === 202) return null;
  if (!res.ok) throw new Error("Failed to load incident report");
  return res.json();
}

export async function sendChatMessage(sessionId: string, question: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error("Chat request failed");
  return res.json();
}

export async function getSessionLogs(
  sessionId: string,
  service?: string,
  level?: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ total: number; logs: LogEntry[] }> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  if (service) params.append("service", service);
  if (level) params.append("level", level);

  const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/logs?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load logs");
  return res.json();
}

export async function getIncidentAnalysis(sessionId: string): Promise<IncidentAnalysis | null> {
  const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/analysis`, {
    cache: "no-store",
  });
  if (res.status === 202) return null;
  if (!res.ok) throw new Error("Failed to load incident analysis");
  return res.json();
}

export async function updateSessionDependencies(
  sessionId: string,
  dependencies: DependencyEdge[]
): Promise<IncidentAnalysis> {
  const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/dependencies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dependencies }),
  });
  if (!res.ok) throw new Error("Failed to update dependencies");
  return res.json();
}
