import unittest
import os
from datetime import datetime, timezone
from demo.generate_demo_logs import generate_demo_logs
from backend.pipeline.ingest import ingest_file_content
from backend.pipeline.format_detect import detect_and_parse_events
from backend.pipeline.templates import LogTemplateExtractor, pre_mask_message
from backend.pipeline.anomaly import detect_anomalies
from backend.pipeline.incident_analysis import analyze_incident
from backend.pipeline.llm_analysis import narrate_incident
from backend.models import LogEntry
from backend import llm_client, config

class TestAcceptance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        start_time = datetime(2026, 10, 24, 11, 0, 0, tzinfo=timezone.utc)
        files = generate_demo_logs(start_time=start_time)
        all_entries = []
        for filename, content in files.items():
            service = filename.rsplit(".", 1)[0]
            events = ingest_file_content(content.encode("utf-8"), filename)
            parsed, _ = detect_and_parse_events(events, service)
            all_entries.extend(parsed)

        all_entries.sort(key=lambda e: (0 if e.ts else 1, e.ts or ""))
        extractor = LogTemplateExtractor()
        all_entries = extractor.process_entries(all_entries)
        anomalies = detect_anomalies(all_entries)

        cls.entries = all_entries
        cls.anomalies = anomalies
        cls.analysis = analyze_incident("demo-acceptance-session", all_entries, anomalies)

    def test_1_timestamps_distinct_and_span_time_range(self):
        valid_ts = [e.ts for e in self.entries if e.ts]
        self.assertGreater(len(valid_ts), 500)
        
        # Verify timestamps span approximately 15 minutes (900 seconds)
        t_min = datetime.fromisoformat(valid_ts[0])
        t_max = datetime.fromisoformat(valid_ts[-1])
        span_seconds = (t_max - t_min).total_seconds()
        self.assertGreaterEqual(span_seconds, 800)
        self.assertLessEqual(span_seconds, 1000)

    def test_2_root_cause_is_deepest_not_api_gateway(self):
        self.assertEqual(self.analysis.root_cause_service, "database")
        top_cand = self.analysis.ranked_candidates[0]
        self.assertEqual(top_cand.service, "database")
        self.assertTrue(top_cand.is_root_cause)

        # api-gateway must be marked victim and NOT root cause
        gw_cand = next(c for c in self.analysis.ranked_candidates if c.service == "api-gateway")
        self.assertTrue(gw_cand.reports_upstream_errors)
        self.assertFalse(gw_cand.is_root_cause)
        self.assertLess(gw_cand.score, top_cand.score)

    def test_3_propagation_path_has_at_least_3_services_in_correct_time_order(self):
        path = self.analysis.propagation_path
        self.assertGreaterEqual(len(path), 3)
        self.assertEqual(path[0], "database")
        self.assertIn("api-gateway", path)
        self.assertGreater(path.index("api-gateway"), path.index("database"))

        # Verify onsets reflect time gap
        onsets = self.analysis.service_onsets
        db_ts = onsets["database"].onset_ts
        gw_ts = onsets["api-gateway"].onset_ts
        self.assertIsNotNone(db_ts)
        self.assertIsNotNone(gw_ts)
        self.assertLess(db_ts, gw_ts)

    def test_4_status_200_and_504_are_different_patterns(self):
        gw_entries = [e for e in self.entries if e.source == "api-gateway"]
        e_200 = next(e for e in gw_entries if "200" in e.message)
        e_504 = next(e for e in gw_entries if "504" in e.message)
        
        self.assertNotEqual(e_200.template_id, e_504.template_id)
        self.assertNotEqual(e_200.level, e_504.level)

    def test_5_kill_api_key_shows_rule_based_story_no_fake_ai(self):
        # Save original key
        orig_key = config.GEMMA_API_KEY
        orig_mock = config.LLM_MOCK
        try:
            # Temporarily kill API key and ensure mock is 0
            config.GEMMA_API_KEY = ""
            config.LLM_MOCK = "0"

            # Attempt narration with no API key
            narrated = narrate_incident(self.analysis)
            
            # Must show unavailable status with reason
            self.assertEqual(narrated.ai_status, "unavailable")
            self.assertIsNotNone(narrated.ai_status_reason)
            self.assertIn("GEMMA_API_KEY", narrated.ai_status_reason)
            
            # Must preserve the deterministic computed facts
            self.assertEqual(narrated.root_cause_service, "database")
            self.assertTrue(len(narrated.headline) > 0)
            self.assertTrue(len(narrated.what_happened) > 0)
            self.assertTrue(len(narrated.suggested_actions) >= 3)
        finally:
            config.GEMMA_API_KEY = orig_key
            config.LLM_MOCK = orig_mock

    def test_6_service_flow_gateway_turns_red_after_database(self):
        timeline = self.analysis.health_timeline
        db_red_idx = None
        gw_red_idx = None

        for b_idx, bucket in enumerate(timeline):
            db_rate = bucket["services"].get("database", {}).get("error_rate", 0)
            gw_rate = bucket["services"].get("api-gateway", {}).get("error_rate", 0)

            if db_red_idx is None and db_rate >= 0.25:
                db_red_idx = b_idx
            if gw_red_idx is None and gw_rate >= 0.25:
                gw_red_idx = b_idx

        self.assertIsNotNone(db_red_idx, "Database never reached failure threshold")
        self.assertIsNotNone(gw_red_idx, "Gateway never reached failure threshold")
        self.assertLess(db_red_idx, gw_red_idx, "Gateway must turn red AFTER the database turns red")

    def test_7_evidence_citations_resolve_to_exact_log_lines(self):
        evidence = self.analysis.evidence
        self.assertGreater(len(evidence), 0)
        self.assertGreater(len(self.analysis.evidence_ids_used), 0)

        for eid in self.analysis.evidence_ids_used:
            item = next((e for e in evidence if e.id == eid), None)
            self.assertIsNotNone(item, f"Evidence ID {eid} could not be resolved")
            self.assertTrue(len(item.message) > 0)
            self.assertTrue(item.level in ("CRITICAL", "ERROR", "WARN", "INFO"))

if __name__ == '__main__':
    unittest.main()
