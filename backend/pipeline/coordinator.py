import asyncio
import logging
import uuid
from typing import List, Tuple, Dict, Any, Optional
from datetime import datetime
import pandas as pd

from backend.models import (
    LogEntry, SessionSummary, Anomaly, CausalityGraph, IncidentReport, TimelineBucket
)
from backend.session_store import store, SessionData
from backend.pipeline.ingest import ingest_file_content
from backend.pipeline.format_detect import detect_and_parse_events
from backend.pipeline.templates import LogTemplateExtractor
from backend.pipeline.embed_cluster import cluster_templates
from backend.pipeline.anomaly import detect_anomalies
from backend.pipeline.causality import build_causality_graph
from backend.pipeline.llm_analysis import generate_incident_report, explain_anomaly

logger = logging.getLogger("coordinator")

def build_timeline_buckets(entries: List[LogEntry], anomalies: List[Anomaly], num_buckets: int = 35) -> List[TimelineBucket]:
    """Divides entries into uniform time buckets for stacked timeline chart and heatmaps."""
    if not entries:
        return []

    data = []
    for e in entries:
        data.append({
            "ts": pd.to_datetime(e.ts, utc=True, errors="coerce"),
            "source": e.source,
            "level": e.level,
            "cluster_id": str(e.cluster_id if e.cluster_id is not None else 0),
        })

    df = pd.DataFrame(data).dropna(subset=["ts"]).sort_values("ts")
    if df.empty:
        return []

    min_time = df["ts"].min()
    max_time = df["ts"].max()
    span_seconds = max(1.0, (max_time - min_time).total_seconds())

    # Anomaly lookup by timestamp
    anom_times = {a.id: pd.to_datetime(a.timestamp, utc=True, errors="coerce") for a in anomalies}

    # Bin entries
    bucket_interval = span_seconds / num_buckets
    df["bucket_idx"] = ((df["ts"] - min_time).dt.total_seconds() / bucket_interval).clip(0, num_buckets - 1).astype(int)

    buckets: List[TimelineBucket] = []
    for b_idx in range(num_buckets):
        b_df = df[df["bucket_idx"] == b_idx]
        b_time = min_time + pd.Timedelta(seconds=b_idx * bucket_interval)
        b_time_end = min_time + pd.Timedelta(seconds=(b_idx + 1) * bucket_interval)

        by_level = b_df["level"].value_counts().to_dict()
        by_service = b_df["source"].value_counts().to_dict()
        by_cluster = b_df["cluster_id"].value_counts().to_dict()

        total = len(b_df)
        err_count = sum(by_level.get(lvl, 0) for lvl in ("ERROR", "CRITICAL"))

        # Find anomalies falling in this bucket window
        bucket_anoms = [
            a_id for a_id, a_ts in anom_times.items()
            if not pd.isna(a_ts) and b_time <= a_ts <= b_time_end
        ]

        buckets.append(TimelineBucket(
            timestamp=b_time.isoformat(),
            total=total,
            error_count=err_count,
            by_level={str(k): int(v) for k, v in by_level.items()},
            by_service={str(k): int(v) for k, v in by_service.items()},
            by_cluster={str(k): int(v) for k, v in by_cluster.items()},
            anomalies=bucket_anoms
        ))

    return buckets

def run_session_analysis(
    session_id: str,
    raw_files: List[Tuple[str, bytes, Optional[str]]]
):
    """
    Background worker that runs the complete 8-stage pipeline:
    1. Ingestion (multi-line grouping)
    2. Format detection & schema normalization
    3. Cleaning & Drain3 template mining
    4. Sentence embedding & HDBSCAN clustering
    5. Anomaly detection (rare, spikes, error jumps)
    6. Causality graph construction
    7. LLM Root cause analysis & anomaly explanations
    8. Timeline bucket generation
    """
    sess = store.get_or_create(session_id)
    summary = sess.summary
    summary.status = "processing"
    summary.progress = 5
    summary.message = "Ingesting files..."

    try:
        all_entries: List[LogEntry] = []
        detected_formats: Dict[str, str] = {}
        services_set = set()

        # Step 1 & 2: Ingest and Format Detection
        for idx, (filename, content_bytes, source_label) in enumerate(raw_files):
            service_name = source_label.strip() if (source_label and source_label.strip()) else filename.rsplit(".", 1)[0]
            services_set.add(service_name)

            events = ingest_file_content(content_bytes, filename)
            parsed_entries, detected_fmt = detect_and_parse_events(events, service_name)
            detected_formats[service_name] = detected_fmt
            all_entries.extend(parsed_entries)

            summary.progress = 5 + int(20 * (idx + 1) / len(raw_files))
            summary.message = f"Parsed {service_name} ({len(parsed_entries)} events, {detected_fmt})."

        if not all_entries:
            summary.status = "completed"
            summary.progress = 100
            summary.message = "No valid log entries found in uploaded files."
            store.save_to_disk(session_id)
            return

        # Sort all entries chronologically
        summary.progress = 30
        summary.message = "Sorting and normalizing timestamps..."
        all_entries.sort(key=lambda e: e.ts)

        # Step 4: Drain3 template mining
        summary.progress = 40
        summary.message = "Mining templates with Drain3..."
        extractor = LogTemplateExtractor()
        all_entries = extractor.process_entries(all_entries)

        # Step 5: Embed & cluster unique templates
        summary.progress = 55
        summary.message = "Embedding templates and clustering..."
        all_entries, _ = cluster_templates(all_entries)

        # Step 6: Anomaly detection
        summary.progress = 70
        summary.message = "Detecting spikes and anomalies..."
        anomalies = detect_anomalies(all_entries)

        # Step 7: Causality graph
        summary.progress = 80
        summary.message = "Building causality directed graph..."
        graph = build_causality_graph(all_entries, anomalies)

        # Calculate session stats
        level_counts: Dict[str, int] = {}
        for e in all_entries:
            level_counts[e.level] = level_counts.get(e.level, 0) + 1

        total_logs = len(all_entries)
        err_count = level_counts.get("ERROR", 0) + level_counts.get("CRITICAL", 0)
        err_rate = (err_count / total_logs) if total_logs > 0 else 0.0

        summary.total_logs = total_logs
        summary.services = sorted(list(services_set))
        summary.detected_formats = detected_formats
        summary.level_counts = level_counts
        summary.error_rate = round(err_rate, 4)
        summary.anomaly_count = len(anomalies)
        summary.time_range = {
            "start": all_entries[0].ts if all_entries else None,
            "end": all_entries[-1].ts if all_entries else None,
        }

        # Step 8: Timeline buckets
        summary.progress = 85
        summary.message = "Generating timeline distribution..."
        timeline = build_timeline_buckets(all_entries, anomalies)

        # Step 9: LLM root cause analysis & incident report
        summary.progress = 90
        summary.message = "Running Gemma AI root cause analysis..."
        error_entries = [e for e in all_entries if e.level in ("ERROR", "CRITICAL")]
        incident_report = generate_incident_report(summary, anomalies, graph, error_entries)

        # Generate explanations for top anomalies
        for a in anomalies[:6]:
            if not a.explanation or "Observed" in a.explanation or "Traffic spike" in a.explanation:
                try:
                    a.explanation = explain_anomaly(a)
                except Exception:
                    pass

        # Commit to session data
        sess.entries = all_entries
        sess.anomalies = anomalies
        sess.graph = graph
        sess.incident_report = incident_report
        sess.timeline = timeline

        summary.status = "completed"
        summary.progress = 100
        summary.message = "Analysis completed successfully."
        store.save_to_disk(session_id)
        logger.info(f"Session {session_id} analysis complete. {total_logs} logs, {len(anomalies)} anomalies.")

    except Exception as e:
        logger.exception(f"Session {session_id} analysis failed: {e}")
        summary.status = "failed"
        summary.message = f"Error during log analysis: {str(e)}"
        store.save_to_disk(session_id)
