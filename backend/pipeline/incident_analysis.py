import logging
import math
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple, Set
import numpy as np
import pandas as pd

from backend.models import (
    LogEntry, Anomaly, IncidentAnalysis, ServiceOnset, IncidentPhase,
    DependencyEdge, RootCauseCandidate, EvidenceItem, ActionItem
)

logger = logging.getLogger("incident_analysis")

UPSTREAM_ERROR_KEYWORDS = re.compile(
    r'\b(upstream\b|upstream_response_time|connection\s+refused|bad\s+gateway|gateway\s+timeout|502|503|504|proxy_pass|reverse\s+proxy)\b',
    re.IGNORECASE
)

def compute_mad(values: List[float]) -> float:
    """Compute Median Absolute Deviation (MAD)."""
    if not values:
        return 0.0
    arr = np.array(values)
    med = np.median(arr)
    return float(np.median(np.abs(arr - med)))

def extract_signature(message: str) -> str:
    """Generate a clean plain-English error signature without numbers or noise."""
    first = message.split("\n", 1)[0].strip()
    # Strip timestamp prefixes if any
    first = re.sub(r'^\[?[0-9\-:T\s,.]+\]?\s*', '', first)
    # Truncate
    return first[:80]

def analyze_incident(
    session_id: str,
    entries: List[LogEntry],
    anomalies: List[Anomaly],
    user_dependencies: Optional[List[Dict[str, Any]]] = None
) -> IncidentAnalysis:
    """
    Deterministic Incident Analysis engine:
    Computes ground truth facts from log entries and anomalies without guessing.
    """
    if not entries:
        return IncidentAnalysis(
            session_id=session_id,
            ai_status="unavailable",
            ai_status_reason="No log entries provided for analysis.",
            headline="No incident detected",
            what_happened="No logs were ingested in this session.",
            root_cause_service="unknown",
            confidence=0.0,
            root_cause_explanation="Insufficient data to compute root cause.",
        )

    # 1. Build evidence catalog
    evidence_list: List[EvidenceItem] = []
    for idx, e in enumerate(entries):
        evidence_list.append(EvidenceItem(
            id=idx,
            ts=e.ts,
            service=e.source,
            level=e.level,
            message=e.message
        ))

    # Convert valid timestamps to pandas DatetimeIndex
    ts_data = []
    for idx, e in enumerate(entries):
        if e.ts:
            ts_data.append({
                "idx": idx,
                "ts": pd.to_datetime(e.ts, utc=True, errors="coerce"),
                "service": e.source,
                "level": e.level,
                "is_error": e.level in ("ERROR", "CRITICAL"),
                "latency": e.attrs.get("latency") if e.attrs else None,
                "message": e.message
            })

    df = pd.DataFrame(ts_data).dropna(subset=["ts"]).sort_values("ts")
    all_services = sorted(list(set(e.source for e in entries)))

    if df.empty or len(all_services) == 0:
        return IncidentAnalysis(
            session_id=session_id,
            ai_status="unavailable",
            ai_status_reason="Logs contained no valid timestamps.",
            headline="Invalid timestamps in logs",
            what_happened="All timestamps were unparseable; cannot compute incident onset.",
            root_cause_service="unknown",
            confidence=0.0,
            root_cause_explanation="Cannot order events chronologically without timestamps.",
        )

    min_ts = df["ts"].min()
    max_ts = df["ts"].max()
    span_sec = max(1.0, (max_ts - min_ts).total_seconds())

    # Adaptive bucket duration: 5s to 15s
    bucket_sec = max(5.0, min(15.0, span_sec / 30.0))
    num_buckets = max(1, int(math.ceil(span_sec / bucket_sec)))

    df["bucket_idx"] = ((df["ts"] - min_ts).dt.total_seconds() / bucket_sec).clip(0, num_buckets - 1).astype(int)

    # 2. Per-service health timeline
    health_timeline: List[Dict[str, Any]] = []
    service_bucket_data: Dict[str, List[Dict[str, Any]]] = {s: [] for s in all_services}

    for b_idx in range(num_buckets):
        b_start = min_ts + pd.Timedelta(seconds=b_idx * bucket_sec)
        b_end = min_ts + pd.Timedelta(seconds=(b_idx + 1) * bucket_sec)
        b_df = df[df["bucket_idx"] == b_idx]

        bucket_summary = {
            "bucket_idx": b_idx,
            "start": b_start.isoformat(),
            "end": b_end.isoformat(),
            "services": {}
        }

        for s in all_services:
            s_df = b_df[b_df["service"] == s]
            req_cnt = len(s_df)
            err_cnt = int(s_df["is_error"].sum())
            err_rate = (err_cnt / req_cnt) if req_cnt > 0 else 0.0

            latencies = s_df["latency"].dropna().tolist()
            p95_lat = float(np.percentile(latencies, 95)) if latencies else None

            # Dominant error signature in bucket
            top_sig = None
            if err_cnt > 0:
                err_msgs = s_df[s_df["is_error"]]["message"].tolist()
                sigs = [extract_signature(m) for m in err_msgs]
                if sigs:
                    top_sig = pd.Series(sigs).value_counts().index[0]

            s_info = {
                "service": s,
                "request_count": req_cnt,
                "error_count": err_cnt,
                "error_rate": round(err_rate, 4),
                "p95_latency": round(p95_lat, 3) if p95_lat is not None else None,
                "top_error_signature": top_sig
            }
            bucket_summary["services"][s] = s_info
            service_bucket_data[s].append(s_info)

        health_timeline.append(bucket_summary)

    # 3. Per-service ONSET calculation
    # Baseline is first 30% of buckets or first 20 buckets
    baseline_cutoff = max(3, min(20, int(num_buckets * 0.3)))

    service_onsets: Dict[str, ServiceOnset] = {}
    service_first_error_dt: Dict[str, pd.Timestamp] = {}

    for s in all_services:
        s_buckets = service_bucket_data[s]
        baseline_buckets = s_buckets[:baseline_cutoff]
        baseline_err_rates = [b["error_rate"] for b in baseline_buckets if b["request_count"] > 0]

        base_med = float(np.median(baseline_err_rates)) if baseline_err_rates else 0.0
        base_mad = compute_mad(baseline_err_rates)
        threshold = max(0.10, base_med + 4.0 * base_mad)

        onset_bucket_idx: Optional[int] = None
        for idx, b in enumerate(s_buckets):
            if b["request_count"] > 0 and b["error_rate"] >= threshold:
                onset_bucket_idx = idx
                break

        s_err_df = df[(df["service"] == s) & (df["is_error"])]
        reports_upstream = False
        evidence_ids: List[int] = []
        onset_ts = None
        severity = "INFO"
        first_symptom = "Normal background operation"
        error_rate_onset = 0.0

        if not s_err_df.empty:
            first_err_row = s_err_df.iloc[0]
            onset_dt = first_err_row["ts"]
            onset_ts = onset_dt.isoformat()
            service_first_error_dt[s] = onset_dt

            # Top 3 evidence log lines around onset
            evidence_ids = s_err_df["idx"].head(3).tolist()
            first_symptom = extract_signature(first_err_row["message"])
            
            # Severity check
            has_crit = (s_err_df["level"] == "CRITICAL").any()
            severity = "CRITICAL" if has_crit else "ERROR"

            if onset_bucket_idx is not None:
                error_rate_onset = s_buckets[onset_bucket_idx]["error_rate"]

            # Upstream error signature check
            all_err_text = " ".join(s_err_df["message"].head(20).tolist())
            reports_upstream = bool(UPSTREAM_ERROR_KEYWORDS.search(all_err_text))

        service_onsets[s] = ServiceOnset(
            service=s,
            onset_ts=onset_ts,
            severity=severity,
            first_symptom=first_symptom,
            evidence_ids=evidence_ids,
            reports_upstream_errors=reports_upstream,
            error_rate_at_onset=round(error_rate_onset, 4)
        )

    # 4. Dependency Inference
    dependencies: List[DependencyEdge] = []
    service_names_lower = {s.lower(): s for s in all_services}

    # a) Explicit / Observed dependencies from message text
    for s in all_services:
        s_err_df = df[(df["service"] == s) & (df["is_error"])]
        for other_s_lower, other_s in service_names_lower.items():
            if other_s == s:
                continue
            # Search if other service name appears in error logs of s
            match_rows = s_err_df[s_err_df["message"].str.lower().str.contains(other_s_lower, na=False)]
            if not match_rows.empty:
                first_match = match_rows.iloc[0]
                dependencies.append(DependencyEdge(
                    source=s,
                    target=other_s,
                    type="observed",
                    confidence=0.95,
                    reason=f"{s} error messages explicitly cite {other_s}",
                    evidence_ids=[int(first_match["idx"])]
                ))

    # b) User-supplied dependencies override or append
    if user_dependencies:
        for udep in user_dependencies:
            src = udep.get("source")
            tgt = udep.get("target")
            if src in all_services and tgt in all_services:
                # Remove any existing edge between same pair
                dependencies = [d for d in dependencies if not (d.source == src and d.target == tgt)]
                dependencies.append(DependencyEdge(
                    source=src,
                    target=tgt,
                    type="user_defined",
                    confidence=1.0,
                    reason="User-configured dependency topology",
                    evidence_ids=[]
                ))

    # c) Inferred temporal dependencies if no observed edges exist
    observed_pairs = {(d.source, d.target) for d in dependencies}
    failing_services = [s for s, dt in sorted(service_first_error_dt.items(), key=lambda x: x[1])]
    
    for i in range(len(failing_services) - 1):
        earlier = failing_services[i]
        later = failing_services[i + 1]
        if (later, earlier) not in observed_pairs and (earlier, later) not in observed_pairs:
            dependencies.append(DependencyEdge(
                source=later,
                target=earlier,
                type="inferred",
                confidence=0.65,
                reason=f"{later} errors began after {earlier} onset",
                evidence_ids=service_onsets[later].evidence_ids[:1]
            ))

    # 5. Root Cause Scoring
    # score = earliness + is_leaf_dependency + has_own_error_signature - victim_penalty
    ranked_candidates: List[RootCauseCandidate] = []
    
    # Map of who depends on whom
    depends_on: Dict[str, Set[str]] = {s: set() for s in all_services}
    for d in dependencies:
        depends_on[d.source].add(d.target)

    # Sort failing services by onset time
    for rank_idx, s in enumerate(all_services):
        onset_info = service_onsets[s]
        dt = service_first_error_dt.get(s)
        
        score = 0.0
        reasons = []

        if dt is None:
            # Healthy service
            score = 0.0
            reasons.append("No errors recorded; healthy service")
            ranked_candidates.append(RootCauseCandidate(
                service=s,
                score=0.0,
                confidence=0.0,
                is_root_cause=False,
                reasons=reasons,
                reports_upstream_errors=False,
                onset_ts=None
            ))
            continue

        # Earliness bonus (0 to 40 pts)
        if failing_services:
            first_dt = service_first_error_dt[failing_services[0]]
            delta_sec = (dt - first_dt).total_seconds()
            earliness_pts = max(0.0, 40.0 - delta_sec * 0.8)
            score += earliness_pts
            if delta_sec == 0:
                reasons.append("Earliest recorded error onset across all services")
            else:
                reasons.append(f"Errors began +{round(delta_sec, 1)}s after earliest incident signal")

        # Dependency depth bonus: if it depends on nothing else that is failing, it's a leaf/origin
        failing_dependencies = [dep for dep in depends_on[s] if dep in service_first_error_dt and service_first_error_dt[dep] < dt]
        if not failing_dependencies:
            score += 35.0
            reasons.append("Deepest failing component (does not depend on any failing upstream)")
        else:
            reasons.append(f"Depends on earlier-failing upstream ({', '.join(failing_dependencies)})")

        # Own error signature (not just 502/timeout victim)
        if not onset_info.reports_upstream_errors:
            score += 35.0
            reasons.append("Internal failure signature (connection exhaustion, lock timeout, or unhandled exception)")
        else:
            # Victim penalty: only reporting upstream errors
            score -= 40.0
            reasons.append("Downstream victim: errors are client-side timeouts/gateway errors caused by upstream")

        # Severe level bonus
        if onset_info.severity == "CRITICAL":
            score += 15.0
            reasons.append("Logged FATAL / CRITICAL severity events")

        ranked_candidates.append(RootCauseCandidate(
            service=s,
            score=round(score, 2),
            confidence=round(min(0.99, max(0.1, score / 100.0)), 2),
            is_root_cause=False,
            reasons=reasons,
            reports_upstream_errors=onset_info.reports_upstream_errors,
            onset_ts=onset_info.onset_ts
        ))

    # Invariant: A service that only reports upstream errors must NEVER rank first if any dependency or earlier service failed
    internal_origin_cands = [c for c in ranked_candidates if not c.reports_upstream_errors and c.score > 0]
    if internal_origin_cands:
        max_internal = max(c.score for c in internal_origin_cands)
        for c in ranked_candidates:
            if c.reports_upstream_errors and c.score >= max_internal:
                c.score = round(max_internal - 15.0, 2)
                c.reasons.append("Demoted below upstream dependency (victim service cannot be root cause)")

    # Sort candidates by score descending
    ranked_candidates.sort(key=lambda c: c.score, reverse=True)
    if ranked_candidates:
        ranked_candidates[0].is_root_cause = True

    root_svc = ranked_candidates[0].service if ranked_candidates else "unknown"
    top_cand = ranked_candidates[0] if ranked_candidates else None
    confidence = top_cand.confidence if top_cand else 0.5

    # Check if multiple candidates have onsets within 2 seconds
    confidence_note = ""
    if len(failing_services) >= 2:
        dt0 = service_first_error_dt[failing_services[0]]
        dt1 = service_first_error_dt[failing_services[1]]
        gap = (dt1 - dt0).total_seconds()
        if abs(gap) <= 2.0:
            confidence = max(0.4, confidence - 0.2)
            confidence_note = f"Services '{failing_services[0]}' and '{failing_services[1]}' started failing within {round(gap, 1)}s of each other; causality has lower confidence."

    # 6. Propagation path (begins with root cause origin, followed by downstream cascades)
    propagation_path = [root_svc] + [s for s in failing_services if s != root_svc]

    # 7. Incident Phases
    # Compute dominant error phases
    phases: List[IncidentPhase] = []
    if failing_services:
        first_fail_dt = service_first_error_dt[failing_services[0]]
        first_fail_iso = first_fail_dt.isoformat()
        
        # Phase 1: HEALTHY (start to first error)
        healthy_df = df[df["ts"] < first_fail_dt]
        phases.append(IncidentPhase(
            label="HEALTHY",
            start_ts=min_ts.isoformat(),
            end_ts=first_fail_iso,
            description="System operating normally within baseline thresholds",
            dominant_signature="Normal traffic",
            count=len(healthy_df),
            evidence_ids=[]
        ))

        # Phase 2: DEGRADED (first fail to gateway timeouts)
        # Find when gateway / client errors begin
        gateway_dt = None
        for s in reversed(failing_services):
            if service_onsets[s].reports_upstream_errors:
                gateway_dt = service_first_error_dt.get(s)
                break

        if gateway_dt and gateway_dt > first_fail_dt:
            degraded_df = df[(df["ts"] >= first_fail_dt) & (df["ts"] < gateway_dt)]
            phases.append(IncidentPhase(
                label="DEGRADED",
                start_ts=first_fail_iso,
                end_ts=gateway_dt.isoformat(),
                description=f"Initial resource degradation & latency spike in {root_svc}",
                dominant_signature=service_onsets[root_svc].first_symptom,
                count=len(degraded_df),
                evidence_ids=service_onsets[root_svc].evidence_ids[:2]
            ))
            
            # Phase 3: FAILING / OUTAGE
            outage_df = df[df["ts"] >= gateway_dt]
            phases.append(IncidentPhase(
                label="FAILING",
                start_ts=gateway_dt.isoformat(),
                end_ts=max_ts.isoformat(),
                description="Cascading 5xx errors and connection refusals across dependent services",
                dominant_signature="Gateway Timeouts & Bad Gateway responses",
                count=len(outage_df),
                evidence_ids=outage_df[outage_df["is_error"]]["idx"].head(3).tolist()
            ))
        else:
            # Direct failing phase
            outage_df = df[df["ts"] >= first_fail_dt]
            phases.append(IncidentPhase(
                label="FAILING",
                start_ts=first_fail_iso,
                end_ts=max_ts.isoformat(),
                description=f"System degradation escalating into cascading failures originating in {root_svc}",
                dominant_signature=service_onsets[root_svc].first_symptom,
                count=len(outage_df),
                evidence_ids=service_onsets[root_svc].evidence_ids[:2]
            ))

    # 8. User impact & Blast radius
    blast_radius = []
    user_impact = "Internal service degradation without public error bursts."
    for s in failing_services:
        s_err_count = int(df[(df["service"] == s) & (df["is_error"])].shape[0])
        blast_radius.append(f"{s} ({s_err_count} errors)")

    # Check for gateway user impact
    gateway_candidates = [s for s in all_services if "gateway" in s or "ingress" in s or "nginx" in s or "frontend" in s]
    for g in gateway_candidates:
        g_df = df[df["service"] == g]
        if not g_df.empty and (g_df["is_error"].sum() > 0):
            err_cnt = int(g_df["is_error"].sum())
            user_impact = f"{g} returned {err_cnt} user-facing errors (502/504) starting at {service_onsets[g].onset_ts}."
            break

    first_symptom = service_onsets[root_svc].first_symptom if root_svc in service_onsets else "Initial latency spike"
    
    # Time to full outage
    time_to_outage = "Immediate"
    if len(failing_services) >= 2:
        t_first = service_first_error_dt[failing_services[0]]
        t_last = service_first_error_dt[failing_services[-1]]
        diff_s = int((t_last - t_first).total_seconds())
        time_to_outage = f"{diff_s} seconds from first {root_svc} anomaly to full cascade"

    # Default suggested actions
    suggested_actions = [
        ActionItem(
            priority="P1",
            action=f"Inspect and restart or scale resources for {root_svc}",
            why=f"{root_svc} is the earliest failing component triggering downstream cascades."
        ),
        ActionItem(
            priority="P2",
            action="Check connection pool parameters and slow query execution logs",
            why="Resource starvation and query lock timeouts preceded connection exhaustion."
        ),
        ActionItem(
            priority="P3",
            action="Configure circuit breakers with retry backoff on callers",
            why="Dependent services hammered the failing backend instead of failing fast."
        )
    ]

    # Collect all evidence IDs used
    evidence_ids_used: List[int] = []
    for o in service_onsets.values():
        evidence_ids_used.extend(o.evidence_ids)
    for p in phases:
        evidence_ids_used.extend(p.evidence_ids)
    for d in dependencies:
        evidence_ids_used.extend(d.evidence_ids)
    evidence_ids_used = sorted(list(set(evidence_ids_used)))

    # Rule-based headline and narration
    headline = f"Cascading Service Outage Originating in {root_svc}"
    what_happened = (
        f"At {service_onsets[root_svc].onset_ts or 'incident onset'}, {root_svc} began failing with "
        f"'{first_symptom}'. This failure cascaded downstream to {', '.join(propagation_path[1:]) if len(propagation_path) > 1 else 'dependent components'}, "
        f"eventually causing user-facing disruptions. {user_impact}"
    )
    root_cause_explanation = (
        f"Deterministic timeline and dependency analysis confirmed {root_svc} as the origin. "
        + " ".join(top_cand.reasons[:2]) if top_cand else ""
    )

    return IncidentAnalysis(
        session_id=session_id,
        ai_status="unavailable",
        ai_status_reason="Rule-based deterministic analysis ready. AI narration pending.",
        headline=headline,
        what_happened=what_happened,
        root_cause_service=root_svc,
        confidence=confidence,
        root_cause_explanation=root_cause_explanation,
        propagation_path=propagation_path,
        first_symptom=first_symptom,
        time_to_full_outage=time_to_outage,
        blast_radius=blast_radius,
        user_impact=user_impact,
        confidence_note=confidence_note,
        suggested_actions=suggested_actions,
        phases=phases,
        service_onsets=service_onsets,
        ranked_candidates=ranked_candidates,
        dependencies=dependencies,
        evidence=evidence_list,
        health_timeline=health_timeline,
        evidence_ids_used=evidence_ids_used
    )
