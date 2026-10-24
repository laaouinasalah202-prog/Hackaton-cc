export interface SessionSummary {
  session_id: string;
  status: "processing" | "completed" | "failed";
  progress: number;
  message: string;
  total_logs: number;
  services: string[];
  time_range: {
    start: string | null;
    end: string | null;
  };
  detected_formats: Record<string, string>;
  level_counts: Record<string, number>;
  error_rate: number;
  anomaly_count: number;
}

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
  email_verified: boolean;
}

export interface TimelineBucket {
  timestamp: string;
  total: number;
  error_count: number;
  by_level: Record<string, number>;
  by_service: Record<string, number>;
  by_cluster: Record<string, number>;
  anomalies: string[];
}

export interface Anomaly {
  id: string;
  type: "rare_template" | "spike" | "error_jump" | string;
  service: string;
  template_id: string | null;
  template_str: string | null;
  score: number;
  timestamp: string;
  sample_messages: string[];
  explanation: string | null;
}

export interface CausalityNode {
  id: string;
  name: string;
  error_count: number;
  anomaly_count: number;
  type: string;
}

export interface CausalityEdge {
  source: string;
  target: string;
  weight: number;
  lag_seconds: number;
  description: string;
}

export interface CausalityGraph {
  nodes: CausalityNode[];
  edges: CausalityEdge[];
}

export interface IncidentReport {
  root_cause: string;
  summary: string;
  affected_services: string[];
  timeline_summary: string;
  suggested_fix: string;
  severity: string;
}

export interface ChatResponse {
  answer: string;
  referenced_services: string[];
  referenced_anomalies: string[];
}

export interface LogEntry {
  ts: string;
  source: string;
  level: string;
  message: string;
  template_id?: string;
  template_str?: string;
  cluster_id?: number;
  attrs?: Record<string, any>;
}
