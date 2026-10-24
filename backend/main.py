import asyncio
import logging
import uuid
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from backend.models import (
    UploadResponse, SessionSummary, TimelineBucket, Anomaly,
    CausalityGraph, IncidentReport, ChatRequest, ChatResponse
)
from backend.session_store import store
from backend.pipeline.coordinator import run_session_analysis
from backend.pipeline.llm_analysis import answer_nl_query

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("main")

app = FastAPI(
    title="LogLens API",
    description="AI Log Analysis Platform Backend",
    version="1.0.0"
)

# CORS enabled for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"name": "LogLens API", "version": "1.0.0", "status": "online"}

@app.post("/api/upload", response_model=UploadResponse)
async def upload_logs(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    sources: Optional[List[str]] = Form(None)
):
    """
    Accepts multiple log files with optional source labels.
    Creates a new session and launches background analysis pipeline.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    session_id = str(uuid.uuid4())
    raw_files = []

    for idx, file in enumerate(files):
        content = await file.read()
        label = sources[idx] if (sources and idx < len(sources)) else None
        raw_files.append((file.filename, content, label))

    # Initialize session in store
    sess = store.get_or_create(session_id)
    sess.summary.status = "processing"
    sess.summary.progress = 5
    sess.summary.message = f"Uploaded {len(files)} files. Starting analysis..."

    # Enqueue background processing
    background_tasks.add_task(run_session_analysis, session_id, raw_files)

    return UploadResponse(
        session_id=session_id,
        message="Log files received. Analysis enqueued.",
        file_count=len(files)
    )

@app.post("/api/demo/load", response_model=UploadResponse)
async def load_demo_data(background_tasks: BackgroundTasks):
    """
    One-click demo endpoint: generates realistic cascading failure logs
    across 4 distinct services with 4 distinct log formats and triggers analysis.
    """
    from demo.generate_demo_logs import generate_demo_logs
    files_dict = generate_demo_logs()
    
    session_id = str(uuid.uuid4())
    raw_files = [
        (fname, content.encode("utf-8"), fname.replace(".log", ""))
        for fname, content in files_dict.items()
    ]

    sess = store.get_or_create(session_id)
    sess.summary.status = "processing"
    sess.summary.progress = 5
    sess.summary.message = "Loading simulated 4-service cascading failure logs..."

    background_tasks.add_task(run_session_analysis, session_id, raw_files)

    return UploadResponse(
        session_id=session_id,
        message="Demo cascading failure logs loaded successfully.",
        file_count=len(raw_files)
    )


@app.get("/api/sessions/{session_id}/summary", response_model=SessionSummary)
def get_summary(session_id: str):
    sess = store.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found.")
    return sess.summary

@app.get("/api/sessions/{session_id}/timeline", response_model=List[TimelineBucket])
def get_timeline(session_id: str):
    sess = store.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found.")
    return sess.timeline

@app.get("/api/sessions/{session_id}/anomalies", response_model=List[Anomaly])
def get_anomalies(session_id: str):
    sess = store.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found.")
    return sess.anomalies

@app.get("/api/sessions/{session_id}/graph", response_model=CausalityGraph)
def get_graph(session_id: str):
    sess = store.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found.")
    return sess.graph

@app.get("/api/sessions/{session_id}/incident", response_model=IncidentReport)
def get_incident(session_id: str):
    sess = store.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found.")
    if not sess.incident_report:
        raise HTTPException(status_code=202, detail="Incident report still processing.")
    return sess.incident_report

@app.post("/api/sessions/{session_id}/chat", response_model=ChatResponse)
def chat_with_session(session_id: str, request: ChatRequest):
    sess = store.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found.")

    error_entries = [e for e in sess.entries if e.level in ("ERROR", "CRITICAL")]
    return answer_nl_query(
        question=request.question,
        summary=sess.summary,
        anomalies=sess.anomalies,
        graph=sess.graph,
        sample_errors=error_entries
    )

@app.get("/api/sessions/{session_id}/logs")
def get_session_logs(
    session_id: str,
    limit: int = 100,
    offset: int = 0,
    service: Optional[str] = None,
    level: Optional[str] = None
):
    """Retrieve raw parsed unified log entries with optional filters."""
    sess = store.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found.")

    filtered = sess.entries
    if service:
        filtered = [e for e in filtered if e.source == service]
    if level:
        filtered = [e for e in filtered if e.level == level.upper()]

    total = len(filtered)
    page = filtered[offset : offset + limit]

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "logs": [e.model_dump() for e in page]
    }
