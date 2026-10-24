"use client";

import { EvidenceItem } from "@/lib/types";
import { X, AlertOctagon, AlertTriangle, Info, Terminal, ArrowRight, ExternalLink } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  evidenceItem: EvidenceItem | null;
  onJumpToTable?: (evidenceId: number, service: string) => void;
}

export function EvidenceDrawer({ isOpen, onClose, evidenceItem, onJumpToTable }: Props) {
  if (!isOpen || !evidenceItem) return null;

  const isCritical = evidenceItem.level === "CRITICAL" || evidenceItem.level === "FATAL";
  const isError = evidenceItem.level === "ERROR";
  const isWarn = evidenceItem.level === "WARN";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-950 border-l border-slate-800 p-6 flex flex-col h-full shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-500/20 px-2 py-0.5 font-mono text-xs font-bold text-indigo-300 border border-indigo-500/30">
              [E{evidenceItem.id}]
            </span>
            <h3 className="text-sm font-bold text-white">Log Evidence Details</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 flex-1">
          {/* Metadata badges */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-slate-900 p-3 border border-slate-800">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Origin Service</span>
              <div className="font-mono text-xs font-bold text-indigo-300 mt-1">
                {evidenceItem.service}
              </div>
            </div>
            <div className="rounded-lg bg-slate-900 p-3 border border-slate-800">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Severity Level</span>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    isCritical
                      ? "bg-red-950/80 text-red-300 border border-red-800"
                      : isError
                      ? "bg-rose-950/80 text-rose-300 border border-rose-800"
                      : isWarn
                      ? "bg-amber-950/80 text-amber-300 border border-amber-800"
                      : "bg-cyan-950/80 text-cyan-300 border border-cyan-800"
                  }`}
                >
                  {isCritical ? (
                    <AlertOctagon className="h-3 w-3" />
                  ) : isError ? (
                    <AlertTriangle className="h-3 w-3" />
                  ) : (
                    <Info className="h-3 w-3" />
                  )}
                  {evidenceItem.level}
                </span>
              </div>
            </div>
          </div>

          {/* Timestamp */}
          <div className="rounded-lg bg-slate-900 p-3 border border-slate-800 text-xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400">Recorded Timestamp (UTC)</span>
            <div className="font-mono text-xs text-slate-200 mt-0.5">
              {evidenceItem.ts || "Unparseable timestamp"}
            </div>
          </div>

          {/* Raw Log Line Payload */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5">
              <Terminal className="h-3.5 w-3.5 text-indigo-400" />
              <span>Full Raw Log Message</span>
            </div>
            <pre className="rounded-xl bg-black/90 p-4 font-mono text-[11px] text-slate-200 border border-slate-800 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-72">
              {evidenceItem.message}
            </pre>
          </div>

          {/* Action to Jump to Log Table */}
          {onJumpToTable && (
            <button
              onClick={() => {
                onJumpToTable(evidenceItem.id, evidenceItem.service);
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Jump to this line in Log Table</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
