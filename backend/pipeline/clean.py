import re
from datetime import datetime, timezone
from typing import Optional, Tuple
from dateutil import parser as date_parser

LEVEL_KEYWORDS = {
    "FATAL": "CRITICAL",
    "CRITICAL": "CRITICAL",
    "SEVERE": "CRITICAL",
    "PANIC": "CRITICAL",
    "EMERG": "CRITICAL",
    "EMERGENCY": "CRITICAL",
    "ALERT": "CRITICAL",
    "ERROR": "ERROR",
    "ERR": "ERROR",
    "FAIL": "ERROR",
    "FAILED": "ERROR",
    "EXCEPTION": "ERROR",
    "WARN": "WARN",
    "WARNING": "WARN",
    "INFO": "INFO",
    "NOTICE": "INFO",
    "DEBUG": "DEBUG",
    "TRACE": "DEBUG",
    "VERBOSE": "DEBUG",
}

LEVEL_SEARCH_REGEX = re.compile(
    r'\b(CRITICAL|FATAL|SEVERE|EMERGENCY|ERROR|ERR|WARN|WARNING|INFO|DEBUG|TRACE)\b',
    re.IGNORECASE
)

# Masking patterns
BEARER_TOKEN_REGEX = re.compile(r'Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*', re.IGNORECASE)
PASSWORD_REGEX = re.compile(r'(password|passwd|secret|token|api[_-]?key)\s*[:=]\s*["\']?[^\s"\',]+["\']?', re.IGNORECASE)
EMAIL_REGEX = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
HEX_ADDR_REGEX = re.compile(r'\b0x[0-9a-fA-F]{6,16}\b')
REPEATED_DELIMS_REGEX = re.compile(r'[-=]{5,}')

def normalize_level(raw_level: Optional[str], message: str = "") -> str:
    """Normalize raw level or infer from message text if missing."""
    if raw_level:
        cleaned = raw_level.strip().upper()
        if cleaned in LEVEL_KEYWORDS:
            return LEVEL_KEYWORDS[cleaned]
        for k, v in LEVEL_KEYWORDS.items():
            if k in cleaned:
                return v

    # Fallback: infer from message
    match = LEVEL_SEARCH_REGEX.search(message)
    if match:
        word = match.group(1).upper()
        return LEVEL_KEYWORDS.get(word, "INFO")

    return "INFO"

# Explicit strptime formats to test before dateutil
EXPLICIT_TS_FORMATS = [
    "%d/%b/%Y:%H:%M:%S %z",       # nginx combined: 24/Oct/2026:11:26:39 +0000
    "%d/%b/%Y:%H:%M:%S",          # nginx combined without tz
    "%Y-%m-%dT%H:%M:%S%z",        # ISO8601 with tz: 2026-10-24T11:26:39+00:00
    "%Y-%m-%dT%H:%M:%S.%f%z",     # ISO8601 with millis & tz
    "%Y-%m-%dT%H:%M:%S",          # ISO8601 without tz
    "%Y-%m-%dT%H:%M:%S.%f",       # ISO8601 with millis
    "%Y-%m-%d %H:%M:%S,%f",       # Log4j standard: 2026-10-24 11:26:39,123
    "%Y-%m-%d %H:%M:%S.%f",       # Standard with dot millis
    "%Y-%m-%d %H:%M:%S %Z",       # 2026-10-24 11:26:39 UTC
    "%Y-%m-%d %H:%M:%S",          # Standard SQL/plain
]

def parse_and_normalize_timestamp(raw_ts: Optional[str]) -> Optional[str]:
    """
    Parse a timestamp string from any common format to ISO 8601 UTC string.
    Tries explicit strptime formats BEFORE dateutil.
    If parsing fails, returns None (DO NOT fallback to now()).
    """
    if not raw_ts or not str(raw_ts).strip():
        return None

    ts_str = str(raw_ts).strip().strip("[]")
    if not ts_str:
        return None

    # Handle ISO string with trailing 'Z'
    clean_iso = ts_str.replace("Z", "+00:00")

    # 1. Try explicit strptime formats first
    for fmt in EXPLICIT_TS_FORMATS:
        try:
            dt = datetime.strptime(ts_str, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            else:
                dt = dt.astimezone(timezone.utc)
            return dt.isoformat()
        except ValueError:
            pass

    # Try clean_iso for ISO format
    try:
        dt = datetime.fromisoformat(clean_iso)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.isoformat()
    except Exception:
        pass

    # 2. Handle unix epoch (seconds or milliseconds)
    if ts_str.isdigit() or (ts_str.replace(".", "", 1).isdigit() and len(ts_str.split(".")[0]) >= 10):
        try:
            val = float(ts_str)
            if val > 1e11:  # milliseconds
                val = val / 1000.0
            dt = datetime.fromtimestamp(val, tz=timezone.utc)
            return dt.isoformat()
        except Exception:
            pass

    # 3. Handle syslog format without year (e.g. "Oct 24 10:23:54" or "Oct  4 10:23:54")
    current_year = datetime.now(timezone.utc).year
    for syslog_fmt in ("%b %d %H:%M:%S", "%b  %d %H:%M:%S"):
        try:
            dt = datetime.strptime(f"{current_year} {ts_str}", f"%Y {syslog_fmt}")
            dt = dt.replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except ValueError:
            pass

    # 4. Fallback to dateutil parser
    try:
        dt = date_parser.parse(ts_str, fuzzy=True)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.isoformat()
    except Exception:
        # DO NOT fallback to now()
        return None

def mask_noise(message: str) -> str:
    """Mask credentials, tokens, emails, long hex addresses, and repetitive separators."""
    if not message:
        return ""
    msg = BEARER_TOKEN_REGEX.sub("Bearer [MASKED]", message)
    msg = PASSWORD_REGEX.sub(r'\1: [MASKED]', msg)
    msg = EMAIL_REGEX.sub("[EMAIL_REDACTED]", msg)
    msg = HEX_ADDR_REGEX.sub("0x[ADDR]", msg)
    msg = REPEATED_DELIMS_REGEX.sub("-----", msg)
    return msg.strip()
