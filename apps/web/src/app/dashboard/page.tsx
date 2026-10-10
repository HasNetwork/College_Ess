"use client";

import { ProfilePhoto } from "@/components/profile/profile-photo";
import { AppShell } from "@/components/shell/app-shell";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { UnreachableNotice } from "@/components/shell/unreachable-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { CheckCircle, KeyRound, ShieldCheck, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const router = useRouter();
  const session = authClient.useSession();
  const [password, setPassword] = useState("");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [enrollStep, setEnrollStep] = useState<"idle" | "enrolled" | "verified">("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Signed out for certain: the welcome page, which is also where a signed-out launch of
    // the installed app lands (the manifest's start_url is this page). An error is not a
    // sign-out: College Ess couldn't be reached, and the student stays (as in SyncPull).
    if (!session.isPending && !session.error && !session.data?.user) {
      router.push("/");
    }
  }, [session, router]);

  const handleStartEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authClient.twoFactor.enable({
        password,
      });

      if (res.error) {
        setError(res.error.message || "Failed to start 2FA enrollment");
      } else if (res.data && "totpURI" in res.data) {
        setTotpUri(res.data.totpURI);
        setBackupCodes(res.data.backupCodes || []);
        setEnrollStep("enrolled");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to enable 2FA");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authClient.twoFactor.verifyTotp({
        code: verifyCode.trim(),
      });

      if (res.error) {
        setError(res.error.message || "Invalid verification code");
      } else {
        setEnrollStep("verified");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  if (!session.isPending && session.error && !session.data?.user) {
    return (
      <AppShell>
        <UnreachableNotice what="Your account" />
      </AppShell>
    );
  }

  if (session.isPending || !session.data?.user) {
    return (
      <AppShell>
        <div className="space-y-6 max-w-4xl">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  const user = session.data.user;
  const is2FAActive =
    (user as unknown as { twoFactorEnabled?: boolean })?.twoFactorEnabled ||
    enrollStep === "verified";

  return (
    <AppShell>
      <div className="max-w-4xl space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              Dashboard
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Manage your identity, campus credentials, and security settings.
            </p>
          </div>
          <SignOutButton className="self-start sm:self-auto" />
        </div>

        {/* Profile Information Card (Solid fill, no glass per PLAN 0-7 §3) */}
        <section
          aria-labelledby="profile-heading"
          className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-sm)] space-y-4"
        >
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-[var(--primary)]" />
            <h2 id="profile-heading" className="text-lg font-semibold text-[var(--text-primary)]">
              Profile Information
            </h2>
          </div>

          <ProfilePhoto name={user.name} image={user.image ?? null} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-muted)] block font-medium">Full Name</span>
              <span className="font-semibold text-[var(--text-primary)] mt-0.5 block">
                {user.name}
              </span>
            </div>
            <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-muted)] block font-medium">
                Email Address
              </span>
              <span className="font-semibold text-[var(--text-primary)] mt-0.5 block">
                {user.email}
              </span>
            </div>
            <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-muted)] block font-medium">User ID</span>
              <span className="font-mono text-xs text-[var(--text-secondary)] mt-0.5 block break-all">
                {user.id}
              </span>
            </div>
            <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-muted)] block font-medium">
                Two-Factor Status
              </span>
              <span
                className={`font-semibold mt-0.5 flex items-center gap-1.5 ${
                  is2FAActive ? "text-[var(--success)]" : "text-[var(--warning)]"
                }`}
              >
                {is2FAActive ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Active & Protected</span>
                  </>
                ) : (
                  <span>Disabled</span>
                )}
              </span>
            </div>
          </div>
        </section>

        {/* Security & 2FA Card */}
        <section
          aria-labelledby="security-heading"
          className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-sm)] space-y-6"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />
            <h2 id="security-heading" className="text-lg font-semibold text-[var(--text-primary)]">
              Two-Factor Authentication (TOTP)
            </h2>
          </div>
          <p className="text-sm text-[var(--text-secondary)] -mt-4">
            Protect your account using an authenticator app (Google Authenticator, 1Password, etc.).
          </p>

          {error && (
            <div
              role="alert"
              className="rounded-[var(--radius-md)] bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 p-3 text-sm text-[var(--destructive)] font-medium"
            >
              {error}
            </div>
          )}

          {is2FAActive ? (
            <div className="rounded-[var(--radius-md)] bg-[var(--success)]/10 border border-[var(--success)]/20 p-4 text-[var(--success)] text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <span>Two-factor authentication is active on your account.</span>
            </div>
          ) : enrollStep === "idle" ? (
            <form onSubmit={handleStartEnroll} className="space-y-4 max-w-md">
              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
                >
                  Confirm your password to begin enrollment
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Starting enrollment..." : "Enroll in 2FA"}
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="p-4 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-[var(--primary)]" />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    1. Authenticator URI / Secret
                  </h3>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Copy this URI or secret into your authenticator app:
                </p>
                <Input
                  type="text"
                  readOnly
                  value={totpUri || ""}
                  id="totp-uri-input"
                  className="font-mono text-xs"
                />
              </div>

              {backupCodes.length > 0 && (
                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] space-y-3">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    2. Backup Recovery Codes
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Save these recovery codes in a safe place. Each can be used once if you lose
                    your phone:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {backupCodes.map((code) => (
                      <code
                        key={code}
                        className="rounded-[var(--radius-sm)] bg-[var(--surface-card)] p-2 text-center text-xs font-mono text-[var(--success)] border border-[var(--border-subtle)] backup-code"
                      >
                        {code}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleVerifyEnroll} className="space-y-4 max-w-md">
                <div>
                  <label
                    htmlFor="verify-code"
                    className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
                  >
                    3. Enter the 6-digit code to activate
                  </label>
                  <Input
                    id="verify-code"
                    type="text"
                    required
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    placeholder="123456"
                    className="font-mono text-base tracking-widest text-center"
                    autoComplete="one-time-code"
                  />
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? "Activating..." : "Verify and Activate 2FA"}
                </Button>
              </form>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
