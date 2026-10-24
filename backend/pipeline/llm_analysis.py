import json
import logging
import re
from typing import List, Dict, Any, Optional
from backend.models import (
    LogEntry, Anomaly, IncidentReport, CausalityGraph, SessionSummary,
    ChatResponse, IncidentAnalysis, ActionItem
)
from backend import llm_client, config
from backend import prompts

logger = logging.getLogger("llm_analysis")

def generate_anomaly_title(anomaly: Anomaly) -> str:
    """Generate a clean, plain-English one-line title for an anomaly without technical jargon."""
    svc = anomaly.service
    sig = anomaly.template_str or anomaly.explanation or "unusual error pattern"
    sig = re.sub(r'<[^>]+>', '', sig).strip()
    # Clean up common patterns
    if "504" in sig:
        return f"{svc}: Gateway timeouts (504) after upstream connection delays"
    if "502" in sig:
        return f"{svc}: Bad gateway (502) due to connection refusals"
    if "HikariPool" in sig or "pool" in sig.lower():
        return f"{svc}: Connection pool exhausted waiting for database"
    if "terminating connection" in sig.lower() or "cancel timeout" in sig.lower():
        return f"{svc}: Fatal database query cancel timeout"
    if "slow query" in sig.lower():
        return f"{svc}: Unusual slow query execution spike"
    if "Token validation" in sig or "session token" in sig.lower():
        return f"{svc}: Session token validation failures"

    # Generic clean title
    if anomaly.type == "spike":
        return f"{svc}: Unusual error burst ({sig[:50]})"
    elif anomaly.type == "error_jump":
        return f"{svc}: Sudden failure rate jump to 100%"
    return f"{svc}: New error pattern observed ({sig[:50]})"

def narrate_incident(analysis: IncidentAnalysis) -> IncidentAnalysis:
    """
    Feeds computed facts from Phase 1 to Gemma for high-level narration.
    Validates strictly in code: root_cause_service must match candidate list,
    and evidence IDs must exist. On LLM failure or bad JSON, falls back to rule-based story.
    """
    # 1. Format structured facts
    cand_lines = []
    for c in analysis.ranked_candidates:
        cand_lines.append(f"- Service: {c.service} (score: {c.score}, confidence: {c.confidence:.2f}, reports_upstream: {c.reports_upstream_errors}) | Reasons: {'; '.join(c.reasons)}")
    candidates_str = "\n".join(cand_lines) if cand_lines else "None"

    onset_lines = []
    for s, o in analysis.service_onsets.items():
        onset_lines.append(f"- {s} onset at {o.onset_ts or 'N/A'}: severity={o.severity}, symptom='{o.first_symptom}', reports_upstream={o.reports_upstream_errors}, evidence_ids={o.evidence_ids}")
    onsets_str = "\n".join(onset_lines) if onset_lines else "None"

    dep_lines = []
    for d in analysis.dependencies:
        dep_lines.append(f"- {d.source} depends on {d.target} ({d.type}): {d.reason}")
    deps_str = "\n".join(dep_lines) if dep_lines else "No strong dependencies inferred."

    phase_lines = []
    for p in analysis.phases:
        phase_lines.append(f"- [{p.label}] {p.start_ts} to {p.end_ts}: {p.description} (dominant: '{p.dominant_signature}')")
    phases_str = "\n".join(phase_lines) if phase_lines else "None"

    # Sample top 8 evidence lines
    ev_lines = []
    for ev in analysis.evidence[:8]:
        ev_lines.append(f"[E{ev.id}] [{ev.ts}] [{ev.service}] [{ev.level}] {ev.message[:120]}")
    evidence_str = "\n".join(ev_lines) if ev_lines else "None"

    prompt = prompts.STRUCTURED_NARRATION_PROMPT.format(
        ranked_candidates=candidates_str,
        ordered_onsets=onsets_str,
        dependencies=deps_str,
        phases=phases_str,
        evidence_lines=evidence_str,
        top_candidate_service=analysis.root_cause_service,
        propagation_path_example='", "'.join(analysis.propagation_path[:4]) if analysis.propagation_path else "service1"
    )

    try:
        raw_resp = llm_client.generate(prompt, temperature=0.1)
        parsed = llm_client.clean_json_response(raw_resp)

        # Retry once if bad JSON
        if not parsed or not isinstance(parsed, dict) or "headline" not in parsed:
            logger.info("Retrying narration prompt with strict JSON enforcement...")
            retry_prompt = prompt + "\n\nCRITICAL: Return ONLY a valid JSON object matching the requested schema."
            raw_resp = llm_client.generate(retry_prompt, temperature=0.0)
            parsed = llm_client.clean_json_response(raw_resp)

        if parsed and isinstance(parsed, dict):
            # Validate root_cause_service against candidate list
            valid_services = set(c.service for c in analysis.ranked_candidates)
            suggested_rc = parsed.get("root_cause_service", analysis.root_cause_service)
            if suggested_rc not in valid_services:
                logger.warning(f"LLM proposed invalid root cause service '{suggested_rc}'. Discarding and using rule-based.")
                analysis.ai_status = "unavailable"
                analysis.ai_status_reason = f"LLM proposed invalid service '{suggested_rc}' not in facts."
                return analysis

            # Validate evidence IDs used
            valid_ev_ids = set(e.id for e in analysis.evidence)
            raw_ev_used = parsed.get("evidence_ids_used", [])
            valid_ev_used = [eid for eid in raw_ev_used if isinstance(eid, int) and eid in valid_ev_ids]

            # Merge validated narration
            analysis.headline = str(parsed.get("headline", analysis.headline))
            analysis.what_happened = str(parsed.get("what_happened", analysis.what_happened))
            analysis.root_cause_service = suggested_rc
            analysis.root_cause_explanation = str(parsed.get("root_cause_explanation", analysis.root_cause_explanation))

            raw_prop = parsed.get("propagation_path")
            if isinstance(raw_prop, list) and all(isinstance(x, str) for x in raw_prop):
                analysis.propagation_path = raw_prop

            analysis.user_impact = str(parsed.get("user_impact", analysis.user_impact))
            if parsed.get("confidence_note"):
                analysis.confidence_note = str(parsed["confidence_note"])

            raw_actions = parsed.get("suggested_actions")
            if isinstance(raw_actions, list) and raw_actions:
                actions = []
                for a in raw_actions:
                    if isinstance(a, dict) and "action" in a:
                        actions.append(ActionItem(
                            priority=str(a.get("priority", "P2")),
                            action=str(a.get("action", "")),
                            why=str(a.get("why", ""))
                        ))
                if actions:
                    analysis.suggested_actions = actions

            if valid_ev_used:
                analysis.evidence_ids_used = valid_ev_used

            analysis.ai_status = "simulated" if config.LLM_MOCK == "1" else "available"
            analysis.ai_status_reason = None
            return analysis

    except llm_client.LLMUnavailable as e:
        logger.info(f"AI narration unavailable: {e.reason}. Using deterministic rule-based analysis.")
        analysis.ai_status = "unavailable"
        analysis.ai_status_reason = e.reason
    except Exception as e:
        logger.warning(f"Unexpected error in narrate_incident: {e}")
        analysis.ai_status = "unavailable"
        analysis.ai_status_reason = f"Narration parsing error: {e}"

    return analysis

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
    sample_errors: List[LogEntry],
    rule_based_fallback: Optional[Dict[str, Any]] = None
) -> IncidentReport:
    """
    Backwards-compatible wrapper. Uses rule_based_fallback from Phase 1 if LLM fails.
    """
    if rule_based_fallback:
        return IncidentReport(
            root_cause=rule_based_fallback.get("root_cause", "Resource saturation"),
            summary=rule_based_fallback.get("what_happened", "Incident detected"),
            affected_services=rule_based_fallback.get("propagation_path", summary.services),
            timeline_summary="Initial failure propagated downstream across dependencies.",
            suggested_fix="Inspect earliest failing component and review connection pool limits.",
            severity="HIGH"
        )

    # Deterministic default fallback (never pick services[0])
    return IncidentReport(
        root_cause="Cascading service degradation identified by timeline onset analysis",
        summary=f"Detected {len(anomalies)} anomalies across {len(summary.services)} services with an overall error rate of {summary.error_rate * 100:.1f}%.",
        affected_services=summary.services,
        timeline_summary="Failure chain observed propagating to dependent services.",
        suggested_fix="Review service dependencies and connection pool capacity.",
        severity="HIGH"
    )

def answer_nl_query(
    question: str,
    summary: SessionSummary,
    anomalies: List[Anomaly],
    graph: CausalityGraph,
    sample_errors: List[LogEntry],
    analysis: Optional[IncidentAnalysis] = None
) -> ChatResponse:
    """Answers a user natural language query strictly grounded in computed facts."""
    time_window = f"{summary.time_range.get('start', 'N/A')} to {summary.time_range.get('end', 'N/A')}"
    services_str = ", ".join(summary.services) if summary.services else "all"

    # Summaries
    anom_lines = [f"- [{a.type}] in {a.service}: {generate_anomaly_title(a)}" for a in anomalies[:6]]
    anom_summary = "\n".join(anom_lines) if anom_lines else "None"

    causal_lines = [f"- {e.description}" for e in graph.edges[:6]]
    causal_summary = "\n".join(causal_lines) if causal_lines else "No strong cascade graph edges."

    err_lines = [f"[{e.source}] {e.message[:100]}" for e in sample_errors[:6]]
    sample_errs = "\n".join(err_lines) if err_lines else "No error lines"

    formats_str = ", ".join(f"{k}: {v}" for k, v in summary.detected_formats.items())

    # Add Phase 1 deterministic facts if available
    grounded_facts = ""
    if analysis:
        grounded_facts = (
            f"\nDeterministic Computed Facts:\n"
            f"- Computed Root Cause: {analysis.root_cause_service} (confidence: {analysis.confidence:.2f})\n"
            f"- Propagation Path: {' -> '.join(analysis.propagation_path)}\n"
            f"- User Impact: {analysis.user_impact}\n"
        )

    prompt = prompts.CHAT_PROMPT.format(
        services=services_str,
        time_range=time_window,
        total_logs=summary.total_logs,
        error_rate=f"{summary.error_rate * 100:.1f}",
        detected_formats=formats_str or "Standard formats",
        anomalies_summary=anom_summary + grounded_facts,
        causality_summary=causal_summary,
        sample_errors=sample_errs,
        question=question
    )

    try:
        answer = llm_client.generate(prompt, temperature=0.3)
    except llm_client.LLMUnavailable as e:
        if analysis:
            answer = (
                f"**Note:** AI narration is currently offline ({e.reason}).\n\n"
                f"Based on computed deterministic facts:\n"
                f"- **Root Cause:** `{analysis.root_cause_service}` (confidence {int(analysis.confidence * 100)}%)\n"
                f"- **Propagation:** {' → '.join([f'`{s}`' for s in analysis.propagation_path])}\n"
                f"- **Impact:** {analysis.user_impact}\n"
            )
        else:
            answer = f"AI chat assistant is currently unavailable ({e.reason}). Please refer to the computed timeline."

    referenced_services = [s for s in summary.services if s.lower() in question.lower() or s.lower() in answer.lower()]
    referenced_anomalies = [a.id for a in anomalies if a.service in referenced_services]

    return ChatResponse(
        answer=answer,
        referenced_services=referenced_services,
        referenced_anomalies=referenced_anomalies[:5]
    )
