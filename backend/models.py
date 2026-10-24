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
    ts: str = Field(description="ISO 8601 UTC timestamp")
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
    type: str = "service"

class CausalityEdge(BaseModel):
    source: str
    target: str
    weight: float
    lag_seconds: float = 0.0
    description: str = ""

class CausalityGraph(BaseModel):
    nodes: List[CausalityNode] = Field(default_factory=list)
    edges: List[CausalityEdge] = Field(default_factory=list)

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
