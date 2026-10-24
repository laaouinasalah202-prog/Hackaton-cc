# ⚙️ LogLens Backend — Architecture & Developer Guide

The **LogLens Backend** is a high-performance Python 3.10+ asynchronous API powered by **FastAPI**, **Drain3**, **scikit-learn**, **Sentence-Transformers**, and Google's **Gemma** open-weight LLM.

## 👥 Authors

- **Achraf Eddiba**
- **Ziad Boualam**
- **Hassan Ahchtar**
- **Salah Laouina**

---

## 🏛️ Architecture Overview

The backend is structured around a non-blocking asynchronous pipeline managed by FastAPI background workers and an in-memory/disk session store.

```text
HTTP Request (POST /api/upload or /api/demo/load)
   │
   ▼
FastAPI Route Handler (main.py)
   │
   ├─► SessionStore: Creates new session (session_store.py)
   │
   └─► BackgroundTasks: run_session_analysis (pipeline/coordinator.py)
            │
            ├─► 1. ingest.py (Multi-line event grouping)
            ├─► 2. clean.py & format_detect.py (PII masking & schema normalization)
            ├─► 3. templates.py (Drain3 structural template mining)
            ├─► 4. embed_cluster.py (Sentence Transformers & HDBSCAN)
            ├─► 5. anomaly.py (Rare templates, Z-score spikes, error jumps)
            ├─► 6. causality.py (Cross-service time-lag burst correlation)
            ├─► 7. llm_analysis.py (Gemma root cause synthesis & anomaly explanations)
            └─► 8. coordinator.py (Timeline buckets generation & disk persistence)
```

---

## 📂 Backend Structure

```text
backend/
├── auth.py                  # Google OAuth 2.0 integration & state token validation
├── config.py                # Configuration loader & environment variables
├── llm_client.py            # Unified LLM provider interface (Google AI Studio, Ollama, Mock)
├── main.py                  # FastAPI route controllers, CORS, and error handlers
├── models.py                # Pydantic data schemas (Canonical log, graph, report)
├── prompts.py               # Prompt templates for Gemma LLM analysis
├── requirements.txt         # Production dependencies
├── session_store.py         # Session management with JSON persistence in backend/storage/
└── pipeline/
    ├── __init__.py
    ├── anomaly.py           # Multi-layered statistical and behavioral anomaly detection
    ├── causality.py         # Directed causality graph construction using time-lag bursts
    ├── clean.py             # Normalization of levels, timestamps, and credential masking
    ├── coordinator.py       # Orchestration of the 8-stage analysis pipeline
    ├── embed_cluster.py     # Template embeddings (all-MiniLM-L6-v2) and HDBSCAN clustering
    ├── format_detect.py     # 4-stage layered format detector (JSON, Regex, LLM, Heuristics)
    ├── ingest.py            # File ingestion and intelligent multi-line boundary detection
    ├── llm_analysis.py      # LLM incident synthesis, anomaly explanations, and LogCopilot
    └── templates.py         # Drain3 online template miner with pre-masking
```

---

## 🔬 Pipeline Components

### 1. `ingest.py`
Groups multi-line log entries (such as Java stack traces, nested JSON, and multiline exception tracebacks) into discrete events based on timestamp regex signatures and known event delimiters.

### 2. `format_detect.py` & `clean.py`
Provides 4-stage fallback detection:
1. **JSON Parser**: Validates and parses structured JSON lines, resolving aliased timestamp and severity keys.
2. **Built-in Regex**: Matches Log4j, Python logging, Nginx Combined access logs, and RFC Syslog.
3. **Gemma Dynamic Regex Discovery**: Prompts Gemma with 20 sample lines to extract named capture groups (`ts`, `level`, `message`). Requires $\ge 90\%$ validation against sample lines and retries up to 2 times. Discovered patterns are cached per source.
4. **Heuristic Fallback**: Extracts timestamps using dateutil fuzzy parsing and searches for log level tokens.
Sensitive tokens, Bearer headers, passwords, and raw hexadecimal addresses (`0x[ADDR]`) are masked prior to mining.

### 3. `templates.py`
Wraps the `drain3` `TemplateMiner` with domain-specific pre-maskers for UUIDs, IPs, Hex values, and numbers to output canonical templates (e.g. `Connection refused after <NUM>ms`).

### 4. `embed_cluster.py`
Extracts unique templates from log entries, generates 384-dimensional dense semantic vectors using `sentence-transformers/all-MiniLM-L6-v2` (or TF-IDF fallback), and clusters them with `HDBSCAN` to associate related error families across different microservices.

### 5. `anomaly.py`
Calculates three distinct anomaly signals:
- **Rare Templates**: Unprecedented or low-frequency templates ($< 2\%$ of total volume).
- **Z-Score Spikes**: Frequency deviations across dynamic time-buckets ($z \ge 3.0$).
- **Error-Rate Jumps**: Inter-bucket error rate jumps $>20\%$.

### 6. `causality.py`
Aggregates errors into 5-second burst windows, computes cross-service precedence lags ($0 < \text{lag} \le 60\text{s}$), calculates net directional confidence, and builds a directed graph of failure propagation.

### 7. `llm_analysis.py` & `llm_client.py`
Sends a curated incident summary to Gemma (`gemma-3-27b-it`) via Google AI Studio API or an OpenAI-compatible endpoint. Generates structured JSON incident reports and answers operator queries in the LogCopilot chat interface. Includes an intelligent offline fallback mock when no API key is provided.

---

## 🛠️ Local Development & Running

### Virtual Environment Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Key environment settings:
- `GEMMA_API_KEY`: Google Generative AI API key (optional; fallback mock used if empty).
- `GEMMA_MODEL`: Target model (default: `gemma-3-27b-it`).
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: Credentials for Google OAuth 2.0.
- `FRONTEND_URL`: URL of the Next.js frontend (default: `http://localhost:3000`).

### Running the API Server

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive OpenAPI Swagger UI is available at:  
`http://localhost:8000/docs`
