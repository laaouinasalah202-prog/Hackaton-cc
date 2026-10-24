import unittest
from backend.pipeline.clean import parse_and_normalize_timestamp
from backend.pipeline.format_detect import KNOWN_REGEXES, parse_with_regex
from backend.pipeline.templates import pre_mask_message, LogTemplateExtractor
from backend.models import LogEntry

class TestPhase0(unittest.TestCase):
    def test_nginx_timestamp_and_parsing(self):
        line = '10.0.1.1 - - [24/Oct/2026:11:26:39 +0000] "POST /api/v1/orders HTTP/1.1" 200 682 "-" "LogLensMobile/2.4"'
        raw_ts = '24/Oct/2026:11:26:39 +0000'
        parsed = parse_and_normalize_timestamp(raw_ts)
        self.assertEqual(parsed, '2026-10-24T11:26:39+00:00')

        match = KNOWN_REGEXES['nginx_combined'].match(line)
        self.assertIsNotNone(match)
        entry = parse_with_regex(match, 'nginx_combined', 'api-gateway')
        self.assertEqual(entry.ts, '2026-10-24T11:26:39+00:00')
        self.assertIn('200', entry.message)
        self.assertEqual(entry.attrs.get('status'), 200)
        self.assertEqual(entry.attrs.get('client_ip'), '10.0.1.1')

    def test_nginx_extra_latency_and_message(self):
        line = '10.0.1.5 - - [24/Oct/2026:11:26:39 +0000] "POST /api/v1/orders HTTP/1.1" 504 182 "-" "LogLensMobile/2.4" upstream_response_time=30.002'
        match = KNOWN_REGEXES['nginx_combined'].match(line)
        self.assertIsNotNone(match)
        entry = parse_with_regex(match, 'nginx_combined', 'api-gateway')
        self.assertIn('504', entry.message)
        self.assertIn('upstream_response_time=30.002', entry.message)
        self.assertEqual(entry.attrs.get('status'), 504)
        self.assertEqual(entry.attrs.get('latency'), 30.002)
        self.assertTrue(entry.attrs.get('high_latency'))

    def test_unparseable_timestamp_returns_none(self):
        self.assertIsNone(parse_and_normalize_timestamp('invalid_date_gibberish'))
        self.assertIsNone(parse_and_normalize_timestamp(''))
        self.assertIsNone(parse_and_normalize_timestamp(None))

    def test_template_preserves_status_codes(self):
        msg200 = 'POST /api/v1/orders HTTP/1.1 -> 200'
        msg504 = 'POST /api/v1/orders HTTP/1.1 -> 504 (upstream_response_time=30.002)'
        
        masked200 = pre_mask_message(msg200)
        masked504 = pre_mask_message(msg504)
        
        self.assertIn('200', masked200)
        self.assertIn('504', masked504)
        
        extractor = LogTemplateExtractor()
        e1 = LogEntry(ts='2026-10-24T11:00:00Z', source='api-gateway', level='INFO', message=msg200)
        e2 = LogEntry(ts='2026-10-24T11:00:01Z', source='api-gateway', level='ERROR', message=msg504)
        
        res = extractor.process_entries([e1, e2])
        self.assertNotEqual(res[0].template_id, res[1].template_id, 'Status 200 and 504 must never share a template!')

if __name__ == '__main__':
    unittest.main()
