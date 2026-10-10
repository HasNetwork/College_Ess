"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw, WifiOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function OfflineFallbackPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setIsChecking(true);
    if (navigator.onLine) {
      router.refresh();
      window.location.reload();
    } else {
      setTimeout(() => {
        setIsChecking(false);
      }, 500);
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-[var(--radius-xl)] bg-[var(--surface-sunken)] flex items-center justify-center text-[var(--text-muted)] mb-6">
        <WifiOff className="h-8 w-8 text-[var(--primary)]" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight">
        You are currently offline
      </h1>

      <p className="text-[var(--text-secondary)] text-sm mb-6 leading-relaxed">
        {isOnline
          ? "Your internet connection is restored! Tap retry to refresh the page."
          : "This page isn't saved on this device yet. Changes you've made are kept here and sent when you're back online."}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
        <Button onClick={handleRetry} disabled={isChecking} className="w-full sm:w-auto">
          <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
          <span>{isChecking ? "Checking..." : "Retry Connection"}</span>
        </Button>
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
