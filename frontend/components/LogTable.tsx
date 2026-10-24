"use client";

import { useState, useEffect } from "react";
import { LogEntry } from "@/lib/types";
import { getSessionLogs } from "@/lib/api";
import { ListFilter, Search, Terminal, ChevronLeft, ChevronRight, Loader2, X, Sparkles } from "lucide-react";

interface Props {
  sessionId: string;
  selectedService: string | null;
  services: string[];
  highlightedEvidenceId?: number | null;
  onClearHighlight?: () => void;
}

export function LogTable({
  sessionId,
  selectedService,
  services,
  highlightedEvidenceId,
  onClearHighlight,
}: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const limit = 25;

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await getSessionLogs(
        sessionId,
        selectedService || undefined,
        levelFilter || undefined,
        limit,
        offset
      );
      setLogs(data.logs);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setOffset(0);
  }, [selectedService, levelFilter]);

  useEffect(() => {
    fetchLogs();
  }, [sessionId, selectedService, levelFilter, offset]);

  const filteredLogs = searchQuery
    ? logs.filter(
        (l) =>
          l.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.source.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : logs;

  const getLevelStyle = (level: string) => {
    switch (level.toUpperCase()) {
      case "ERROR":
        return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      case "CRITICAL":
        return "text-red-300 bg-red-950/60 border-red-500/40 font-bold";
      case "WARN":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "INFO":
        return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      default:
        return "text-slate-400 bg-slate-800 border-slate-700/60";
    }
  };

  return (
    <div id="logs-table-section" className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-sm space-y-3">
      {/* Highlight Notice Banner if opened from Evidence Drawer */}
      {highlightedEvidenceId !== undefined && highlightedEvidenceId !== null && (
        <div className="flex items-center justify-between rounded-lg bg-cyan-950/60 border border-cyan-800/80 px-3.5 py-2 text-xs text-cyan-200">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400 shrink-0" />
            <span>
              Targeted Evidence Line <strong>[E{highlightedEvidenceId}]</strong> selected.
            </span>
          </div>
          {onClearHighlight && (
            <button
              onClick={onClearHighlight}
              className="flex items-center gap-1 rounded bg-cyan-900 px-2 py-0.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-800"
            >
              <X className="h-3 w-3" />
              <span>Clear Highlight</span>
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Terminal className="h-4 w-4 text-indigo-400" />
            Unified Canonical Logs Explorer
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Normalized unified schema ({total.toLocaleString()} total entries).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="rounded-lg bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-200 border border-slate-700/80 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Levels</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>

          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg bg-slate-800/80 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 border border-slate-700/80 focus:outline-none focus:border-indigo-500 w-44"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800/80 bg-slate-950/70">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-900/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-2.5 px-3">Timestamp (UTC ISO)</th>
              <th className="py-2.5 px-3">Service</th>
              <th className="py-2.5 px-3">Level</th>
              <th className="py-2.5 px-3">Message Pattern</th>
              <th className="py-2.5 px-3 w-1/2">Message Payload</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-400" />
                  Loading normalized log page...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-500">
                  No log records match current query.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, idx) => {
                const isTargetRow = highlightedEvidenceId !== undefined && offset + idx === highlightedEvidenceId;

                return (
                  <tr
                    key={idx}
                    className={`transition-colors font-mono ${
                      isTargetRow
                        ? "bg-cyan-950/60 ring-2 ring-cyan-500/80 font-bold"
                        : "hover:bg-slate-900/60"
                    }`}
                  >
                    <td className="py-2 px-3 text-slate-400 whitespace-nowrap text-[11px]">
                      {log.ts || "N/A"}
                    </td>
                    <td className="py-2 px-3 font-semibold text-cyan-300 whitespace-nowrap">
                      {log.source}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] uppercase border ${getLevelStyle(
                          log.level
                        )}`}
                      >
                        {log.level}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500 whitespace-nowrap text-[10px]">
                      {log.template_id ? `#${log.template_id}` : "-"}
                    </td>
                    <td className="py-2 px-3 text-slate-200 break-words whitespace-pre-wrap leading-relaxed max-w-xl">
                      {log.message}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>
          Showing {total > 0 ? offset + 1 : 0}–{Math.min(offset + limit, total)} of {total}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
            disabled={offset === 0 || isLoading}
            className="rounded p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setOffset((prev) => prev + limit)}
            disabled={offset + limit >= total || isLoading}
            className="rounded p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
