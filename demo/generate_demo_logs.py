#!/usr/bin/env python3
"""
Generates realistic multi-service demo logs for LogLens.
Simulates normal traffic followed by a cascading failure:
1. Database experiences slow queries & connection pool exhaustion.
2. API Server threads time out waiting for DB connections (Java stack traces).
3. API Gateway starts returning 502/504 Bad Gateway / Gateway Timeouts.
4. Background Auth Worker fails to validate sessions and aborts jobs (JSON logs).
"""

import os
from pathlib import Path
from datetime import datetime, timedelta, timezone

DEMO_DIR = Path(__file__).resolve().parent
LOGS_DIR = DEMO_DIR / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

def generate_demo_logs(start_time: datetime = None) -> dict[str, str]:
    if start_time is None:
        start_time = datetime.now(timezone.utc) - timedelta(minutes=15)

    db_lines = []
    api_lines = []
    gateway_lines = []
    auth_lines = []

    # 10 minutes normal traffic (600 seconds)
    # Then 5 minutes cascading incident (300 seconds)
    total_seconds = 900
    incident_start_sec = 600

    for sec in range(0, total_seconds, 3):
        t = start_time + timedelta(seconds=sec)
        iso_str = t.isoformat()
        log4j_ts = t.strftime("%Y-%m-%d %H:%M:%S,%f")[:-3]
        nginx_ts = t.strftime("%d/%b/%Y:%H:%M:%S +0000")
        db_ts = t.strftime("%Y-%m-%d %H:%M:%S UTC")

        is_incident = sec >= incident_start_sec
        incident_phase = sec - incident_start_sec if is_incident else 0

        # --- 1. Database (PostgreSQL / Key-Value Log) ---
        if not is_incident:
            db_lines.append(f"{db_ts} [1042] [INFO] [backend_db] LOG: checkpoint starting: time")
            db_lines.append(f"{db_ts} [1085] [INFO] [backend_db] LOG: duration: 4.120 ms  statement: SELECT id, status FROM orders WHERE user_id = {1000 + sec % 50}")
        else:
            # Phase 1: DB slow queries & pool saturation
            if incident_phase < 60:
                db_lines.append(f"{db_ts} [1099] [WARN] [backend_db] WARNING: slow query detected: duration: {8500 + incident_phase * 150} ms statement: SELECT * FROM transactions WHERE status = 'PENDING' FOR UPDATE")
            elif incident_phase < 150:
                db_lines.append(f"{db_ts} [1102] [ERROR] [backend_db] ERROR: lock timeout on relation 'orders_pkey' after 15000 ms")
                db_lines.append(f"{db_ts} [1105] [CRITICAL] [backend_db] FATAL: remaining connection slots are reserved for non-replication superuser connections (active: 100/100)")
            else:
                db_lines.append(f"{db_ts} [1120] [CRITICAL] [backend_db] FATAL: terminating connection due to administrator command: query cancel timeout")
                db_lines.append(f"{db_ts} [1122] [ERROR] [backend_db] ERROR: out of shared memory for query buffer pool")

        # --- 2. API Server (Java Log4j with stack traces) ---
        if not is_incident or incident_phase < 20:
            api_lines.append(f"{log4j_ts} [http-nio-8080-exec-{sec % 8 + 1}] INFO com.acme.api.OrderService - Processed order checkout order_id={50000 + sec} status=SUCCESS latency=42ms")
        elif incident_phase < 90:
            api_lines.append(f"{log4j_ts} [http-nio-8080-exec-{sec % 8 + 1}] WARN com.acme.api.db.HikariPool - HikariPool-1 - Connection is not available, request timed out after 5000ms (total=10, active=10, idle=0, waiting=14)")
        else:
            # Severe failure with Java stack trace
            api_lines.append(
                f"{log4j_ts} [http-nio-8080-exec-{sec % 8 + 1}] ERROR com.acme.api.OrderService - Request execution failed: Connection pool exhausted\n"
                f"\tat com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:182)\n"
                f"\tat com.zaxxer.hikari.HikariDataSource.getConnection(HikariDataSource.java:100)\n"
                f"\tat com.acme.api.repository.OrderRepository.findOrder(OrderRepository.java:54)\n"
                f"\tat com.acme.api.OrderService.checkout(OrderService.java:98)\n"
                f"Caused by: java.sql.SQLTransientConnectionException: HikariPool-1 - Connection is not available, request timed out after 30000ms.\n"
                f"\tat com.zaxxer.hikari.pool.HikariPool.createTimeoutException(HikariPool.java:695)\n"
                f"\tat com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:197)"
            )

        # --- 3. API Gateway (Nginx Combined format) ---
        if not is_incident or incident_phase < 40:
            gateway_lines.append(f'10.0.1.{sec % 250 + 1} - - [{nginx_ts}] "POST /api/v1/orders HTTP/1.1" 200 682 "-" "LogLensMobile/2.4"')
            gateway_lines.append(f'10.0.1.{sec % 250 + 2} - - [{nginx_ts}] "GET /api/v1/health HTTP/1.1" 200 24 "-" "Kube-Probe/1.28"')
        elif incident_phase < 120:
            gateway_lines.append(f'10.0.1.{sec % 250 + 1} - - [{nginx_ts}] "POST /api/v1/orders HTTP/1.1" 504 182 "-" "LogLensMobile/2.4" upstream_response_time=30.002')
        else:
            gateway_lines.append(f'10.0.1.{sec % 250 + 1} - - [{nginx_ts}] "POST /api/v1/orders HTTP/1.1" 502 584 "-" "LogLensMobile/2.4" upstream_connect: failed (111: Connection refused)')
            gateway_lines.append(f'10.0.1.{sec % 250 + 3} - - [{nginx_ts}] "GET /api/v1/users/profile HTTP/1.1" 503 240 "-" "Mozilla/5.0"')

        # --- 4. Auth Worker (JSON lines format) ---
        if not is_incident or incident_phase < 60:
            auth_lines.append(f'{{"ts": "{iso_str}", "service": "auth-worker", "level": "INFO", "msg": "Token validation succeeded", "user_id": "usr_{sec}", "latency_ms": 12}}')
        else:
            auth_lines.append(f'{{"ts": "{iso_str}", "service": "auth-worker", "level": "ERROR", "msg": "Failed to verify session token in database: pool timeout", "user_id": "usr_{sec}", "retries": 3, "exception": "TimeoutException"}}')

    files_content = {
        "database.log": "\n".join(db_lines),
        "api-server.log": "\n".join(api_lines),
        "api-gateway.log": "\n".join(gateway_lines),
        "auth-worker.log": "\n".join(auth_lines),
    }

    # Save to disk
    for fname, content in files_content.items():
        with open(LOGS_DIR / fname, "w", encoding="utf-8") as f:
            f.write(content)

    return files_content

if __name__ == "__main__":
    generated = generate_demo_logs()
    print(f"Generated 4 demo log files in {LOGS_DIR}:")
    for fname, content in generated.items():
        print(f" - {fname}: {len(content.splitlines())} lines")
