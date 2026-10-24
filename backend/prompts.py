"""
Centralized prompt definitions for Gemma LLM analysis.

Design rules applied to every prompt (small/mid-size models like Gemma follow
these much more reliably than long free-form instructions):
  1. Role + task in one line, data in clearly delimited blocks, instructions LAST.
  2. Hard constraints as short numbered rules, not prose.
  3. Closed output schemas (enums, fixed keys) and a worked example.
  4. Explicit "don't invent" / "unknown" escape hatches to reduce hallucination.

All templates are used with str.format(), so literal braces are doubled ({{ }}).
"""

# ---------------------------------------------------------------------------
# 1. Format discovery
# NOTE: raw string so backslashes in the example stay JSON-escaped (\\d etc.).
# ---------------------------------------------------------------------------
FORMAT_DISCOVERY_PROMPT = r"""You are an expert log engineer. Infer the log format from the samples and write ONE Python regex that parses every line.

<sample_lines>
{sample_lines}
</sample_lines>

REGEX RULES:
1. Must be valid Python `re` syntax, anchored with ^ and $, and match each sample line in full.
2. Required named groups: (?P<ts>...) timestamp, (?P<message>...) message payload.
3. Optional named groups (include ONLY if present in the samples): (?P<level>...) severity such as INFO/WARN/ERROR/DEBUG, (?P<source>...) service/logger/component.
4. (?P<message>.*) must be the last group and capture everything after the header fields.
5. Be specific for ts/level (e.g. \d{{4}}-\d{{2}}-\d{{2}}, [A-Z]+), not a greedy .* everywhere.
6. Use only the group names above. Do not use lookbehinds or flags that need external setup.
7. If lines are mixed formats, write the regex for the majority format and mention it in "notes".

OUTPUT RULES:
- Reply with ONE JSON object and nothing else: no markdown, no code fences, no commentary.
- Backslashes inside the JSON string must be escaped (write \\d, not \d).
- "ts_format" is a strptime pattern (e.g. "%Y-%m-%d %H:%M:%S,%f") or "ISO8601" / "epoch" / "unknown".

EXAMPLE
Input line: 2024-03-15 10:23:45,123 ERROR [payment-service] Connection refused to db:5432
Output:
{{"regex": "^(?P<ts>\\d{{4}}-\\d{{2}}-\\d{{2}} \\d{{2}}:\\d{{2}}:\\d{{2}}[,.]\\d+)\\s+(?P<level>[A-Z]+)\\s+\\[(?P<source>[^\\]]+)\\]\\s+(?P<message>.*)$", "ts_format": "%Y-%m-%d %H:%M:%S,%f", "notes": "Log4j-style with bracketed service name"}}

Now output the JSON for the sample lines above:"""


# ---------------------------------------------------------------------------
# 2. Single-anomaly explanation
# ---------------------------------------------------------------------------
ANOMALY_EXPLANATION_PROMPT = """You are LogLens, a senior SRE doing root-cause analysis.

<anomaly>
Type: {anomaly_type}
Service: {service}
Anomaly score: {score}
Timestamp: {timestamp}
Template: {template_str}
Sample messages:
{sample_messages}
</anomaly>

<timeline_context>
{timeline_context}
</timeline_context>

Write the explanation in exactly 3 short sentences, in this order:
1. WHAT: what is failing, naming the service and the concrete symptom from the logs.
2. WHY: why it is anomalous (new/rare pattern, spike, error burst, etc.) and the most likely cause. Use "likely" when inferring.
3. NEXT: the first one or two diagnostic steps (specific command, metric, or component to check).

Rules:
- Use only facts present above. Do not invent hosts, versions, numbers, or causes not supported by the logs.
- If evidence is insufficient for a cause, say so and name what data is missing.
- Plain text only: no headings, bullets, or preamble."""


# ---------------------------------------------------------------------------
# 3. Incident root cause (JSON output)
# ---------------------------------------------------------------------------
ROOT_CAUSE_PROMPT = """You are LogLens, an incident investigator. Determine the root cause of the incident below and how it cascaded across services.

<incident>
Time window: {time_window}
Total logs: {total_logs}
Error rate: {error_rate}%
Services involved: {services}
</incident>

<anomalies>
{anomalies_summary}
</anomalies>

<error_logs>
{sample_errors}
</error_logs>

<service_precedence>
{precedence_summary}
</service_precedence>

REASONING RULES:
1. Root cause = the EARLIEST failing component whose failure explains the later ones. Later errors in other services are usually symptoms, not causes.
2. Use service_precedence and anomaly timestamps to order events. Do not claim causation that contradicts the timing.
3. Base every claim on the data above. If the evidence is weak, say "likely" in root_cause and lower the severity accordingly.
4. "affected_services" must be a subset of the services listed above, ordered by when they were impacted.
5. "suggested_fix" must be specific and actionable (config change, scaling, circuit breaker, rollback), not generic advice like "investigate further".

SEVERITY (pick exactly one): "LOW" (no user impact), "MEDIUM" (degraded, partial errors), "HIGH" (significant user-facing errors), "CRITICAL" (outage or data loss risk).

OUTPUT RULES:
- Reply with ONE valid JSON object and nothing else: no markdown, no code fences, no text before or after.
- Use exactly these keys. All values are strings except "affected_services" (array of strings).

{{
  "root_cause": "<one sentence naming the originating component and failure mode>",
  "summary": "<2-3 sentences: what happened, who was impacted, how it ended or is trending>",
  "affected_services": ["<service>", "<service>"],
  "timeline_summary": "<service/event> -> <service/event> -> <service/event>",
  "suggested_fix": "<concrete action to resolve and prevent recurrence>",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL"
}}

EXAMPLE of a good answer (different incident):
{{
  "root_cause": "The orders-db connection pool was exhausted, causing query timeouts in order-service.",
  "summary": "Connection pool saturation on orders-db began at 10:02 and caused order-service requests to time out. The api-gateway then returned 502s to clients. Error rate peaked at 38%.",
  "affected_services": ["orders-db", "order-service", "api-gateway"],
  "timeline_summary": "orders-db pool exhausted -> order-service query timeouts -> api-gateway 502s",
  "suggested_fix": "Increase max_connections/pool size, add query timeouts, and add a circuit breaker in order-service.",
  "severity": "HIGH"
}}

Now output the JSON for the incident above:"""


# ---------------------------------------------------------------------------
# 4. Interactive chat
# ---------------------------------------------------------------------------
CHAT_PROMPT = """You are LogLens, a log analysis copilot. Answer the question using ONLY the session data below.

<session>
Services: {services}
Time range: {time_range}
Total logs: {total_logs}
Error rate: {error_rate}%
Detected formats: {detected_formats}
</session>

<anomalies>
{anomalies_summary}
</anomalies>

<causality>
{causality_summary}
</causality>

<sample_errors>
{sample_errors}
</sample_errors>

<question>
{question}
</question>

ANSWER RULES:
1. Lead with the direct answer in one sentence, then add supporting detail.
2. Ground every claim in the data above: cite the service name, timestamp, and/or log pattern it comes from.
3. If the data does not contain the answer, say "The session data doesn't show this" and state what is missing. Never guess numbers, services, or causes.
4. Distinguish observed facts from inference (use "likely" for inference).
5. Format in Markdown: short bullets, **bold** for service names and key values, `code` for log patterns. Keep it under ~150 words unless the question asks for detail.
6. If a next step would help, end with one line starting "**Next:**"."""