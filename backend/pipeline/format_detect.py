import json
import re
from typing import List, Dict, Any, Optional, Tuple, Callable
from dateutil import parser as date_parser
from backend.models import LogEntry
from backend.pipeline.clean import normalize_level, parse_and_normalize_timestamp, mask_noise

# JSON field aliases
TS_ALIASES = ["ts", "timestamp", "@timestamp", "time", "date", "datetime", "logged_at"]
LEVEL_ALIASES = ["level", "severity", "lvl", "log_level", "loglevel", "status"]
MSG_ALIASES = ["message", "msg", "log", "text", "event", "description", "body"]

# Known regex definitions
KNOWN_REGEXES: Dict[str, re.Pattern] = {
    "log4j": re.compile(
        r'^(?P<ts>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[,\.]\d{3})?)\s+\[(?P<thread>[^\]]+)\]\s+(?P<level>[A-Z]+)\s+(?P<logger>[a-zA-Z0-9_\.$]+)\s*-\s*(?P<message>.*)$',
        re.DOTALL
    ),
    "python_logging": re.compile(
        r'^(?P<ts>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[,\.]\d{3})?)\s+-\s+(?P<logger>[a-zA-Z0-9_\.]+)\s+-\s+(?P<level>[A-Z]+)\s+-\s*(?P<message>.*)$',
        re.DOTALL
    ),
    "nginx_combined": re.compile(
        r'^(?P<client_ip>\S+)\s+\S+\s+\S+\s+\[(?P<ts>[^\]]+)\]\s+"(?P<method>[A-Z]+)\s+(?P<path>[^\s]+)\s+(?P<proto>[^"]+)"\s+(?P<status>\d{3})\s+(?P<bytes>\d+|-)(?:\s+"(?P<referrer>[^"]*)")?(?:\s+"(?P<agent>[^"]*)")?(?:\s+(?P<extra>.*))?$',
        re.DOTALL
    ),
    "postgres": re.compile(
        r'^(?P<ts>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[,\.]\d{3})?(?:\s+[A-Z]{3,4})?)\s+\[(?P<pid>\d+)\]\s+\[(?P<level>[A-Z]+)\]\s+(?:\[(?P<module>[^\]]+)\]\s+)?(?P<message>.*)$',
        re.DOTALL
    ),
    "syslog": re.compile(
        r'^(?P<ts>[A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+(?P<host>[a-zA-Z0-9_\-\.]+)\s+(?P<app>[^:\[\s]+)(?:\[(?P<pid>\d+)\])?:\s*(?P<message>.*)$',
        re.DOTALL
    ),
    "bracket_delimited": re.compile(
        r'^\[?(?P<ts>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[,\.]\d{3})?)\]?\s+\[?(?P<level>DEBUG|INFO|WARN|WARNING|ERROR|ERR|FATAL|CRITICAL)\]?\s+(?:\[(?P<module>[^\]]+)\]\s+)?(?P<message>.*)$',
        re.DOTALL | re.IGNORECASE
    ),
}

# In-memory cache for discovered formats: {source_name: detected_format_info}
FORMAT_CACHE: Dict[str, Dict[str, Any]] = {}

def try_parse_json(line: str) -> Optional[Dict[str, Any]]:
    """Try parsing a string as a JSON log object."""
    line = line.strip()
    if not (line.startswith("{") and line.endswith("}")):
        return None
    try:
        data = json.loads(line)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return None

def extract_from_json(data: Dict[str, Any], default_source: str) -> LogEntry:
    """Extract LogEntry fields from a parsed JSON dictionary."""
    ts_val = None
    for alias in TS_ALIASES:
        if alias in data and data[alias] is not None:
            ts_val = str(data[alias])
            break

    level_val = None
    for alias in LEVEL_ALIASES:
        if alias in data and data[alias] is not None:
            level_val = str(data[alias])
            break

    msg_val = None
    for alias in MSG_ALIASES:
        if alias in data and data[alias] is not None:
            msg_val = str(data[alias])
            break

    source_val = data.get("source") or data.get("service") or default_source

    # Collect extra attrs
    extracted_keys = set(TS_ALIASES + LEVEL_ALIASES + MSG_ALIASES + ["source", "service"])
    attrs = {k: v for k, v in data.items() if k not in extracted_keys}

    # Normalize
    if msg_val is None:
        msg_val = json.dumps(data)
    
    clean_msg = mask_noise(msg_val)
    norm_level = normalize_level(level_val, clean_msg)
    norm_ts = parse_and_normalize_timestamp(ts_val)

    return LogEntry(
        ts=norm_ts,
        source=str(source_val),
        level=norm_level,
        message=clean_msg,
        attrs=attrs
    )

def parse_with_regex(match: re.Match, regex_name: str, default_source: str) -> LogEntry:
    """Transform regex named groups into a LogEntry."""
    groups = match.groupdict()
    raw_ts = groups.get("ts")
    raw_level = groups.get("level")
    msg = groups.get("message", "")
    attrs = {}

    if regex_name == "nginx_combined":
        status = groups.get("status", "200")
        method = groups.get("method", "GET")
        path = groups.get("path", "/")
        proto = groups.get("proto", "HTTP/1.1")
        extra = (groups.get("extra") or "").strip()

        msg = f"{method} {path} -> {status}"
        if extra:
            msg = f"{method} {path} -> {status} ({extra})"

        status_num = int(status) if status.isdigit() else 200
        if status_num >= 500:
            raw_level = "ERROR"
        elif status_num >= 400:
            raw_level = "WARN"
        else:
            raw_level = "INFO"

        attrs = {
            "client_ip": groups.get("client_ip"),
            "status": status_num,
            "bytes": groups.get("bytes"),
            "agent": groups.get("agent"),
        }
        if extra:
            attrs["extra"] = extra
            latency_match = re.search(r'(?:upstream_response_time|response_time|rt|latency)[=:]\s*([0-9.]+)', extra, re.IGNORECASE)
            if latency_match:
                try:
                    lat = float(latency_match.group(1))
                    attrs["latency"] = lat
                    if lat > 5.0:
                        attrs["high_latency"] = True
                except ValueError:
                    pass
            elif re.search(r'\b\d+\.\d+\b', extra):
                m_lat = re.search(r'\b(\d+\.\d+)\b', extra)
                if m_lat:
                    try:
                        lat = float(m_lat.group(1))
                        attrs["latency"] = lat
                        if lat > 5.0:
                            attrs["high_latency"] = True
                    except ValueError:
                        pass
    elif regex_name == "syslog":
        app = groups.get("app", default_source)
        host = groups.get("host", "")
        attrs = {"app": app, "host": host, "pid": groups.get("pid")}
        if not raw_level:
            raw_level = normalize_level(None, msg)
    else:
        for k, v in groups.items():
            if k not in ("ts", "level", "message"):
                attrs[k] = v

    clean_msg = mask_noise(msg)
    norm_level = normalize_level(raw_level, clean_msg)
    norm_ts = parse_and_normalize_timestamp(raw_ts)

    return LogEntry(
        ts=norm_ts,
        source=default_source,
        level=norm_level,
        message=clean_msg,
        attrs=attrs
    )

def parse_with_heuristics(line: str, default_source: str) -> LogEntry:
    """
    Fallback heuristic:
    1. Search for a timestamp prefix or pattern.
    2. Search for a log level keyword.
    3. Treat remainder as the message.
    """
    first_line = line.split("\n", 1)[0]
    
    # Try finding timestamp pattern
    ts_match = re.search(
        r'(\d{4}[-/]\d{1,2}[-/]\d{1,2}[ T]\d{2}:\d{2}:\d{2}(?:[\.,]\d{3,6})?(?:Z|[+-]\d{2}:?\d{2})?|'
        r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}|'
        r'\d{1,2}/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/\d{4}:\d{2}:\d{2}:\d{2})',
        first_line
    )
    raw_ts = None
    remainder = line
    if ts_match:
        raw_ts = ts_match.group(1)
        # Remove matched timestamp from message line
        remainder = (line[:ts_match.start()] + line[ts_match.end():]).strip(" -:[]\t")

    # Search for level
    raw_level = None
    level_match = re.search(r'\b(CRITICAL|FATAL|SEVERE|EMERGENCY|ERROR|ERR|WARN|WARNING|INFO|NOTICE|DEBUG|TRACE)\b', remainder, re.IGNORECASE)
    if level_match:
        raw_level = level_match.group(1)
        # Optional: remove level indicator if at start
        remainder = re.sub(r'^[\[\s\-:]*' + re.escape(raw_level) + r'[\]\s\-:]*', '', remainder, flags=re.IGNORECASE).strip()

    clean_msg = mask_noise(remainder if remainder else line)
    norm_level = normalize_level(raw_level, clean_msg)
    norm_ts = parse_and_normalize_timestamp(raw_ts)

    return LogEntry(
        ts=norm_ts,
        source=default_source,
        level=norm_level,
        message=clean_msg,
        attrs={"parser": "heuristics"}
    )

def discover_format_with_gemma(samples: List[str]) -> Optional[str]:
    """
    Sends ~20 sample lines to Gemma, requests regex with named groups
    (?P<ts>...), (?P<level>...), (?P<message>...).
    Validates regex against samples (requires >=90% match), retrying up to 2 times.
    """
    from backend import llm_client, prompts

    sample_lines_str = "\n".join(samples[:20])
    prompt = prompts.FORMAT_DISCOVERY_PROMPT.format(sample_lines=sample_lines_str)

    for attempt in range(2):
        try:
            raw_resp = llm_client.generate(prompt, temperature=0.1)
            parsed = llm_client.clean_json_response(raw_resp)
            if not parsed or not isinstance(parsed, dict) or "regex" not in parsed:
                continue

            regex_str = parsed["regex"]
            test_regex = re.compile(regex_str, re.DOTALL)
            
            # Validate against samples: require >= 90% match
            matches = sum(1 for s in samples if test_regex.match(s.split("\n", 1)[0]))
            match_ratio = matches / max(1, len(samples))
            if match_ratio >= 0.90:
                return regex_str
        except Exception:
            pass

    return None

def detect_and_parse_events(
    events: List[str],
    source_label: str,
    llm_discover_fn: Optional[Callable[[List[str]], Optional[str]]] = None
) -> Tuple[List[LogEntry], str]:
    """
    Layered detection:
    1. JSON lines
    2. Known regexes
    3. LLM format discovery (>=90% match validation, retry up to 2x, cached per source)
    4. Heuristics fallback
    
    Returns (parsed_entries, detected_format_name)
    """
    if not events:
        return [], "empty"

    # Check cache first
    cached_info = FORMAT_CACHE.get(source_label)
    if cached_info:
        if cached_info.get("type") == "json":
            parsed = [
                extract_from_json(d, source_label) if (d := try_parse_json(ev)) is not None
                else parse_with_heuristics(ev, source_label)
                for ev in events
            ]
            return parsed, "json_lines (cached)"
        elif cached_info.get("type") == "regex":
            reg_name = cached_info["name"]
            reg = KNOWN_REGEXES.get(reg_name)
            if reg:
                parsed = [
                    parse_with_regex(m, reg_name, source_label) if (m := reg.match(ev.split("\n", 1)[0]))
                    else parse_with_heuristics(ev, source_label)
                    for ev in events
                ]
                return parsed, f"regex_{reg_name} (cached)"
        elif cached_info.get("type") == "custom_regex":
            custom_reg = re.compile(cached_info["regex"], re.DOTALL)
            parsed = [
                parse_with_regex(m, "custom_llm", source_label) if (m := custom_reg.match(ev.split("\n", 1)[0]))
                else parse_with_heuristics(ev, source_label)
                for ev in events
            ]
            return parsed, "llm_discovered_regex (cached)"

    # Sample up to 20 lines for detection
    sample_size = min(len(events), 20)
    samples = events[:sample_size]

    # a) Test JSON lines
    json_hits = sum(1 for s in samples if try_parse_json(s) is not None)
    if json_hits / sample_size >= 0.7:
        FORMAT_CACHE[source_label] = {"type": "json"}
        parsed = []
        for ev in events:
            d = try_parse_json(ev)
            if d is not None:
                parsed.append(extract_from_json(d, source_label))
            else:
                parsed.append(parse_with_heuristics(ev, source_label))
        return parsed, "json_lines"

    # b) Test Known regexes
    best_regex_name = None
    best_regex_matches = 0
    for name, regex in KNOWN_REGEXES.items():
        matches = sum(1 for s in samples if regex.match(s.split("\n", 1)[0]))
        if matches > best_regex_matches:
            best_regex_matches = matches
            best_regex_name = name

    if best_regex_name and (best_regex_matches / sample_size) >= 0.7:
        FORMAT_CACHE[source_label] = {"type": "regex", "name": best_regex_name}
        target_regex = KNOWN_REGEXES[best_regex_name]
        parsed = []
        for ev in events:
            m = target_regex.match(ev.split("\n", 1)[0])
            if m:
                first_line_parsed = parse_with_regex(m, best_regex_name, source_label)
                if "\n" in ev:
                    first_line_parsed.message += "\n" + ev.split("\n", 1)[1]
                parsed.append(first_line_parsed)
            else:
                parsed.append(parse_with_heuristics(ev, source_label))
        return parsed, f"regex_{best_regex_name}"

    # d) LLM format discovery (send ~20 sample lines to Gemma, require >=90% match, retry up to 2x)
    discover_fn = llm_discover_fn or discover_format_with_gemma
    try:
        custom_regex_str = discover_fn(samples)
        if custom_regex_str:
            custom_regex = re.compile(custom_regex_str, re.DOTALL)
            matches = sum(1 for s in samples if custom_regex.match(s.split("\n", 1)[0]))
            if matches / sample_size >= 0.90:
                FORMAT_CACHE[source_label] = {"type": "custom_regex", "regex": custom_regex_str}
                parsed = []
                for ev in events:
                    m = custom_regex.match(ev.split("\n", 1)[0])
                    if m:
                        first_line_parsed = parse_with_regex(m, "custom_llm", source_label)
                        if "\n" in ev:
                            first_line_parsed.message += "\n" + ev.split("\n", 1)[1]
                        parsed.append(first_line_parsed)
                    else:
                        parsed.append(parse_with_heuristics(ev, source_label))
                return parsed, "llm_discovered_regex"
    except Exception:
        pass

    # c) Fallback: Heuristics
    parsed = [parse_with_heuristics(ev, source_label) for ev in events]
    return parsed, "heuristics"
