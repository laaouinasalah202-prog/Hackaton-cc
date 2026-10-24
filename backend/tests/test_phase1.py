import unittest
from datetime import datetime, timezone, timedelta
from demo.generate_demo_logs import generate_demo_logs
from backend.pipeline.ingest import ingest_file_content
from backend.pipeline.format_detect import detect_and_parse_events
from backend.pipeline.templates import LogTemplateExtractor
from backend.pipeline.anomaly import detect_anomalies
from backend.pipeline.incident_analysis import analyze_incident

class TestPhase1(unittest.TestCase):
    def setUp(self):
        # Generate fresh demo logs with fixed start time
        start_time = datetime(2026, 10, 24, 12, 0, 0, tzinfo=timezone.utc)
        self.files = generate_demo_logs(start_time=start_time)
        
        all_entries = []
        for filename, content in self.files.items():
            service = filename.rsplit(".", 1)[0]
            events = ingest_file_content(content.encode("utf-8"), filename)
            parsed, _ = detect_and_parse_events(events, service)
            all_entries.extend(parsed)

        all_entries.sort(key=lambda e: (0 if e.ts else 1, e.ts or ""))
        extractor = LogTemplateExtractor()
        all_entries = extractor.process_entries(all_entries)
        anomalies = detect_anomalies(all_entries)

        self.entries = all_entries
        self.anomalies = anomalies
        self.analysis = analyze_incident("test-session", all_entries, anomalies)

    def test_root_cause_is_deepest_service(self):
        # Root cause must be database, NOT api-gateway
        self.assertEqual(self.analysis.root_cause_service, "database")
        
        # Database must rank first
        top_cand = self.analysis.ranked_candidates[0]
        self.assertEqual(top_cand.service, "database")
        self.assertTrue(top_cand.is_root_cause)
        self.assertGreater(top_cand.confidence, 0.7)

    def test_api_gateway_is_downstream_victim(self):
        candidates = {c.service: c for c in self.analysis.ranked_candidates}
        gw = candidates.get("api-gateway")
        self.assertIsNotNone(gw)
        
        # api-gateway must have reports_upstream_errors=True
        self.assertTrue(gw.reports_upstream_errors)
        
        # api-gateway must NOT be root cause
        self.assertFalse(gw.is_root_cause)
        
        # api-gateway score must be lower than database
        db = candidates.get("database")
        self.assertGreater(db.score, gw.score)

    def test_propagation_path_order(self):
        path = self.analysis.propagation_path
        self.assertTrue(len(path) >= 3, f"Propagation path too short: {path}")
        self.assertEqual(path[0], "database", "Propagation path must start with database")
        
        # api-gateway must appear after database
        self.assertIn("api-gateway", path)
        db_idx = path.index("database")
        gw_idx = path.index("api-gateway")
        self.assertGreater(gw_idx, db_idx, "api-gateway must appear after database in propagation path")

    def test_evidence_links_exist(self):
        self.assertTrue(len(self.analysis.evidence) > 0)
        self.assertTrue(len(self.analysis.evidence_ids_used) > 0)
        for eid in self.analysis.evidence_ids_used:
            self.assertTrue(0 <= eid < len(self.analysis.evidence))

if __name__ == '__main__':
    unittest.main()
