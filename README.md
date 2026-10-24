# 🔍 LogLens — AI Log Analysis Platform

**LogLens** is a format-agnostic AI log intelligence platform designed to ingest multi-source logs in **any format**, clean and normalize them into a canonical schema, extract Drain3 templates, detect statistical and semantic anomalies, discover cross-service causality cascades, and leverage open-weight LLMs (Gemma) to deliver plain-English root-cause diagnoses.

Built for hackathon velocity, robustness, and zero configuration overhead.

---

## ⚡ Tech Stack

- **Frontend**: Next.js 14 (App Router, TypeScript, Tailwind CSS), Recharts, SVG Directed Causality Graph, Lucide Icons.
- **Backend**: Python 3.11+ / FastAPI in `/backend`, Uvicorn.
- **ML / AI Pipeline**:
  - **LLM**: Gemma (`gemma-3-27b-it`) behind an abstract provider `backend/llm_client.py` (Google AI Studio / OpenAI-compatible / local Ollama).
  - **Log Mining**: `drain3` for structural template extraction.
  - **Vector Embeddings**: `sentence-transformers` (`all-MiniLM-L6-v2`) on unique templates.
  - **Clustering**: `scikit-learn` HDBSCAN.
  - **Anomaly Detection**: Dynamic Z-score time-bucket spikes, rare template scoring, and service error-rate jump detection.
  - **Causality Engine**: Time-lag burst analysis building directed propagation graphs across services.
- **Storage**: In-memory session store + lightweight JSON session persistence (`backend/storage/`).

---

## 🏗️ Unified Canonical Schema

Every log line across any format is parsed into:

```json
{
  "ts": "2026-10-24T10:15:30.123Z",
  "source": "api-server",
  "level": "ERROR",
  "message": "HikariPool-1 - Connection is not available, request timed out after 30000ms",
  "template_id": "4",
  "template_str": "HikariPool-<NUM> - Connection is not available, request timed out after <NUM>ms",
  "cluster_id": 2,
  "attrs": { "thread": "http-nio-8080-exec-1" }
}
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 2. Backend Setup
```bash
# In repository root:
python3 -m venv .venv
source .venv/bin/activate

# Install requirements
pip install -r backend/requirements.txt

# Configure environment
cp backend/.env.example backend/.env
# (Optional) Edit backend/.env to set GEMMA_API_KEY
```

#### Google authentication

In Google Cloud Console, create an OAuth client of type **Web application**. Add
`http://localhost:8000/api/auth/google/callback` to its authorized redirect URIs,
then put the client ID and secret in `backend/.env`:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
FRONTEND_URL=http://localhost:3000
AUTH_COOKIE_SECURE=false
```

The backend endpoints are `GET /api/auth/google/login`, `GET /api/auth/me`, and
`POST /api/auth/logout`. Login uses a short-lived OAuth state token and stores the
authenticated session in an HttpOnly cookie. The current session store is in-memory,
so use a shared database or Redis before running multiple production workers.

Run backend server:
```bash
source .venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
API docs available at: `http://localhost:8000/docs`

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🧪 One-Click Cascading Failure Demo

LogLens includes a built-in multi-format cascading failure simulation in `/demo`.

1. Launch frontend at `http://localhost:3000`.
2. Click **"Load Demo Data"**.
3. The platform generates 4 heterogeneous services:
   - `database` (Plain-text PostgreSQL log with slow queries & pool exhaustion)
   - `api-server` (Java Log4j format with multi-line stack traces)
   - `api-gateway` (Nginx combined access log format with 502/504 status codes)
   - `auth-worker` (JSON lines format with failed token validations)
4. The dashboard displays:
   - **Summary cards**: Total cleaned logs, error rate, services, and anomaly count.
   - **Incident Root Cause Panel**: Gemma AI synthesis identifying the PostgreSQL lock contention and recommending connection pool fixes.
   - **Causality Graph**: Interactive directed graph illustrating `database -> api-server -> api-gateway` propagation.
   - **Service Error Heatmap**: Synchronized fault density over chronological bins.
   - **Stacked Timeline Chart**: Breakdown by service or level with anomaly markers.
   - **Anomaly List**: Interactive drawer with Gemma AI explanations and sample raw traces.
   - **LogCopilot Chat**: Grounded Q&A assistant answering natural language questions about the session.
   - **Canonical Log Explorer**: Searchable, paginated unified schema table.

---

## 🔌 API Endpoints

- `POST /api/upload`: Multipart upload with optional `sources` labels. Enqueues background pipeline.
- `POST /api/demo/load`: One-click generator & loader for 4-service cascading failure logs.
- `GET  /api/sessions/{id}/summary`: Polling progress, counts, time range, and detected formats.
- `GET  /api/sessions/{id}/timeline`: Event counts binned across time buckets.
- `GET  /api/sessions/{id}/anomalies`: Flagged anomalies with scores, types, and sample messages.
- `GET  /api/sessions/{id}/graph`: Directed causality graph (nodes and edges with weights & lag).
- `GET  /api/sessions/{id}/incident`: LLM root cause analysis report.
- `POST /api/sessions/{id}/chat`: Natural language questions answered by Gemma.
- `GET  /api/sessions/{id}/logs`: Filtered, paginated unified canonical log records.
- `GET  /api/auth/google/login`: Start Google OAuth login.
- `GET  /api/auth/me`: Return the authenticated Google profile.
- `POST /api/auth/logout`: Revoke the current local session and expire its cookie.
