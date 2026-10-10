"use client";

import { useEffect } from "react";

export function RegisterPwa() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Service Worker registration failed:", error);
      });
    }
  }, []);

  return null;
}
