"use client";

import { AppMark } from "@/components/shell/app-mark";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient, enterApp } from "@/lib/auth-client";
import { useState } from "react";

export default function TwoFactorPage() {
  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (useBackup) {
        const res = await authClient.twoFactor.verifyBackupCode({
          code: code.trim(),
        });
        if (res.error) {
          setError(res.error.message || "Invalid backup code");
        } else {
          enterApp();
        }
      } else {
        const res = await authClient.twoFactor.verifyTotp({
          code: code.trim(),
        });
        if (res.error) {
          setError(res.error.message || "Invalid two-factor code");
        } else {
          enterApp();
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-[var(--surface-canvas)]">
      <div className="w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 sm:p-8 shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <AppMark />
            <span className="font-bold tracking-tight text-lg text-[var(--text-primary)]">
              College Ess
            </span>
          </div>
          <ThemeToggle />
        </div>

        <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          Two-Factor Authentication
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {useBackup
            ? "Enter one of your saved recovery backup codes."
            : "Enter the 6-digit code from your authenticator app."}
        </p>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-[var(--radius-md)] bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 p-3 text-sm text-[var(--destructive)] font-medium"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              {useBackup ? "Backup Code" : "Authentication Code"}
            </label>
            <Input
              id="code"
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={useBackup ? "XXXXX-XXXXX" : "123456"}
              autoComplete="one-time-code"
              className="font-mono text-center tracking-widest text-base"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Verifying..." : "Verify"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setUseBackup(!useBackup);
              setError(null);
              setCode("");
            }}
            className="text-sm text-[var(--primary)] hover:underline cursor-pointer focus-visible:outline-[var(--primary)]"
          >
            {useBackup
              ? "Use authenticator app instead"
              : "Lost access? Use a backup recovery code"}
          </button>
        </div>
      </div>
    </div>
  );
}
