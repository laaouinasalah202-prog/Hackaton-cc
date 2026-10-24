"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { TimelineBucket, Anomaly } from "@/lib/types";
import { BarChart3, AlertCircle } from "lucide-react";

interface Props {
  timeline: TimelineBucket[];
  anomalies: Anomaly[];
  services: string[];
  onSelectService?: (service: string | null) => void;
  selectedService?: string | null;
}

const SERVICE_COLORS = [
  "#6366f1", // indigo
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#ec4899", // pink
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#3b82f6", // blue
];

const LEVEL_COLORS: Record<string, string> = {
  INFO: "#3b82f6",
  DEBUG: "#64748b",
  WARN: "#f59e0b",
  ERROR: "#ef4444",
  CRITICAL: "#b91c1c",
};

export function TimelineChart({
  timeline,
  anomalies,
  services,
  onSelectService,
  selectedService,
}: Props) {
  const [viewMode, setViewMode] = useState<"service" | "level">("service");

  if (!timeline || timeline.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 text-slate-500">
        No timeline telemetry available.
      </div>
    );
  }

  // Format data for Recharts
  const chartData = timeline.map((bucket, index) => {
    const timeLabel = new Date(bucket.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const item: Record<string, any> = {
      index,
      time: timeLabel,
      total: bucket.total,
      errorCount: bucket.error_count,
      anomalyCount: bucket.anomalies.length,
    };

    if (viewMode === "service") {
      services.forEach((svc) => {
        item[svc] = bucket.by_service[svc] || 0;
      });
    } else {
      ["INFO", "WARN", "ERROR", "CRITICAL"].forEach((lvl) => {
        item[lvl] = bucket.by_level[lvl] || 0;
      });
    }

    return item;
  });

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-400" />
            Log Volume Timeline & Anomaly Heat
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized event distribution across time buckets with anomaly spikes.
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 italic">
            How to read this: Stacked bars indicate request volumes by service or severity level. Red dots mark moments with detected failure spikes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedService && (
            <button
              onClick={() => onSelectService && onSelectService(null)}
              className="rounded bg-indigo-500/20 px-2.5 py-1 text-xs text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30"
            >
              Filtering: {selectedService} ✕
            </button>
          )}

          <div className="flex items-center rounded-lg bg-slate-800/80 p-0.5 border border-slate-700/60 text-xs">
            <button
              onClick={() => setViewMode("service")}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                viewMode === "service"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              By Service
            </button>
            <button
              onClick={() => setViewMode("level")}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                viewMode === "level"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              By Level
            </button>
          </div>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#334155" }}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#334155" }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border border-slate-700 bg-slate-900/95 p-3 shadow-xl backdrop-blur-md text-xs">
                      <div className="font-semibold text-slate-200 border-b border-slate-800 pb-1.5 mb-2 flex items-center justify-between gap-4">
                        <span>Time: {label}</span>
                        <span className="font-mono text-indigo-400">Total: {data.total}</span>
                      </div>
                      <div className="space-y-1">
                        {payload.map((entry: any) => (
                          <div key={entry.name} className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 text-slate-300">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: entry.color }}
                              />
                              {entry.name}
                            </span>
                            <span className="font-mono font-medium text-slate-200">
                              {entry.value}
                            </span>
                          </div>
                        ))}
                      </div>
                      {data.anomalyCount > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center gap-1.5 text-amber-400 font-medium">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span>{data.anomalyCount} Anomaly Flag(s)</span>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              iconType="circle"
              iconSize={8}
            />
            {viewMode === "service"
              ? services.map((svc, i) => (
                  <Bar
                    key={svc}
                    dataKey={svc}
                    name={svc}
                    stackId="a"
                    fill={SERVICE_COLORS[i % SERVICE_COLORS.length]}
                    opacity={selectedService && selectedService !== svc ? 0.3 : 0.9}
                    radius={i === services.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                  />
                ))
              : ["INFO", "WARN", "ERROR", "CRITICAL"].map((lvl) => (
                  <Bar
                    key={lvl}
                    dataKey={lvl}
                    name={lvl}
                    stackId="a"
                    fill={LEVEL_COLORS[lvl] || "#94a3b8"}
                    radius={lvl === "CRITICAL" ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
