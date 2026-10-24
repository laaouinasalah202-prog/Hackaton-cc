import asyncio
import logging
import uuid
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Request, Response
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.models import (
    UploadResponse,
    SessionSummary,
    TimelineBucket,
    Anomaly,
    CausalityGraph,
    IncidentReport,
    ChatRequest,
    ChatResponse,
    AuthUser,
    IncidentAnalysis,
    DependencyUpdateRequest,
)
from backend.auth import GoogleAuthError, build_google_login_url, exchange_code_for_session, get_session, delete_session
from backend.config import AUTH_COOKIE_SECURE, AUTH_SESSION_COOKIE, FRONTEND_URL, AUTH_SESSION_MAX_AGE
from backend.session_store import store
from backend.pipeline.coordinator import run_session_analysis
from backend.pipeline.incident_analysis import analyze_incident
from backend.pipeline.llm_analysis import answer_nl_query, narrate_incident

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("main")

app = FastAPI(
    title="LogLens API", description="AI Log Analysis Platform Backend", version="1.0.0"
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

@app.get("/api/auth/google/login")
def google_login():
    try:
        return RedirectResponse(build_google_login_url())
    except GoogleAuthError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

@app.get("/api/auth/google/callback")
async def google_callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    if error:
        raise HTTPException(status_code=400, detail=f"Google authentication failed: {error}")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing Google authorization parameters.")

    try:
        session_id, _ = await exchange_code_for_session(code, state)
    except (GoogleAuthError, HTTPException) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    response = RedirectResponse(f"{FRONTEND_URL}/")
    response.set_cookie(
        key=AUTH_SESSION_COOKIE,
        value=session_id,
        max_age=AUTH_SESSION_MAX_AGE,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite="lax",
    )
    return response

@app.get("/api/auth/me", response_model=AuthUser)
def current_user(request: Request):
    user = get_session(request.cookies.get(AUTH_SESSION_COOKIE))
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return user

@app.post("/api/auth/logout")
def logout(request: Request, response: Response):
    delete_session(request.cookies.get(AUTH_SESSION_COOKIE))
    response.delete_cookie(AUTH_SESSION_COOKIE)
    return {"message": "Logged out"}

@app.post("/api/upload", response_model=UploadResponse)
async def upload_logs(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    sources: Optional[List[str]] = Form(None),
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
        file_count=len(files),
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
        file_count=len(raw_files),
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

@app.get("/api/sessions/{session_id}/analysis", response_model=IncidentAnalysis)
def get_analysis(session_id: str):
    sess = store.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found.")
    if not sess.incident_analysis:
        if sess.entries:
            analysis = analyze_incident(session_id, sess.entries, sess.anomalies, user_dependencies=sess.user_dependencies)
            analysis = narrate_incident(analysis)
            sess.incident_analysis = analysis
            store.save_to_disk(session_id)
            return analysis
        raise HTTPException(status_code=202, detail="Analysis still processing.")
    return sess.incident_analysis

@app.post("/api/sessions/{session_id}/dependencies", response_model=IncidentAnalysis)
def update_dependencies(session_id: str, request: DependencyUpdateRequest):
    sess = store.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found.")
    sess.user_dependencies = [d.model_dump() for d in request.dependencies]
    # Re-run deterministic analysis with updated user dependencies
    analysis = analyze_incident(session_id, sess.entries, sess.anomalies, user_dependencies=sess.user_dependencies)
    analysis = narrate_incident(analysis)
    sess.incident_analysis = analysis
    store.save_to_disk(session_id)
    return analysis

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
        sample_errors=error_entries,
        analysis=sess.incident_analysis
    )


@app.get("/api/sessions/{session_id}/logs")
def get_session_logs(
    session_id: str,
    limit: int = 100,
    offset: int = 0,
    service: Optional[str] = None,
    level: Optional[str] = None,
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
        "logs": [e.model_dump() for e in page],
    }
