"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { GOOGLE_LOGIN_URL, getCurrentUser } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [redirectTarget, setRedirectTarget] = useState("/");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      if (redirect && redirect.startsWith("/")) {
        setRedirectTarget(redirect);
      }
    }

    getCurrentUser()
      .then((user) => {
        if (user) {
          router.replace(redirectTarget);
        }
      })
      .catch(() => undefined);
  }, [redirectTarget, router]);

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-[#0b101d]/90 backdrop-blur-md">
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
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            &larr; Back to Platform Overview
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Sign In Card */}
          <div className="lg:col-span-7">
            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0f1523]/95 p-7 sm:p-9 shadow-2xl backdrop-blur-xl">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-600" />

              <div className="mb-6 space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Secure Access</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Sign in to{" "}
                  <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-300 bg-clip-text text-transparent">
                    LogLens
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-400">
                  Authenticate to upload multi-service production logs, reconstruct cascading failure topologies, and generate grounded Gemma runbooks.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Sign in with Google Button */}
              <div className="space-y-4">
                <a
                  href={GOOGLE_LOGIN_URL}
                  className="flex items-center justify-center gap-3 w-full rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold px-4 py-3 text-sm shadow-md transition-all cursor-pointer group"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" width="16" height="16">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform ml-auto" />
                </a>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
                <p className="text-[11px] text-slate-500">
                  Protected by secure HTTP-only cookies. No API keys or tokens are shared with the client.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Platform Capabilities */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-[#0f1523]/60 p-6 space-y-4">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
                <Sparkles className="h-4 w-4" />
                <span>Deterministic Fact Engine</span>
              </div>
              <h3 className="text-lg font-bold text-white">
                Code Computes Facts, Gemma Narrates Them
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                LogLens eliminates AI hallucinations by computing root cause candidacy, service onset timestamps, and victim demotion mathematically before the LLM generates a single word.
              </p>

              <div className="space-y-2.5 pt-2 border-t border-slate-800/60">
                <div className="flex items-start gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Format-Agnostic: Ingests JSON, Log4j, Nginx, Syslog, & plain text</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Onset Detection: Identifies earliest failing component with MAD statistical spikes</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Evidence-Backed: Every claim cites verified raw log lines [E1, E2]</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-6 text-center text-xs text-slate-500">
        LogLens MVP — Built with Next.js, FastAPI, Gemma 3, Drain3, and HDBSCAN.
      </footer>
    </div>
  );
}
