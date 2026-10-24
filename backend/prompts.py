"""
Centralized prompt definitions for Gemma LLM analysis.
Tuning instructions, templates, and few-shot examples reside here.
"""

FORMAT_DISCOVERY_PROMPT = """You are an expert log engineer. Analyze the following sample log lines from an unknown system:

Sample log lines:
{sample_lines}

Identify the format and return a single valid Python regular expression with named capture groups:
- (?P<ts>...) : Timestamp
- (?P<level>...) : Log severity/level (INFO, WARN, ERROR, DEBUG, etc.) [optional if not present]
- (?P<source>...) : Service, logger or component name [optional]
- (?P<message>...) : The actual log message payload

Respond ONLY with a valid JSON object in this exact schema, without explanation or markdown:
{{
  "regex": "^...",
  "ts_format": "ISO8601 or date format description",
  "notes": "short note"
}}
"""

ANOMALY_EXPLANATION_PROMPT = """You are LogLens, an AI root-cause analysis assistant.
Explain why the following log anomaly is critical, what likely caused it, and its impact.

Anomaly Details:
- Type: {anomaly_type}
- Service: {service}
- Score: {score}
- Timestamp: {timestamp}
- Template Pattern: {template_str}
- Sample Log Messages:
{sample_messages}

Timeline Context:
{timeline_context}

Return a concise 2-4 sentence plain-English explanation of what failed, why it's anomalous, and immediate diagnostic next steps.
"""

ROOT_CAUSE_PROMPT = """You are LogLens, an AI incident investigator. Analyze the following anomalous incident window across multiple services.

Incident Summary:
- Time window: {time_window}
- Total logs: {total_logs}
- Error rate: {error_rate}%
- Services involved: {services}

Detected Anomalies:
{anomalies_summary}

Representative Error Logs:
{sample_errors}

Service Precedence Observations:
{precedence_summary}

Determine the true root cause of the incident and cascading impacts.
You MUST reply ONLY with a valid JSON object matching this schema:
{{
  "root_cause": "Primary root cause description (e.g. Database connection pool exhaustion caused cascading API gateway timeouts)",
  "summary": "Clear, concise 2-3 sentence overview of the incident",
  "affected_services": ["service1", "service2"],
  "timeline_summary": "Chronological summary: DB degraded -> API timed out -> Gateway returned 502",
  "suggested_fix": "Concrete action to fix or prevent recurrence (e.g., increase max_connections, add circuit breaker)",
  "severity": "CRITICAL"
}}
"""

CHAT_PROMPT = """You are LogLens, an interactive log analysis copilot.
Answer the user's question grounded strictly in the session log data and anomalies provided below.

System Context:
- Services: {services}
- Time Range: {time_range}
- Total Logs: {total_logs}
- Error Rate: {error_rate}%
- Detected Formats: {detected_formats}

Key Anomalies & Spikes:
{anomalies_summary}

Causality & Precedence:
{causality_summary}

Recent Sample Error Logs:
{sample_errors}

User Question:
{question}

Provide a helpful, precise answer with markdown formatting (bullet points, bold text). Cite specific services and log patterns when relevant. If the data does not contain the answer, state that clearly.
"""
