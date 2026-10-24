import sys
sys.path.insert(0, "/home/hassan/temp/hackathon")

from backend.pipeline.coordinator import run_session_analysis
from backend.session_store import store

# Case 1: Logs with 0 errors (all INFO)
info_only = b"""2026-10-24 10:00:00 [main] INFO com.example.App - Heartbeat 1
2026-10-24 10:00:01 [main] INFO com.example.App - Heartbeat 2
2026-10-24 10:00:02 [main] INFO com.example.App - Heartbeat 3
"""

session_id_1 = "test-zero-errors"
print(f"Testing session with zero errors: {session_id_1}...")
run_session_analysis(session_id_1, [("info.log", info_only, "app-service")])
sess1 = store.get(session_id_1)
print(f"Result status: {sess1.summary.status}, total_logs: {sess1.summary.total_logs}, anomalies: {len(sess1.anomalies)}, graph edges: {len(sess1.graph.edges)}")
assert sess1.summary.status == "completed"

# Case 2: Empty log file
session_id_2 = "test-empty-log"
print(f"\nTesting session with empty file: {session_id_2}...")
run_session_analysis(session_id_2, [("empty.log", b"", "empty-service")])
sess2 = store.get(session_id_2)
print(f"Result status: {sess2.summary.status}, message: {sess2.summary.message}")
assert sess2.summary.status == "completed"

# Case 3: Arbitrary plain text with no timestamp
arbitrary_text = b"""Hello world
This is an unformatted random server message
Something happened here
Done.
"""
session_id_3 = "test-arbitrary-text"
print(f"\nTesting arbitrary text: {session_id_3}...")
run_session_analysis(session_id_3, [("raw.txt", arbitrary_text, "raw-service")])
sess3 = store.get(session_id_3)
print(f"Result status: {sess3.summary.status}, total_logs: {sess3.summary.total_logs}")
assert sess3.summary.status == "completed"

print("\n--- ALL EDGE CASES PASSED WITH 0 ERRORS! ---")
