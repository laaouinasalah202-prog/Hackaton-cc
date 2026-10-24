import re
from typing import List, Dict, Any, Tuple
from drain3 import TemplateMiner
from drain3.template_miner_config import TemplateMinerConfig
from backend.models import LogEntry

# Regexes for pre-masking dynamic entities
UUID_REGEX = re.compile(r'\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b')
IP_REGEX = re.compile(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::\d+)?\b')
HEX_REGEX = re.compile(r'\b0x[0-9a-fA-F]+\b')
# Mask numbers, but preserve numbers right after '->' or 'HTTP/' and 3-digit HTTP status codes (100-599)
NUM_PRE_MASK_REGEX = re.compile(r'(?<!->\s)(?<!->)(?<!HTTP/)(?<!HTTP/\d\.)\b(?![1-5]\d{2}\b)\d+\b')

def pre_mask_message(message: str) -> str:
    """Mask UUIDs, IPs, Hex, and numbers (preserving HTTP status codes & versions) to assist Drain3."""
    if not message:
        return ""
    # Single line for drain template extraction
    first_line = message.split("\n", 1)[0]
    m = UUID_REGEX.sub("<UUID>", first_line)
    m = IP_REGEX.sub("<IP>", m)
    m = HEX_REGEX.sub("<HEX>", m)
    m = NUM_PRE_MASK_REGEX.sub("<NUM>", m)
    return m.strip()

class LogTemplateExtractor:
    """Wrapper around Drain3 TemplateMiner for session log mining."""

    def __init__(self):
        config = TemplateMinerConfig()
        config.drain_sim_th = 0.5
        config.drain_depth = 4
        config.drain_max_children = 100
        self.miner = TemplateMiner(config=config)
        self.template_counts: Dict[str, int] = {}
        self.template_patterns: Dict[str, str] = {}

    def process_entries(self, entries: List[LogEntry]) -> List[LogEntry]:
        """Assign template_id and template_str to each log entry."""
        for entry in entries:
            masked = pre_mask_message(entry.message)
            result = self.miner.add_log_message(masked)
            raw_cluster_id = str(result["cluster_id"])
            template_str = result["template_mined"]

            # Include normalized level in template key so different severities never share a pattern
            level = (entry.level or "INFO").upper()
            template_key = f"{level}:{raw_cluster_id}"

            entry.template_id = template_key
            entry.template_str = template_str

            self.template_counts[template_key] = self.template_counts.get(template_key, 0) + 1
            self.template_patterns[template_key] = template_str

        return entries

    def get_template_catalog(self) -> Dict[str, Dict[str, Any]]:
        """Return summary of all mined templates."""
        return {
            t_id: {
                "template_id": t_id,
                "pattern": self.template_patterns.get(t_id, ""),
                "count": self.template_counts.get(t_id, 0)
            }
            for t_id in self.template_counts
        }
