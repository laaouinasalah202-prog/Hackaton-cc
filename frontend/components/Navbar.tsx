"use client";

import Link from "next/link";
import { Activity, ShieldAlert, Cpu, Sparkles, Terminal } from "lucide-react";

export function Navbar({ sessionId }: { sessionId?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0b101d]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                LogLens
                <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/20">
                  AI MVP
                </span>
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {sessionId && (
            <div className="hidden sm:flex items-center gap-2 rounded-md bg-slate-900/80 px-3 py-1.5 border border-slate-800 text-slate-400">
              <Terminal className="h-3.5 w-3.5 text-indigo-400" />
              <span>Session:</span>
              <span className="font-mono text-slate-200">{sessionId.slice(0, 8)}...</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Format-Agnostic Engine</span>
          </div>

          <Link
            href="/"
            className="rounded-lg bg-slate-800/80 px-3 py-1.5 text-slate-300 hover:bg-slate-700/80 hover:text-white transition-colors border border-slate-700/60"
          >
            New Session
          </Link>
        </div>
      </div>
    </header>
  );
}
