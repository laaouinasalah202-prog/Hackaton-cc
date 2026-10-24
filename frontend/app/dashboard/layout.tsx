"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getCurrentUser } from "@/lib/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (!user) {
          const currentPath = window.location.pathname || "/dashboard";
          window.location.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
          return;
        }
        setIsAuthenticated(true);
      })
      .catch(() => {
        setIsAuthenticated(false);
        window.location.replace("/login");
      });
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
