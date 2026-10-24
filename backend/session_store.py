import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from backend.models import SessionSummary, LogEntry, Anomaly, CausalityGraph, IncidentReport, TimelineBucket
from backend.config import STORAGE_DIR

logger = logging.getLogger("session_store")

class SessionData:
    def __init__(self, session_id: str):
        self.session_id: str = session_id
        self.summary: SessionSummary = SessionSummary(session_id=session_id)
        self.entries: List[LogEntry] = []
        self.anomalies: List[Anomaly] = []
        self.graph: CausalityGraph = CausalityGraph()
        self.incident_report: Optional[IncidentReport] = None
        self.timeline: List[TimelineBucket] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "summary": self.summary.model_dump(),
            "entries_count": len(self.entries),
            "anomalies": [a.model_dump() for a in self.anomalies],
            "graph": self.graph.model_dump(),
            "incident_report": self.incident_report.model_dump() if self.incident_report else None,
            "timeline": [t.model_dump() for t in self.timeline],
        }

class SessionStore:
    """In-memory session manager with filesystem persistence."""

    def __init__(self):
        self._sessions: Dict[str, SessionData] = {}

    def get_or_create(self, session_id: str) -> SessionData:
        if session_id not in self._sessions:
            self._sessions[session_id] = SessionData(session_id)
        return self._sessions[session_id]

    def get(self, session_id: str) -> Optional[SessionData]:
        if session_id in self._sessions:
            return self._sessions[session_id]
        
        # Try loading from disk
        filepath = STORAGE_DIR / f"{session_id}.json"
        if filepath.exists():
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    sess = SessionData(session_id)
                    sess.summary = SessionSummary(**data.get("summary", {}))
                    sess.anomalies = [Anomaly(**a) for a in data.get("anomalies", [])]
                    sess.graph = CausalityGraph(**data.get("graph", {}))
                    if data.get("incident_report"):
                        sess.incident_report = IncidentReport(**data["incident_report"])
                    sess.timeline = [TimelineBucket(**t) for t in data.get("timeline", [])]
                    self._sessions[session_id] = sess
                    return sess
            except Exception as e:
                logger.error(f"Failed to load session {session_id} from disk: {e}")

        return None

    def save_to_disk(self, session_id: str):
        sess = self._sessions.get(session_id)
        if not sess:
            return
        filepath = STORAGE_DIR / f"{session_id}.json"
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(sess.to_dict(), f, indent=2)
        except Exception as e:
            logger.error(f"Failed to persist session {session_id}: {e}")

# Global singleton
store = SessionStore()
