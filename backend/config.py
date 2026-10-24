import os
from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env if exists
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

GEMMA_API_KEY = os.getenv("GEMMA_API_KEY", "")
GEMMA_MODEL = os.getenv("GEMMA_MODEL", "gemma-3-27b-it")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "")

STORAGE_DIR = BASE_DIR / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
