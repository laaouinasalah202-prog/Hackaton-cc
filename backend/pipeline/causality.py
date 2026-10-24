from typing import List, Dict, Any, Tuple
from collections import defaultdict
import pandas as pd
from backend.models import LogEntry, Anomaly, CausalityGraph, CausalityNode, CausalityEdge

SEVERITY_ORDER = {
    "CRITICAL": 4,
    "FATAL": 4,
    "PANIC": 4,
    "SEVERE": 4,
    "ERROR": 3,
    "ERR": 3,
    "WARN": 2,
    "WARNING": 2,
    "INFO": 1,
    "DEBUG": 0,
    "TRACE": 0,
}

def get_highest_severity(levels: List[str]) -> str:
    highest = "INFO"
    highest_score = 1
    for lvl in levels:
        score = SEVERITY_ORDER.get(lvl.upper(), 1)
        if score > highest_score:
            highest_score = score
            if score >= 4:
                highest = "CRITICAL"
            elif score == 3:
                highest = "ERROR"
            elif score == 2:
                highest = "WARN"
            else:
                highest = "INFO"
    return highest

def build_causality_graph(
    entries: List[LogEntry],
    anomalies: List[Anomaly],
    max_lag_seconds: float = 60.0
) -> CausalityGraph:
    """
    Builds a detailed two-tier graph:
    1. Log Event Nodes: Each distinct log group/template is a node, colored by severity
       (CRITICAL=red, ERROR=rose, WARN=amber, INFO=cyan/blue), with sample message and count.
       Edges represent chronological sequences between log lines.
    2. Service Nodes: Macro service-level cascade graph.
    """
    if not entries:
        return CausalityGraph()

    # -------------------------------------------------------------
    # 1. Macro Service Nodes & Service Errors
    # -------------------------------------------------------------
    service_errors: Dict[str, int] = defaultdict(int)
    service_anomalies: Dict[str, int] = defaultdict(int)

    for e in entries:
        if e.level in ("ERROR", "CRITICAL"):
            service_errors[e.source] += 1

    for a in anomalies:
        service_anomalies[a.service] += 1

    all_services = sorted(list(set(list(service_errors.keys()) + [e.source for e in entries])))

    service_nodes = [
        CausalityNode(
            id=svc,
            name=svc,
            error_count=service_errors.get(svc, 0),
            anomaly_count=service_anomalies.get(svc, 0),
            type="service",
            service=svc,
            level="ERROR" if service_errors.get(svc, 0) > 0 else "INFO",
            count=sum(1 for e in entries if e.source == svc),
        )
        for svc in all_services
    ]

    # Service-level edges
    service_edges: List[CausalityEdge] = []
    error_records = []
    for e in entries:
        if e.level in ("ERROR", "CRITICAL"):
            error_records.append({
                "ts": pd.to_datetime(e.ts, utc=True, errors="coerce"),
                "service": e.source
            })

    for a in anomalies:
        if a.type in ("spike", "error_jump"):
            error_records.append({
                "ts": pd.to_datetime(a.timestamp, utc=True, errors="coerce"),
                "service": a.service
            })

    if error_records:
        df_err = pd.DataFrame(error_records)
        if "ts" in df_err.columns and not df_err.empty:
            df_err = df_err.dropna(subset=["ts"]).sort_values("ts")
            if not df_err.empty:
                df_err["burst_bucket"] = df_err["ts"].dt.floor("5s")
                bursts = df_err.groupby(["burst_bucket", "service"]).size().reset_index(name="count")
                burst_list = bursts.sort_values("burst_bucket").to_dict("records")

                svc_edges_map: Dict[Tuple[str, str], List[float]] = defaultdict(list)
                for i in range(len(burst_list)):
                    b_a = burst_list[i]
                    ts_a = b_a["burst_bucket"].timestamp()
                    svc_a = b_a["service"]

                    for j in range(i + 1, min(i + 25, len(burst_list))):
                        b_b = burst_list[j]
                        svc_b = b_b["service"]
                        if svc_a == svc_b:
                            continue

                        ts_b = b_b["burst_bucket"].timestamp()
                        lag = ts_b - ts_a
                        if 0 < lag <= max_lag_seconds:
                            svc_edges_map[(svc_a, svc_b)].append(lag)

                for (src, tgt), lags in svc_edges_map.items():
                    rev = svc_edges_map.get((tgt, src), [])
                    if len(lags) >= len(rev) and len(lags) >= 1:
                        avg_lag = sum(lags) / len(lags)
                        weight = round(min(0.99, 0.4 + 0.1 * len(lags)), 2)
                        service_edges.append(CausalityEdge(
                            source=src,
                            target=tgt,
                            weight=weight,
                            lag_seconds=round(avg_lag, 1),
                            description=f"Errors in {src} preceded {tgt} by ~{avg_lag:.1f}s ({len(lags)}x)"
                        ))

    # -------------------------------------------------------------
    # 2. Detailed Log Event / Group Nodes (One line / template per node)
    # -------------------------------------------------------------
    template_groups: Dict[str, Dict[str, Any]] = {}
    for e in entries:
        t_id = e.template_id or "generic"
        group_key = f"{e.source}_t{t_id}"

        if group_key not in template_groups:
            first_line = e.message.split("\n", 1)[0].strip()
            display_name = e.template_str if e.template_str else first_line
            if len(display_name) > 60:
                display_name = display_name[:57] + "..."

            template_groups[group_key] = {
                "id": group_key,
                "name": display_name,
                "service": e.source,
                "levels": [e.level],
                "count": 1,
                "sample_message": e.message,
                "template_str": e.template_str or first_line,
                "first_ts": e.ts,
                "last_ts": e.ts,
                "error_count": 1 if e.level in ("ERROR", "CRITICAL") else 0,
                "timestamps": [e.ts]
            }
        else:
            g = template_groups[group_key]
            g["levels"].append(e.level)
            g["count"] += 1
            g["last_ts"] = e.ts
            if e.level in ("ERROR", "CRITICAL"):
                g["error_count"] += 1
            if len(g["timestamps"]) < 100:
                g["timestamps"].append(e.ts)

    log_event_nodes: List[CausalityNode] = []
    for g_key, g_data in template_groups.items():
        node_level = get_highest_severity(g_data["levels"])
        log_event_nodes.append(CausalityNode(
            id=g_data["id"],
            name=g_data["name"],
            service=g_data["service"],
            level=node_level,
            count=g_data["count"],
            error_count=g_data["error_count"],
            sample_message=g_data["sample_message"],
            template_str=g_data["template_str"],
            first_ts=g_data["first_ts"],
            last_ts=g_data["last_ts"],
            type="log_event"
        ))

    log_event_nodes.sort(
        key=lambda n: (SEVERITY_ORDER.get(n.level, 0), n.count),
        reverse=True
    )

    # -------------------------------------------------------------
    # 3. Directed Edges Between Log Event Nodes
    # -------------------------------------------------------------
    log_edges_map: Dict[Tuple[str, str], List[float]] = defaultdict(list)

    seq_records = []
    for e in entries:
        t_id = e.template_id or "generic"
        g_key = f"{e.source}_t{t_id}"
        seq_records.append({
            "key": g_key,
            "ts": pd.to_datetime(e.ts, utc=True, errors="coerce")
        })

    df_seq = pd.DataFrame(seq_records).dropna(subset=["ts"]).sort_values("ts")
    if not df_seq.empty:
        records_list = df_seq.to_dict("records")
        for i in range(len(records_list)):
            r_a = records_list[i]
            k_a = r_a["key"]
            t_a = r_a["ts"].timestamp()

            for j in range(i + 1, min(i + 15, len(records_list))):
                r_b = records_list[j]
                k_b = r_b["key"]
                if k_a == k_b:
                    continue

                t_b = r_b["ts"].timestamp()
                lag = t_b - t_a
                if 0.05 <= lag <= 30.0:
                    log_edges_map[(k_a, k_b)].append(lag)

    log_edges: List[CausalityEdge] = []
    for (src_k, tgt_k), lags in log_edges_map.items():
        if len(lags) >= 2:
            avg_lag = sum(lags) / len(lags)
            src_node = template_groups.get(src_k)
            tgt_node = template_groups.get(tgt_k)
            src_name = src_node["name"][:30] if src_node else src_k
            tgt_name = tgt_node["name"][:30] if tgt_node else tgt_k

            confidence = round(min(0.98, 0.5 + 0.05 * len(lags)), 2)
            log_edges.append(CausalityEdge(
                source=src_k,
                target=tgt_k,
                weight=confidence,
                lag_seconds=round(avg_lag, 2),
                description=f"[{src_node['service'] if src_node else ''}] '{src_name}' preceded '{tgt_name}' by ~{avg_lag:.1f}s ({len(lags)}x)"
            ))

    log_edges.sort(key=lambda e: (e.weight, -e.lag_seconds), reverse=True)
    log_edges = log_edges[:60]

    return CausalityGraph(
        nodes=log_event_nodes,
        edges=log_edges,
        service_nodes=service_nodes,
        service_edges=service_edges
    )
