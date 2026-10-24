import re
from typing import List, Tuple

# Timestamp start patterns:
# e.g. 2024-..., [2024-..., Oct 24..., 24/Oct/..., 2024/..., 10-24-..., 127.0.0.1 - - [24/Oct...
TIMESTAMP_START_REGEX = re.compile(
    r'^(?:'
    r'\[?\d{4}[-/]\d{1,2}[-/]\d{1,2}'            # 2024-10-24 or 2024/10/24
    r'|\[?\d{1,2}[-/]\d{1,2}[-/]\d{2,4}'         # 10/24/2024 or 24-10-2024
    r'|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}' # Oct 24
    r'|\d{1,2}/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/\d{4}' # 24/Oct/2024
    r'|\S+ - - \[\d{1,2}/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/\d{4}' # Nginx/Apache standard
    r'|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}'       # ISO 8601
    r')',
    re.IGNORECASE
)

MAX_FILE_BYTES = 50 * 1024 * 1024  # 50MB cap
MAX_LINES_PER_FILE = 50_000        # Safeguard limit for fast MVP processing

def is_event_start(line: str) -> bool:
    """Determine if a stripped line looks like the start of a new log entry."""
    stripped = line.strip()
    if not stripped:
        return False
    # JSON lines start with {
    if stripped.startswith("{"):
        return True
    # Or matches known timestamp start patterns
    if TIMESTAMP_START_REGEX.match(stripped):
        return True
    # Python logging format like "[INFO] 2024-..." or "INFO 2024-..."
    if re.match(r'^(?:\[?(?:DEBUG|INFO|WARN|WARNING|ERROR|CRITICAL|FATAL)\]?)\s+[\d\[]', stripped, re.IGNORECASE):
        return True
    return False

def ingest_file_content(content_bytes: bytes, filename: str, max_lines: int = MAX_LINES_PER_FILE) -> List[str]:
    """
    Ingests raw file bytes, groups multi-line events (e.g. stack traces),
    and returns a list of consolidated raw log strings.
    """
    # Cap size if oversized
    if len(content_bytes) > MAX_FILE_BYTES:
        content_bytes = content_bytes[:MAX_FILE_BYTES]

    text = content_bytes.decode("utf-8", errors="replace")
    raw_lines = text.splitlines()

    events: List[str] = []
    current_event: List[str] = []

    for line in raw_lines:
        if not line.strip():
            continue

        if is_event_start(line):
            if current_event:
                events.append("\n".join(current_event))
                current_event = []
                if len(events) >= max_lines:
                    break
            current_event.append(line)
        else:
            if current_event:
                # Multi-line continuation (e.g. Java stack trace, wrapped JSON, etc.)
                current_event.append(line)
            else:
                # Orphan starting line
                current_event.append(line)

    if current_event and len(events) < max_lines:
        events.append("\n".join(current_event))

    return events
