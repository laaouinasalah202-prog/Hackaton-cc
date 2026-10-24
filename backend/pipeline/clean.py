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

def parse_and_normalize_timestamp(raw_ts: Optional[str]) -> str:
    """
    Parse a timestamp string from any common format to ISO 8601 UTC string.
    If parsing fails or timestamp is missing, return current UTC time.
    """
    if not raw_ts or not str(raw_ts).strip():
        return datetime.now(timezone.utc).isoformat()

    ts_str = str(raw_ts).strip()
    
    # Handle unix epoch (seconds or milliseconds)
    if ts_str.isdigit() or (ts_str.replace(".", "", 1).isdigit() and len(ts_str.split(".")[0]) >= 10):
        try:
            val = float(ts_str)
            if val > 1e11:  # milliseconds
                val = val / 1000.0
            dt = datetime.fromtimestamp(val, tz=timezone.utc)
            return dt.isoformat()
        except Exception:
            pass

    # Handle syslog format (e.g. "Oct 24 10:23:54" without year)
    try:
        dt = date_parser.parse(ts_str, fuzzy=True)
        # If no timezone is set, assume UTC
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()

def mask_noise(message: str) -> str:
    """Mask credentials, tokens, long hex addresses, and repetitive separators."""
    if not message:
        return ""
    msg = BEARER_TOKEN_REGEX.sub("Bearer [MASKED]", message)
    msg = PASSWORD_REGEX.sub(r'\1: [MASKED]', msg)
    msg = HEX_ADDR_REGEX.sub("0x[ADDR]", msg)
    msg = REPEATED_DELIMS_REGEX.sub("-----", msg)
    return msg.strip()
