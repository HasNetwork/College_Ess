"use client";

import { AppMark } from "@/components/shell/app-mark";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient, enterApp } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authClient.signIn.email({
        email,
        password,
      });

      if (res.error) {
        setError(res.error.message || "Failed to sign in");
      } else if (res.data && "twoFactorRedirect" in res.data && res.data.twoFactorRedirect) {
        router.push("/two-factor");
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

        <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Sign In</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Welcome back to your campus life hub.
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
          Don't have an account?{" "}
          <Link
            href="/sign-up"
            className="text-[var(--primary)] font-medium hover:underline focus-visible:outline-[var(--primary)]"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
