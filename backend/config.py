import os
from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env if exists
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

GEMMA_API_KEY = os.getenv("GEMMA_API_KEY", "")
GEMMA_MODEL = os.getenv("GEMMA_MODEL", "gemma-4-26b-a4b-it")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "")
LLM_MOCK = os.getenv("LLM_MOCK", "0").strip()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv(
	"GOOGLE_REDIRECT_URI",
	"http://localhost:8000/api/auth/google/callback",
)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
AUTH_SESSION_COOKIE = os.getenv("AUTH_SESSION_COOKIE", "loglens_session")
AUTH_SESSION_MAX_AGE = int(os.getenv("AUTH_SESSION_MAX_AGE", "604800"))
AUTH_COOKIE_SECURE = os.getenv("AUTH_COOKIE_SECURE", "false").lower() == "true"

STORAGE_DIR = BASE_DIR / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
