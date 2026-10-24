import json
import logging
from typing import List, Dict, Any, Optional
from backend.models import Anomaly, IncidentReport, CausalityGraph, SessionSummary, ChatResponse, LogEntry
from backend import llm_client
from backend import prompts

logger = logging.getLogger("llm_analysis")

def explain_anomaly(anomaly: Anomaly, timeline_context: str = "") -> str:
    """Generate a concise plain-English explanation for a single anomaly."""
    sample_msgs = "\n".join(f"- {msg}" for msg in anomaly.sample_messages[:3]) if anomaly.sample_messages else "(No sample messages)"
    
    prompt = prompts.ANOMALY_EXPLANATION_PROMPT.format(
        anomaly_type=anomaly.type,
        service=anomaly.service,
        score=f"{anomaly.score:.2f}",
        timestamp=anomaly.timestamp,
        template_str=anomaly.template_str or "N/A",
        sample_messages=sample_msgs,
        timeline_context=timeline_context or "Normal background volume prior to incident."
    )

    try:
        explanation = llm_client.generate(prompt, temperature=0.2)
        if explanation and len(explanation.strip()) > 10:
            return explanation.strip()
    except Exception as e:
        logger.warning(f"Error in explain_anomaly LLM call: {e}")

    # Fallback explanation
    return anomaly.explanation or "Anomalous pattern detected across the service logs."

def generate_incident_report(
    summary: SessionSummary,
    anomalies: List[Anomaly],
    graph: CausalityGraph,
    sample_errors: List[LogEntry]
) -> IncidentReport:
    """
    Curates a compact summary of anomalies, precedence edges, and error samples,
    then queries Gemma for the root cause report.
    """
    time_window = f"{summary.time_range.get('start', 'N/A')} to {summary.time_range.get('end', 'N/A')}"
    services_str = ", ".join(summary.services) if summary.services else "all services"

    # Compact anomalies summary (top 5)
    anom_lines = []
    for a in anomalies[:5]:
        anom_lines.append(f"- [{a.type.upper()}] in {a.service} (score: {a.score:.2f}) at {a.timestamp}: {a.explanation or a.template_str}")
    anomalies_summary = "\n".join(anom_lines) if anom_lines else "No severe anomalies flagged."

    # Precedence summary from causality graph
    prec_lines = []
    for e in graph.edges[:5]:
        prec_lines.append(f"- {e.description}")
    precedence_summary = "\n".join(prec_lines) if prec_lines else "No distinct service cascades identified."

    # Sample errors (up to 6)
    err_lines = []
    for err in sample_errors[:6]:
        err_lines.append(f"[{err.ts}] [{err.source}] [{err.level}] {err.message[:120]}")
    sample_err_text = "\n".join(err_lines) if err_lines else "(No explicit ERROR logs captured)"

    prompt = prompts.ROOT_CAUSE_PROMPT.format(
        time_window=time_window,
        total_logs=summary.total_logs,
        error_rate=f"{summary.error_rate * 100:.1f}",
        services=services_str,
        anomalies_summary=anomalies_summary,
        sample_errors=sample_err_text,
        precedence_summary=precedence_summary
    )

    # First attempt
    raw_resp = llm_client.generate(prompt, temperature=0.1)
    parsed = llm_client.clean_json_response(raw_resp)

    # Retry once if JSON parsing failed
    if not parsed or not isinstance(parsed, dict) or "root_cause" not in parsed:
        logger.info("Retrying root_cause LLM prompt with strict JSON correction...")
        retry_prompt = prompt + "\n\nCRITICAL: Return ONLY valid raw JSON with keys: root_cause, summary, affected_services, timeline_summary, suggested_fix, severity."
        raw_resp = llm_client.generate(retry_prompt, temperature=0.0)
        parsed = llm_client.clean_json_response(raw_resp)

    if parsed and isinstance(parsed, dict):
        return IncidentReport(
            root_cause=str(parsed.get("root_cause", "Cascading service disruption")),
            summary=str(parsed.get("summary", "Anomalous failure chain identified across services.")),
            affected_services=list(parsed.get("affected_services", summary.services)),
            timeline_summary=str(parsed.get("timeline_summary", "Initial component degradation escalated to dependent services.")),
            suggested_fix=str(parsed.get("suggested_fix", "Check service dependencies and resource configurations.")),
            severity=str(parsed.get("severity", "HIGH")).upper()
        )

    # Heuristic fallback report
    top_service = summary.services[0] if summary.services else "primary service"
    return IncidentReport(
        root_cause=f"High error burst and latency degradation centered in {top_service}",
        summary=f"Detected {len(anomalies)} anomalies across {len(summary.services)} services with an overall error rate of {summary.error_rate * 100:.1f}%.",
        affected_services=summary.services,
        timeline_summary="Initial error spikes observed in the upstream services propagated downstream.",
        suggested_fix="Examine configuration and connection timeouts on affected service instances.",
        severity="HIGH"
    )

def answer_nl_query(
    question: str,
    summary: SessionSummary,
    anomalies: List[Anomaly],
    graph: CausalityGraph,
    sample_errors: List[LogEntry]
) -> ChatResponse:
    """Answers a user natural language query about the log session."""
    time_window = f"{summary.time_range.get('start', 'N/A')} to {summary.time_range.get('end', 'N/A')}"
    services_str = ", ".join(summary.services) if summary.services else "all"

    # Summaries
    anom_lines = [f"- [{a.type}] in {a.service}: {a.explanation or a.template_str}" for a in anomalies[:6]]
    anom_summary = "\n".join(anom_lines) if anom_lines else "None"

    causal_lines = [f"- {e.description}" for e in graph.edges[:6]]
    causal_summary = "\n".join(causal_lines) if causal_lines else "No strong cascade graph edges."

    err_lines = [f"[{e.source}] {e.message[:100]}" for e in sample_errors[:6]]
    sample_errs = "\n".join(err_lines) if err_lines else "No error lines"

    formats_str = ", ".join(f"{k}: {v}" for k, v in summary.detected_formats.items())

    prompt = prompts.CHAT_PROMPT.format(
        services=services_str,
        time_range=time_window,
        total_logs=summary.total_logs,
        error_rate=f"{summary.error_rate * 100:.1f}",
        detected_formats=formats_str or "Standard formats",
        anomalies_summary=anom_summary,
        causality_summary=causal_summary,
        sample_errors=sample_errs,
        question=question
    )

    answer = llm_client.generate(prompt, temperature=0.3)
    
    # Identify referenced services and anomalies
    referenced_services = [s for s in summary.services if s.lower() in question.lower() or s.lower() in answer.lower()]
    referenced_anomalies = [a.id for a in anomalies if a.service in referenced_services]

    return ChatResponse(
        answer=answer,
        referenced_services=referenced_services,
        referenced_anomalies=referenced_anomalies[:5]
    )
