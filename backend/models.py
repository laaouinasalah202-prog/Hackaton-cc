from __future__ import annotations
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

class AuthUser(BaseModel):
    sub: str
    email: str
    name: str = ""
    picture: Optional[str] = None
    email_verified: bool = False

class LogEntry(BaseModel):
    ts: Optional[str] = Field(default=None, description="ISO 8601 UTC timestamp (None if unparseable)")
    source: str = Field(description="Service name or file source")
    level: str = Field(default="INFO", description="Log level: INFO, WARN, ERROR, DEBUG, CRITICAL")
    message: str = Field(description="Log message content")
    template_id: Optional[str] = Field(default=None, description="Drain3 or cluster template identifier")
    template_str: Optional[str] = Field(default=None, description="Extracted template pattern")
    cluster_id: Optional[int] = Field(default=None, description="Embedding cluster ID")
    attrs: Dict[str, Any] = Field(default_factory=dict, description="Parsed extra attributes/fields")

class Anomaly(BaseModel):
    id: str
    type: str  # "rare_template", "spike", "error_jump"
    service: str
    template_id: Optional[str] = None
    template_str: Optional[str] = None
    score: float
    timestamp: str
    sample_messages: List[str] = Field(default_factory=list)
    explanation: Optional[str] = None

class CausalityNode(BaseModel):
    id: str
    name: str
    error_count: int = 0
    anomaly_count: int = 0
    type: str = "log_event"  # "log_event" or "service"
    service: str = ""
    level: str = "INFO"  # "CRITICAL", "ERROR", "WARN", "INFO", "DEBUG"
    count: int = 1
    sample_message: str = ""
    template_str: str = ""
    first_ts: str = ""
    last_ts: str = ""

class CausalityEdge(BaseModel):
    source: str
    target: str
    weight: float
    lag_seconds: float = 0.0
    description: str = ""

class CausalityGraph(BaseModel):
    nodes: List[CausalityNode] = Field(default_factory=list)
    edges: List[CausalityEdge] = Field(default_factory=list)
    service_nodes: List[CausalityNode] = Field(default_factory=list)
    service_edges: List[CausalityEdge] = Field(default_factory=list)

class IncidentReport(BaseModel):
    root_cause: str
    summary: str
    affected_services: List[str] = Field(default_factory=list)
    timeline_summary: str = ""
    suggested_fix: str = ""
    severity: str = "HIGH"

class TimelineBucket(BaseModel):
    timestamp: str
    total: int = 0
    error_count: int = 0
    by_level: Dict[str, int] = Field(default_factory=dict)
    by_service: Dict[str, int] = Field(default_factory=dict)
    by_cluster: Dict[str, int] = Field(default_factory=dict)
    anomalies: List[str] = Field(default_factory=list)

class SessionSummary(BaseModel):
    session_id: str
    status: str = "processing"  # "processing", "completed", "failed"
    progress: int = 0  # 0 to 100
    message: str = ""
    total_logs: int = 0
    services: List[str] = Field(default_factory=list)
    time_range: Dict[str, Optional[str]] = Field(default_factory=lambda: {"start": None, "end": None})
    detected_formats: Dict[str, str] = Field(default_factory=dict)
    level_counts: Dict[str, int] = Field(default_factory=dict)
    error_rate: float = 0.0
    anomaly_count: int = 0
    unparsed_timestamps: int = 0

class UploadResponse(BaseModel):
    session_id: str
    message: str
    file_count: int

class ChatRequest(BaseModel):
    question: str

class ChatResponse(BaseModel):
    answer: str
    referenced_services: List[str] = Field(default_factory=list)
    referenced_anomalies: List[str] = Field(default_factory=list)

# --- Deterministic Incident Analysis Models ---

class EvidenceItem(BaseModel):
    id: int  # stable index into all_entries
    ts: Optional[str] = None
    service: str
    level: str
    message: str

class ServiceHealthBucket(BaseModel):
    service: str
    bucket_start: str
    bucket_end: str
    request_count: int = 0
    error_count: int = 0
    error_rate: float = 0.0
    p95_latency: Optional[float] = None
    top_error_signature: Optional[str] = None

class ServiceOnset(BaseModel):
    service: str
    onset_ts: Optional[str] = None
    severity: str = "INFO"  # "WARN", "ERROR", "CRITICAL"
    first_symptom: str = ""
    evidence_ids: List[int] = Field(default_factory=list)
    reports_upstream_errors: bool = False
    error_rate_at_onset: float = 0.0

class IncidentPhase(BaseModel):
    label: str  # "HEALTHY", "DEGRADED", "FAILING", "OUTAGE"
    start_ts: str
    end_ts: str
    description: str
    dominant_signature: str
    count: int = 0
    evidence_ids: List[int] = Field(default_factory=list)

class DependencyEdge(BaseModel):
    source: str  # caller/client
    target: str  # dependency/upstream
    type: str = "observed"  # "observed", "inferred", "user_defined"
    confidence: float = 0.8
    reason: str = ""
    evidence_ids: List[int] = Field(default_factory=list)

class RootCauseCandidate(BaseModel):
    service: str
    score: float
    confidence: float
    is_root_cause: bool = False
    reasons: List[str] = Field(default_factory=list)
    reports_upstream_errors: bool = False
    onset_ts: Optional[str] = None

class ActionItem(BaseModel):
    priority: str  # "P1", "P2", "P3"
    action: str
    why: str

class IncidentAnalysis(BaseModel):
    session_id: str
    ai_status: str = "available"  # "available", "unavailable", "simulated"
    ai_status_reason: Optional[str] = None
    headline: str
    what_happened: str
    root_cause_service: str
    confidence: float
    root_cause_explanation: str
    propagation_path: List[str] = Field(default_factory=list)
    first_symptom: str = ""
    time_to_full_outage: str = ""
    blast_radius: List[str] = Field(default_factory=list)
    user_impact: str = ""
    confidence_note: str = ""
    suggested_actions: List[ActionItem] = Field(default_factory=list)
    phases: List[IncidentPhase] = Field(default_factory=list)
    service_onsets: Dict[str, ServiceOnset] = Field(default_factory=dict)
    ranked_candidates: List[RootCauseCandidate] = Field(default_factory=list)
    dependencies: List[DependencyEdge] = Field(default_factory=list)
    evidence: List[EvidenceItem] = Field(default_factory=list)
    health_timeline: List[Dict[str, Any]] = Field(default_factory=list)
    evidence_ids_used: List[int] = Field(default_factory=list)

class DependencyUpdateRequest(BaseModel):
    dependencies: List[DependencyEdge]
