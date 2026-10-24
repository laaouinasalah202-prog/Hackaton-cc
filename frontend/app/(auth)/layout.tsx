import React from "react";
import Link from "next/link";
import { Activity, ArrowLeft } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-[#080c14] text-slate-100">
      {/* Ambient background glow effects */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-indigo-600/10 blur-[130px] rounded-full" />
      <div className="pointer-events-none absolute top-1/3 -right-48 w-[600px] h-[600px] bg-cyan-500/10 blur-[150px] rounded-full" />
      <div className="pointer-events-none absolute -bottom-48 -left-48 w-[600px] h-[600px] bg-violet-600/10 blur-[150px] rounded-full" />

      {/* Subtle grid texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Top Header */}
      <header className="relative z-20 border-b border-slate-800/80 bg-[#0b101d]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
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

          <div className="flex items-center gap-4 text-xs">
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Format-Agnostic Engine</span>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900/80 px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors border border-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Platform</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-5xl">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 border-t border-slate-800/60 py-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>LogLens MVP — Format-agnostic AI log intelligence powered by Gemma, Drain3, and HDBSCAN.</span>
          <div className="flex items-center gap-4 text-slate-400">
            <Link href="/" className="hover:text-slate-200 transition-colors">Privacy</Link>
            <span className="text-slate-700">•</span>
            <Link href="/" className="hover:text-slate-200 transition-colors">Terms of Service</Link>
            <span className="text-slate-700">•</span>
            <Link href="/" className="hover:text-slate-200 transition-colors">Documentation</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
