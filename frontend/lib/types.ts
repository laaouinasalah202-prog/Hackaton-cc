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
  unparsed_timestamps?: number;
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
  service?: string;
  level?: "CRITICAL" | "ERROR" | "WARN" | "INFO" | string;
  count?: number;
  sample_message?: string;
  template_str?: string;
  first_ts?: string;
  last_ts?: string;
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
  service_nodes?: CausalityNode[];
  service_edges?: CausalityEdge[];
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

export interface EvidenceItem {
  id: number;
  ts: string | null;
  service: string;
  level: string;
  message: string;
}

export interface ServiceOnset {
  service: string;
  onset_ts: string | null;
  severity: "CRITICAL" | "ERROR" | "WARN" | "INFO" | string;
  first_symptom: string;
  evidence_ids: number[];
  reports_upstream_errors: boolean;
  error_rate_at_onset: number;
}

export interface IncidentPhase {
  label: "HEALTHY" | "DEGRADED" | "FAILING" | "OUTAGE" | string;
  start_ts: string;
  end_ts: string;
  description: string;
  dominant_signature: string;
  count: number;
  evidence_ids: number[];
}

export interface DependencyEdge {
  source: string;
  target: string;
  type: "observed" | "inferred" | "user_defined";
  confidence: number;
  reason: string;
  evidence_ids: number[];
}

export interface RootCauseCandidate {
  service: string;
  score: number;
  confidence: number;
  is_root_cause: boolean;
  reasons: string[];
  reports_upstream_errors: boolean;
  onset_ts: string | null;
}

export interface ActionItem {
  priority: "P1" | "P2" | "P3" | string;
  action: string;
  why: string;
}

export interface IncidentAnalysis {
  session_id: string;
  ai_status: "available" | "unavailable" | "simulated";
  ai_status_reason?: string | null;
  headline: string;
  what_happened: string;
  root_cause_service: string;
  confidence: number;
  root_cause_explanation: string;
  propagation_path: string[];
  first_symptom: string;
  time_to_full_outage: string;
  blast_radius: string[];
  user_impact: string;
  confidence_note?: string;
  suggested_actions: ActionItem[];
  phases: IncidentPhase[];
  service_onsets: Record<string, ServiceOnset>;
  ranked_candidates: RootCauseCandidate[];
  dependencies: DependencyEdge[];
  evidence: EvidenceItem[];
  health_timeline: Array<{
    bucket_idx: number;
    start: string;
    end: string;
    services: Record<string, {
      service: string;
      request_count: number;
      error_count: number;
      error_rate: number;
      p95_latency: number | null;
      top_error_signature: string | null;
    }>;
  }>;
  evidence_ids_used: number[];
}
