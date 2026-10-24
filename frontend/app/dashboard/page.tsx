"use client";

import { useEffect } from "react";

export default function DashboardIndexPage() {
  useEffect(() => {
    // If user navigates directly to /dashboard without an incident session ID,
    // redirect them to the session starter / upload dropzone on homepage
    window.location.replace("/");
  }, []);

  return null;
}
