import json
import logging
import re
from typing import Optional, Dict, Any
import httpx
from backend import config

logger = logging.getLogger("llm_client")

class LLMUnavailable(Exception):
    """Raised when the LLM service is unavailable, unconfigured, or fails."""
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason

def clean_json_response(raw_text: str) -> Optional[Dict[str, Any]]:
    """
    Safely extract and parse JSON from an LLM response string.
    Strips markdown code fences, thinking tags, and leading/trailing non-json noise.
    """
    if not raw_text:
        return None

    cleaned = raw_text.strip()
    
    # Strip thinking tags like <thought>...</thought> or <thinking>...</thinking>
    cleaned = re.sub(r'<thought>.*?</thought>', '', cleaned, flags=re.DOTALL)
    cleaned = re.sub(r'<thinking>.*?</thinking>', '', cleaned, flags=re.DOTALL)
    
    # Strip markdown code blocks ```json ... ``` or ``` ... ```
    fence_matches = re.findall(r'```(?:json)?\s*([\s\S]*?)\s*```', cleaned, flags=re.IGNORECASE)
    for fence in fence_matches:
        try:
            parsed = json.loads(fence.strip())
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

    # Find the outermost balanced braces
    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")

    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        candidate = cleaned[start_idx:end_idx + 1]
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            # Try basic fixes for trailing commas
            fixed = re.sub(r',\s*([}\]])', r'\1', candidate)
            try:
                parsed = json.loads(fixed)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass

    # Regex search for any valid JSON object within the text
    json_candidates = re.findall(r'\{(?:[^{}]|(?:\{[^{}]*\}))*\}', cleaned)
    for cand in json_candidates:
        try:
            parsed = json.loads(cand)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            try:
                fixed = re.sub(r',\s*([}\]])', r'\1', cand)
                parsed = json.loads(fixed)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    return None

def generate(prompt: str, temperature: float = 0.2) -> str:
    """
    Generate a text completion for `prompt` using Gemma.
    Configured via GEMMA_API_KEY, GEMMA_MODEL, and optional LLM_BASE_URL in backend/.env.
    
    If LLM_MOCK=1 is explicitly set in env, returns simulated response for offline testing.
    Otherwise, on failure raises LLMUnavailable so callers can present truthful rule-based analysis.
    """
    api_key = config.GEMMA_API_KEY.strip()
    model = config.GEMMA_MODEL.strip() or "gemma-4-26b-a4b-it"
    base_url = config.LLM_BASE_URL.strip()
    is_mock = config.LLM_MOCK == "1"

    # Explicit opt-in mock mode
    if is_mock:
        logger.info(f"LLM_MOCK=1 enabled. Returning simulated response for prompt size={len(prompt)} chars")
        return _generate_mock_fallback(prompt)

    # Provider 1: Custom base URL (e.g. Ollama, local vLLM, OpenAI-compatible proxy)
    if base_url:
        logger.info(f"LLM call: provider=custom_base_url, model={model}, prompt_size={len(prompt)} chars, url={base_url}")
        try:
            headers = {"Content-Type": "application/json"}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"

            if "v1" in base_url or "openai" in base_url.lower():
                url = f"{base_url.rstrip('/')}/chat/completions"
                payload = {
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": temperature,
                }
                with httpx.Client(timeout=30.0) as client:
                    resp = client.post(url, json=payload, headers=headers)
                    logger.info(f"LLM call result: status={resp.status_code}")
                    resp.raise_for_status()
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"]
                    logger.info(f"LLM call success: output_size={len(content)} chars")
                    return content
            else:
                # Ollama format
                url = f"{base_url.rstrip('/')}/api/generate"
                payload = {"model": model, "prompt": prompt, "stream": False}
                with httpx.Client(timeout=30.0) as client:
                    resp = client.post(url, json=payload, headers=headers)
                    logger.info(f"LLM call result: status={resp.status_code}")
                    resp.raise_for_status()
                    content = resp.json().get("response", "")
                    logger.info(f"LLM call success: output_size={len(content)} chars")
                    return content
        except Exception as e:
            msg = f"LLM custom endpoint failed ({base_url}): {e}"
            logger.warning(msg)
            raise LLMUnavailable(msg)

    # Provider 2: Google Generative AI API (Gemma endpoint)
    if api_key:
        logger.info(f"LLM call: provider=google_generative_ai, model={model}, prompt_size={len(prompt)} chars")
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            payload = {
                "contents": [
                    {
                        "parts": [{"text": prompt}]
                    }
                ],
                "generationConfig": {
                    "temperature": temperature,
                    "maxOutputTokens": 2500,
                }
            }
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(url, json=payload, headers={"Content-Type": "application/json"})
                logger.info(f"LLM call result: status={resp.status_code}")
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            non_thought_parts = [
                                p.get("text", "") for p in parts if not p.get("thought", False)
                            ]
                            if non_thought_parts:
                                res_text = "".join(non_thought_parts).strip()
                                logger.info(f"LLM call success: output_size={len(res_text)} chars")
                                return res_text
                            text = parts[-1].get("text", "").strip()
                            text = re.sub(r'<thought>.*?</thought>', '', text, flags=re.DOTALL)
                            text = re.sub(r'<thinking>.*?</thinking>', '', text, flags=re.DOTALL)
                            res_text = text.strip()
                            logger.info(f"LLM call success: output_size={len(res_text)} chars")
                            return res_text
                    msg = "Google API returned empty candidates."
                    logger.warning(msg)
                    raise LLMUnavailable(msg)
                else:
                    msg = f"Google API HTTP {resp.status_code}: {resp.text[:120]}"
                    logger.warning(msg)
                    raise LLMUnavailable(msg)
        except LLMUnavailable:
            raise
        except Exception as e:
            msg = f"Google Gemma API request failed: {e}"
            logger.warning(msg)
            raise LLMUnavailable(msg)

    # Missing API key and endpoint
    msg = "GEMMA_API_KEY is not configured in backend/.env"
    logger.info(msg)
    raise LLMUnavailable(msg)

def _generate_mock_fallback(prompt: str) -> str:
    """Intelligent fallback when LLM API key is not present or offline."""
    prompt_lower = prompt.lower()

    if "regex with named capture groups" in prompt_lower or "identify the format" in prompt_lower:
        return json.dumps({
            "regex": r"^\[?(?P<ts>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})\]?\s+(?:\[(?P<level>[A-Z]+)\]\s+)?(?P<message>.*)$",
            "ts_format": "ISO8601",
            "notes": "Standard bracketed timestamp and log level format"
        })

    # Dynamic fallback grounded in the prompt context
    # Extract services from prompt
    services_match = re.search(r"Services(?:\s*involved)?:([^\n]+)", prompt, re.IGNORECASE)
    services_str = services_match.group(1).strip() if services_match else "detected services"
    services = [s.strip() for s in services_str.split(",") if s.strip()]
    top_svc = services[0] if services else "primary service"
    affected = services[:3] if len(services) >= 3 else services

    if "true root cause of the incident" in prompt_lower or "root_cause" in prompt_lower:
        return json.dumps({
            "root_cause": f"Severe error concentration and connection saturation in {top_svc}",
            "summary": f"Service disruption detected originating in {top_svc}, causing cascading errors across {', '.join(affected)}.",
            "affected_services": affected,
            "timeline_summary": f"1) Error burst observed in {top_svc}. 2) Cascading failures propagated to dependent services {', '.join(services[1:3])}.",
            "suggested_fix": f"Check logs and resource utilization for {top_svc}, adjust connection timeouts, and verify dependent endpoints.",
            "severity": "HIGH"
        })

    if "explain why the following log anomaly is critical" in prompt_lower:
        return (
            f"Anomalous error frequency detected in {top_svc}. "
            "This pattern indicates unhandled exceptions or connection starvation impacting request throughput. "
            "Inspect system telemetry and check the recent error logs for this component."
        )

    # Chat query fallback
    return (
        f"Based on the log analysis for **{services_str}**:\n\n"
        f"- **Primary Disruption**: Unusually high error volumes observed originating in `{top_svc}`.\n"
        f"- **Impacted Components**: Cascading failure signals identified across {', '.join([f'`{s}`' for s in affected])}.\n"
        f"- **Recommended Action**: Review recent error traces in `{top_svc}` and verify network/connection limits."
    )
