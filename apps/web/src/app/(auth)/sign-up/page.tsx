"use client";

import { AppMark } from "@/components/shell/app-mark";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient, enterApp } from "@/lib/auth-client";
import { deviceTimeZone } from "@clg-ess/core";
import Link from "next/link";
import { useState } from "react";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authClient.signUp.email({
        name,
        email,
        password,
        // Reminders run on this clock from the first day (0.5-4); Settings can change it.
        timezone: deviceTimeZone(),
      });

      if (res.error) {
        setError(res.error.message || "Failed to sign up");
      } else {
        enterApp();
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
          Create an account
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Join College Ess to manage your campus routines and wardrobe.
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
              htmlFor="name"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              Full Name
            </label>
            <Input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Smith"
              autoComplete="name"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@clg.edu"
              autoComplete="email"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="•••••••• (min 8 chars)"
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating account..." : "Sign Up"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="text-[var(--primary)] font-medium hover:underline focus-visible:outline-[var(--primary)]"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
