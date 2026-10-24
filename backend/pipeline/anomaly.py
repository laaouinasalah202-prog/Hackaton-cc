import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import pandas as pd
import numpy as np
from backend.models import LogEntry, Anomaly

def detect_anomalies(
    entries: List[LogEntry],
    bucket_seconds: int = 60
) -> List[Anomaly]:
    """
    Detects 3 types of anomalies:
    1. Rare / new templates: templates appearing very infrequently (or WARN/ERROR).
    2. Spikes per template per time bucket (Z-score analysis).
    3. Error-rate jumps per service across time buckets.
    """
    if not entries:
        return []

    anomalies: List[Anomaly] = []

    # Convert entries to DataFrame for vector/time-series operations
    data = []
    for e in entries:
        data.append({
            "ts": pd.to_datetime(e.ts, utc=True, errors="coerce"),
            "source": e.source,
            "level": e.level,
            "message": e.message,
            "template_id": e.template_id or "unknown",
            "template_str": e.template_str or e.message[:80],
        })

    if not data:
        return []

    df = pd.DataFrame(data)
    if "ts" not in df.columns or df.empty:
        return []

    df = df.dropna(subset=["ts"])
    if df.empty:
        return []

    total_logs = len(df)

    # -------------------------------------------------------------
    # 1. Rare / New Templates
    # -------------------------------------------------------------
    template_counts = df["template_id"].value_counts().to_dict()
    template_samples = df.groupby("template_id")["message"].apply(lambda s: s.head(3).tolist()).to_dict()
    template_levels = df.groupby("template_id")["level"].apply(set).to_dict()
    template_sources = df.groupby("template_id")["source"].first().to_dict()
    template_patterns = df.groupby("template_id")["template_str"].first().to_dict()
    template_first_ts = df.groupby("template_id")["ts"].min().to_dict()

    for t_id, count in template_counts.items():
        freq = count / total_logs
        levels = template_levels.get(t_id, set())
        is_error = bool(levels.intersection({"ERROR", "CRITICAL"}))
        is_warn = bool(levels.intersection({"WARN"}))

        # Flag rare templates (count <= 3 or freq < 0.02, especially if error/warn)
        if (count <= 2 or (freq < 0.02 and total_logs >= 50)) and (is_error or is_warn or count == 1):
            score = 0.9 if is_error else (0.75 if is_warn else 0.5)
            first_time = template_first_ts.get(t_id, df["ts"].min())
            iso_time = first_time.isoformat() if hasattr(first_time, "isoformat") else str(first_time)

            anomalies.append(Anomaly(
                id=f"rare-{t_id}-{uuid.uuid4().hex[:6]}",
                type="rare_template",
                service=template_sources.get(t_id, "unknown"),
                template_id=str(t_id),
                template_str=template_patterns.get(t_id, ""),
                score=score,
                timestamp=iso_time,
                sample_messages=template_samples.get(t_id, []),
                explanation=f"Rare template observed {count} time(s) ({freq:.1%}) with level {', '.join(levels)}."
            ))

    # -------------------------------------------------------------
    # 2. Spikes per template per time bucket (Z-score)
    # -------------------------------------------------------------
    # Determine bucket size dynamically if logs span very short or very long durations
    min_ts = df["ts"].min()
    max_ts = df["ts"].max()
    duration_secs = max(1, (max_ts - min_ts).total_seconds())

    if duration_secs < 120:
        freq_str = "5s"
    elif duration_secs < 1800:
        freq_str = "15s"
    elif duration_secs < 7200:
        freq_str = "1min"
    else:
        freq_str = "5min"

    df["bucket"] = df["ts"].dt.floor(freq_str)
    bucket_counts = df.groupby(["bucket", "template_id"]).size().unstack(fill_value=0)

    for t_id in bucket_counts.columns:
        series = bucket_counts[t_id]
        if len(series) < 3:
            continue
        mean_val = series.mean()
        std_val = series.std()
        if std_val == 0 or np.isnan(std_val):
            continue

        z_scores = (series - mean_val) / std_val
        spikes = z_scores[z_scores >= 2.5]

        for bucket_time, z in spikes.items():
            count_in_bucket = series[bucket_time]
            if count_in_bucket < 3:
                continue

            matching_rows = df[(df["bucket"] == bucket_time) & (df["template_id"] == t_id)]
            sample_msgs = matching_rows["message"].head(3).tolist()
            service = matching_rows["source"].iloc[0] if not matching_rows.empty else "unknown"

            score = min(1.0, 0.6 + float(z) * 0.08)
            iso_time = bucket_time.isoformat() if hasattr(bucket_time, "isoformat") else str(bucket_time)

            anomalies.append(Anomaly(
                id=f"spike-{t_id}-{uuid.uuid4().hex[:6]}",
                type="spike",
                service=service,
                template_id=str(t_id),
                template_str=template_patterns.get(t_id, ""),
                score=round(score, 3),
                timestamp=iso_time,
                sample_messages=sample_msgs,
                explanation=f"Traffic spike of {count_in_bucket} events (z-score: {z:.1f}) in {freq_str} window."
            ))

    # -------------------------------------------------------------
    # 3. Error-rate jumps per service
    # -------------------------------------------------------------
    df["is_error"] = df["level"].isin(["ERROR", "CRITICAL"])
    svc_bucket_total = df.groupby(["bucket", "source"]).size().unstack(fill_value=0)
    svc_bucket_errors = df.groupby(["bucket", "source"])["is_error"].sum().unstack(fill_value=0)

    for svc in svc_bucket_total.columns:
        totals = svc_bucket_total[svc]
        errors = svc_bucket_errors.get(svc, pd.Series(0, index=totals.index))
        rates = (errors / totals.replace(0, 1)).fillna(0.0)

        # Look for sudden jump compared to previous bucket
        prev_rate = 0.0
        for b_time, rate in rates.items():
            diff = rate - prev_rate
            total_errs = errors.get(b_time, 0)
            if diff >= 0.25 and total_errs >= 2:  # 25% jump in error rate
                matching_rows = df[(df["bucket"] == b_time) & (df["source"] == svc) & df["is_error"]]
                sample_msgs = matching_rows["message"].head(3).tolist()
                iso_time = b_time.isoformat() if hasattr(b_time, "isoformat") else str(b_time)

                score = min(1.0, 0.7 + float(diff) * 0.3)
                anomalies.append(Anomaly(
                    id=f"errjump-{svc}-{uuid.uuid4().hex[:6]}",
                    type="error_jump",
                    service=svc,
                    template_id=None,
                    template_str=None,
                    score=round(score, 3),
                    timestamp=iso_time,
                    sample_messages=sample_msgs,
                    explanation=f"Error rate jumped by {diff:.1%} (to {rate:.1%}) in service '{svc}'."
                ))
            prev_rate = rate

    # Sort by score descending
    anomalies.sort(key=lambda a: a.score, reverse=True)
    return anomalies
