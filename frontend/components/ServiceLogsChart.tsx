"use client";

import React, { useState, useMemo } from "react";
import { CausalityGraph } from "@/lib/types";
import {
  BarChart2,
  GitCommit,
  Filter,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export type LogSeverity = "CRITICAL" | "ERROR" | "WARN" | "INFO";

export interface LogEntryInput {
  service?: string;
  source?: string;
  level: "INFO" | "WARN" | "ERROR" | "CRITICAL" | string;
  timestamp?: string;
  ts?: string;
  message?: string;
}

export interface ServiceLogsChartProps {
  logs?: LogEntryInput[];
  selectedService: string | null;
  onSelectService: (service: string | null) => void;
  graph?: CausalityGraph | null;
}

interface ServiceBreakdown {
  name: string;
  critical: number;
  error: number;
  warn: number;
  info: number;
  total: number;
  failures: number; // critical + error
}

interface TooltipData {
  service: string;
  level: LogSeverity;
  count: number;
  percent: number;
  x: number;
  y: number;
}

const SEVERITY_CONFIG: Record<
  LogSeverity,
  { label: string; bgClass: string; textClass: string; dotClass: string }
> = {
  CRITICAL: {
    label: "CRITICAL",
    bgClass: "bg-red-950 border border-red-700/80 hover:bg-red-900",
    textClass: "text-red-400",
    dotClass: "bg-red-800",
  },
  ERROR: {
    label: "ERROR",
    bgClass: "bg-rose-600 hover:bg-rose-500",
    textClass: "text-rose-400",
    dotClass: "bg-rose-500",
  },
  WARN: {
    label: "WARN",
    bgClass: "bg-amber-500 hover:bg-amber-400",
    textClass: "text-amber-400",
    dotClass: "bg-amber-500",
  },
  INFO: {
    label: "INFO",
    bgClass: "bg-slate-600 hover:bg-slate-500",
    textClass: "text-slate-400",
    dotClass: "bg-slate-600",
  },
};

export function ServiceLogsChart({
  logs = [],
  selectedService,
  onSelectService,
  graph,
}: ServiceLogsChartProps) {
  const [activeTab, setActiveTab] = useState<"logs" | "cascade">("logs");
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{
    source: string;
    target: string;
    weight: number;
    lag_seconds: number;
    description: string;
  } | null>(null);

  // Normalize and aggregate logs by service and severity
  const { services, summaryText, hasLogs } = useMemo(() => {
    if (!logs || logs.length === 0) {
      return { services: [], summaryText: "", hasLogs: false };
    }

    const map = new Map<string, ServiceBreakdown>();

    for (const log of logs) {
      const serviceName = (log.service || log.source || "unknown").trim();
      const rawLevel = (log.level || "INFO").toUpperCase().trim();

      let normLevel: LogSeverity = "INFO";
      if (
        rawLevel === "CRITICAL" ||
        rawLevel === "FATAL" ||
        rawLevel === "SEVERE" ||
        rawLevel === "PANIC"
      ) {
        normLevel = "CRITICAL";
      } else if (
        rawLevel === "ERROR" ||
        rawLevel === "ERR" ||
        rawLevel === "FAIL" ||
        rawLevel === "FAILED"
      ) {
        normLevel = "ERROR";
      } else if (rawLevel === "WARN" || rawLevel === "WARNING") {
        normLevel = "WARN";
      } else {
        normLevel = "INFO";
      }

      let entry = map.get(serviceName);
      if (!entry) {
        entry = {
          name: serviceName,
          critical: 0,
          error: 0,
          warn: 0,
          info: 0,
          total: 0,
          failures: 0,
        };
        map.set(serviceName, entry);
      }

      if (normLevel === "CRITICAL") entry.critical += 1;
      else if (normLevel === "ERROR") entry.error += 1;
      else if (normLevel === "WARN") entry.warn += 1;
      else entry.info += 1;

      entry.total += 1;
      entry.failures = entry.critical + entry.error;
    }

    // Sort services by (CRITICAL + ERROR) count descending, then total descending
    const sorted = Array.from(map.values()).sort((a, b) => {
      if (b.failures !== a.failures) {
        return b.failures - a.failures;
      }
      return b.total - a.total;
    });

    // Build the summary line
    let summary = "";
    if (sorted.length > 0) {
      const top = sorted[0];
      if (top.failures > 0) {
        summary = `${top.name} has the most failures: ${top.critical} critical, ${top.error} errors out of ${top.total} logs.`;
      } else {
        const totalLogs = sorted.reduce((sum, s) => sum + s.total, 0);
        summary = `All ${sorted.length} services healthy: 0 critical and 0 errors detected across ${totalLogs.toLocaleString()} logs.`;
      }
    }

    return { services: sorted, summaryText: summary, hasLogs: true };
  }, [logs]);

  // Handler for row clicks (toggle)
  const handleRowClick = (serviceName: string) => {
    if (selectedService === serviceName) {
      onSelectService(null);
    } else {
      onSelectService(serviceName);
    }
  };

  // Node layout calculation for the secondary Cascade tab
  const cascadeData = useMemo(() => {
    if (!graph || graph.nodes.length === 0) return null;
    const width = 640;
    const height = 340;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 120;
    const nodeCount = graph.nodes.length;
    const positions: Record<string, { x: number; y: number }> = {};

    graph.nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / nodeCount - Math.PI / 2;
      positions[node.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    return { width, height, positions };
  }, [graph]);

  return (
    <div className="relative rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-sm">
      {/* Header and Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-rose-400" />
            Service Health & Breakdown
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Log severity distribution and unhealthy component ranking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Clear filter button */}
          {selectedService && (
            <button
              onClick={() => onSelectService(null)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors"
            >
              <Filter className="h-3 w-3" />
              <span>Clear filter ({selectedService}) ✕</span>
            </button>
          )}

          {/* View Mode Tabs */}
          {graph && graph.nodes.length > 0 && (
            <div className="flex items-center rounded-lg bg-slate-800/90 p-0.5 border border-slate-700/60 text-xs">
              <button
                onClick={() => setActiveTab("logs")}
                className={`rounded-md px-3 py-1 font-medium transition-colors ${
                  activeTab === "logs"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Logs by Service
              </button>
              <button
                onClick={() => setActiveTab("cascade")}
                className={`flex items-center gap-1 rounded-md px-3 py-1 font-medium transition-colors ${
                  activeTab === "cascade"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <GitCommit className="h-3 w-3 text-cyan-400" />
                <span>Cascade</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Tab: Logs by Service */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          {/* Summary Line */}
          {hasLogs && summaryText && (
            <div className="flex items-center gap-2 rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2 text-xs text-slate-300">
              <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span className="font-medium text-slate-200">{summaryText}</span>
            </div>
          )}

          {/* Color Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3 text-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Severity Legend
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {(["CRITICAL", "ERROR", "WARN", "INFO"] as LogSeverity[]).map(
                (level) => {
                  const cfg = SEVERITY_CONFIG[level];
                  return (
                    <div key={level} className="flex items-center gap-1.5 text-[11px]">
                      <span
                        className={`h-2.5 w-3.5 rounded-sm ${cfg.dotClass}`}
                      />
                      <span className="text-slate-300">{cfg.label}</span>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* Empty State */}
          {!hasLogs ? (
            <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-950/30 text-xs text-slate-500">
              No logs available.
            </div>
          ) : (
            /* Horizontal Stacked Bars */
            <div className="space-y-3.5">
              {services.map((svc) => {
                const isSelected = selectedService === svc.name;
                const isDimmed = selectedService && !isSelected;

                return (
                  <div
                    key={svc.name}
                    onClick={() => handleRowClick(svc.name)}
                    className={`group rounded-lg border p-3 transition-all cursor-pointer ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-950/30 shadow-md ring-1 ring-indigo-500/40"
                        : isDimmed
                        ? "border-slate-800/60 bg-slate-950/30 opacity-40 hover:opacity-75"
                        : "border-slate-800/80 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900"
                    }`}
                  >
                    {/* Top Row: Service Name, Badges, and Total */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-xs font-semibold ${
                            isSelected ? "text-indigo-300 font-bold" : "text-white"
                          }`}
                        >
                          {svc.name}
                        </span>

                        {/* Critical badge (hidden if 0) */}
                        {svc.critical > 0 && (
                          <span className="flex items-center gap-1 rounded bg-red-950/80 px-2 py-0.5 text-[10px] font-semibold text-red-300 border border-red-800/60">
                            <AlertOctagon className="h-3 w-3 text-red-400" />
                            {svc.critical} critical
                          </span>
                        )}

                        {/* Error badge (hidden if 0) */}
                        {svc.error > 0 && (
                          <span className="flex items-center gap-1 rounded bg-rose-950/80 px-2 py-0.5 text-[10px] font-semibold text-rose-300 border border-rose-800/60">
                            <AlertTriangle className="h-3 w-3 text-rose-400" />
                            {svc.error} errors
                          </span>
                        )}

                        {/* Healthy tag if no failures */}
                        {svc.critical === 0 && svc.error === 0 && (
                          <span className="flex items-center gap-1 rounded bg-emerald-950/60 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-800/40">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            healthy
                          </span>
                        )}
                      </div>

                      {/* Total logs label */}
                      <span className="font-mono text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                        {svc.total.toLocaleString()} logs
                      </span>
                    </div>

                    {/* Stacked Horizontal Bar */}
                    <div className="relative flex h-5 w-full overflow-hidden rounded bg-slate-800/70">
                      {(["CRITICAL", "ERROR", "WARN", "INFO"] as LogSeverity[]).map(
                        (level) => {
                          const count =
                            level === "CRITICAL"
                              ? svc.critical
                              : level === "ERROR"
                              ? svc.error
                              : level === "WARN"
                              ? svc.warn
                              : svc.info;

                          if (count === 0) return null;

                          const percent = (count / svc.total) * 100;
                          const cfg = SEVERITY_CONFIG[level];

                          return (
                            <div
                              key={level}
                              style={{ width: `${percent}%` }}
                              className={`h-full transition-all duration-150 ${cfg.bgClass}`}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setTooltip({
                                  service: svc.name,
                                  level,
                                  count,
                                  percent: Math.round(percent * 10) / 10,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top - 8,
                                });
                              }}
                              onMouseLeave={() => setTooltip(null)}
                            />
                          );
                        }
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom helper text */}
          <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Click any service to isolate its errors across the dashboard.</span>
            {selectedService && (
              <span className="text-indigo-400 font-medium">
                Active filter: {selectedService}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Secondary Tab: Cascade (Old directed arrows view) */}
      {activeTab === "cascade" && graph && cascadeData && (
        <div className="space-y-3">
          <div className="relative flex items-center justify-center bg-[#070b13] rounded-lg border border-slate-800/60 p-2 overflow-hidden">
            <svg
              viewBox={`0 0 ${cascadeData.width} ${cascadeData.height}`}
              className="w-full h-80 select-none"
            >
              <defs>
                <marker
                  id="chart-arrowhead"
                  markerWidth="8"
                  markerHeight="6"
                  refX="18"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#06b6d4" />
                </marker>
                <marker
                  id="chart-arrowhead-active"
                  markerWidth="8"
                  markerHeight="6"
                  refX="18"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#f43f5e" />
                </marker>
              </defs>

              {/* Edges */}
              {graph.edges.map((edge, idx) => {
                const src = cascadeData.positions[edge.source];
                const tgt = cascadeData.positions[edge.target];
                if (!src || !tgt) return null;

                const isRelated =
                  !selectedService ||
                  selectedService === edge.source ||
                  selectedService === edge.target;

                const isHovered =
                  hoveredEdge &&
                  hoveredEdge.source === edge.source &&
                  hoveredEdge.target === edge.target;

                const midX = (src.x + tgt.x) / 2;
                const midY = (src.y + tgt.y) / 2;
                const strokeWidth = Math.max(1.5, edge.weight * 3.5);

                return (
                  <g
                    key={`${edge.source}-${edge.target}-${idx}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredEdge(edge)}
                    onMouseLeave={() => setHoveredEdge(null)}
                    opacity={isRelated ? 1 : 0.15}
                  >
                    <line
                      x1={src.x}
                      y1={src.y}
                      x2={tgt.x}
                      y2={tgt.y}
                      stroke={isHovered ? "#f43f5e" : "#06b6d4"}
                      strokeWidth={strokeWidth}
                      strokeDasharray={edge.weight < 0.6 ? "4 4" : undefined}
                      markerEnd={
                        isHovered
                          ? "url(#chart-arrowhead-active)"
                          : "url(#chart-arrowhead)"
                      }
                      className="transition-colors"
                    />
                    <rect
                      x={midX - 22}
                      y={midY - 8}
                      width="44"
                      height="16"
                      rx="4"
                      fill="#0b1324"
                      stroke={isHovered ? "#f43f5e" : "#1e293b"}
                      strokeWidth="1"
                    />
                    <text
                      x={midX}
                      y={midY + 3.5}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      +{edge.lag_seconds}s
                    </text>
                  </g>
                );
              })}

              {/* Nodes */}
              {graph.nodes.map((node) => {
                const pos = cascadeData.positions[node.id];
                if (!pos) return null;

                const isSelected = selectedService === node.id;
                const isDimmed = selectedService && !isSelected;
                const hasErrors = node.error_count > 0;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="cursor-pointer"
                    onClick={() => handleRowClick(node.id)}
                    opacity={isDimmed ? 0.35 : 1}
                  >
                    {hasErrors && (
                      <circle
                        r="24"
                        fill="none"
                        stroke={isSelected ? "#818cf8" : "#f43f5e"}
                        strokeWidth="1.5"
                        opacity="0.4"
                        className="animate-ping"
                      />
                    )}
                    <circle
                      r="20"
                      fill={
                        isSelected
                          ? "#4338ca"
                          : hasErrors
                          ? "#1e1b4b"
                          : "#0f172a"
                      }
                      stroke={
                        isSelected
                          ? "#818cf8"
                          : hasErrors
                          ? "#f43f5e"
                          : "#334155"
                      }
                      strokeWidth={isSelected ? "2.5" : "1.5"}
                      className="transition-all hover:scale-110"
                    />
                    <text
                      textAnchor="middle"
                      dy="-1"
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {node.error_count > 999 ? "999+" : node.error_count}
                    </text>
                    <text
                      textAnchor="middle"
                      dy="32"
                      fill={isSelected ? "#818cf8" : "#e2e8f0"}
                      fontSize="11"
                      fontWeight="600"
                      fontFamily="monospace"
                    >
                      {node.name}
                    </text>
                  </g>
                );
              })}
            </svg>

            {hoveredEdge && (
              <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-slate-900/95 border border-slate-700/80 px-3 py-2 text-xs flex items-center justify-between backdrop-blur-md">
                <span className="text-slate-300 flex items-center gap-2">
                  <span className="font-mono font-bold text-cyan-400">
                    {hoveredEdge.source}
                  </span>
                  <ArrowRight className="h-3 w-3 text-slate-500" />
                  <span className="font-mono font-bold text-rose-400">
                    {hoveredEdge.target}
                  </span>
                  <span className="text-slate-400">
                    ({hoveredEdge.description})
                  </span>
                </span>
                <span className="font-mono text-cyan-400 font-semibold">
                  Weight: {(hoveredEdge.weight * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Hover Tooltip (Requirement 4) */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full rounded-md border border-slate-700 bg-slate-900/95 px-2.5 py-1.5 text-xs text-white shadow-xl backdrop-blur-md"
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
        >
          <div className="font-mono text-[11px] flex items-center gap-1.5 whitespace-nowrap">
            <span
              className={`h-2 w-2 rounded-full ${
                SEVERITY_CONFIG[tooltip.level].dotClass
              }`}
            />
            <span className="font-semibold text-slate-200">{tooltip.service}</span>
            <span className="text-slate-400">({tooltip.level})</span>
            <span className="text-indigo-300 font-bold">{tooltip.count} logs</span>
            <span className="text-slate-400">({tooltip.percent}%)</span>
          </div>
        </div>
      )}
    </div>
  );
}
