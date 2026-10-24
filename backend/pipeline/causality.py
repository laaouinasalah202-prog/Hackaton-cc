from typing import List, Dict, Any, Tuple
from collections import defaultdict
import pandas as pd
from backend.models import LogEntry, Anomaly, CausalityGraph, CausalityNode, CausalityEdge

def build_causality_graph(
    entries: List[LogEntry],
    anomalies: List[Anomaly],
    max_lag_seconds: float = 60.0
) -> CausalityGraph:
    """
    Builds a directed causality graph between services.
    Nodes = Services.
    Edge A -> B exists if error spikes/anomalies in service A consistently
    precede error spikes in service B within a lag window (0 < lag <= max_lag_seconds).
    """
    if not entries:
        return CausalityGraph()

    # Identify all services and their error/anomaly counts
    service_errors: Dict[str, int] = defaultdict(int)
    service_anomalies: Dict[str, int] = defaultdict(int)

    for e in entries:
        if e.level in ("ERROR", "CRITICAL"):
            service_errors[e.source] += 1

    for a in anomalies:
        service_anomalies[a.service] += 1

    all_services = sorted(list(set(list(service_errors.keys()) + [e.source for e in entries])))
    if not all_services:
        return CausalityGraph()

    # Build DataFrame of error events
    error_records = []
    for e in entries:
        if e.level in ("ERROR", "CRITICAL"):
            error_records.append({
                "ts": pd.to_datetime(e.ts, utc=True, errors="coerce"),
                "service": e.source
            })

    # Also add anomalies as strong signal points
    for a in anomalies:
        if a.type in ("spike", "error_jump"):
            error_records.append({
                "ts": pd.to_datetime(a.timestamp, utc=True, errors="coerce"),
                "service": a.service
            })

    df = pd.DataFrame(error_records).dropna(subset=["ts"]).sort_values("ts")

    # Time-window aggregation: detect error bursts per service
    # 5-second burst windows
    edges_map: Dict[Tuple[str, str], List[float]] = defaultdict(list)

    if not df.empty:
        df["burst_bucket"] = df["ts"].dt.floor("5s")
        bursts = df.groupby(["burst_bucket", "service"]).size().reset_index(name="count")
        
        # Sort bursts chronologically
        bursts = bursts.sort_values("burst_bucket")
        burst_list = bursts.to_dict("records")

        # Compare pairs of bursts
        for i in range(len(burst_list)):
            b_a = burst_list[i]
            ts_a = b_a["burst_bucket"].timestamp()
            svc_a = b_a["service"]

            for j in range(i + 1, min(i + 30, len(burst_list))):
                b_b = burst_list[j]
                svc_b = b_b["service"]
                if svc_a == svc_b:
                    continue

                ts_b = b_b["burst_bucket"].timestamp()
                lag = ts_b - ts_a

                if 0 < lag <= max_lag_seconds:
                    edges_map[(svc_a, svc_b)].append(lag)

    # Compute graph edges
    edges: List[CausalityEdge] = []
    for (src, tgt), lags in edges_map.items():
        reverse_lags = edges_map.get((tgt, src), [])
        forward_count = len(lags)
        reverse_count = len(reverse_lags)

        # Net directional signal: forward must exceed reverse or be distinct
        if forward_count >= reverse_count and forward_count >= 1:
            avg_lag = sum(lags) / forward_count
            # Confidence score between 0.3 and 0.99
            weight = round(min(0.99, 0.4 + 0.1 * forward_count), 2)
            desc = f"Errors in {src} preceded {tgt} by ~{avg_lag:.1f}s ({forward_count} occurrence(s))"
            edges.append(CausalityEdge(
                source=src,
                target=tgt,
                weight=weight,
                lag_seconds=round(avg_lag, 1),
                description=desc
            ))

    # Construct nodes
    nodes = [
        CausalityNode(
            id=svc,
            name=svc,
            error_count=service_errors.get(svc, 0),
            anomaly_count=service_anomalies.get(svc, 0),
            type="service"
        )
        for svc in all_services
    ]

    return CausalityGraph(nodes=nodes, edges=edges)
