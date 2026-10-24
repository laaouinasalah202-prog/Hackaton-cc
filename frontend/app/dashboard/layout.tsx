"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const user = localStorage.getItem("loglens_user");
      const hasAuthCookie = document.cookie
        .split("; ")
        .some((row) => row.startsWith("loglens_auth=true"));

      const currentPath = window.location.pathname || "/dashboard";

      if (!user && !hasAuthCookie) {
        setIsAuthenticated(false);
        window.location.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
      } else {
        // Synchronize cookie if user is stored in localStorage
        if (!hasAuthCookie) {
          document.cookie = "loglens_auth=true; path=/; max-age=2592000; SameSite=Lax";
        }
        setIsAuthenticated(true);
      }
    } catch {
      setIsAuthenticated(false);
      window.location.replace("/login");
    }
  }, []);

  if (isAuthenticated !== true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080c14] text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <span className="text-xs tracking-wider uppercase font-semibold text-slate-400">
            Authenticating Session...
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
