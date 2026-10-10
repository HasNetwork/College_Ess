"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useSync } from "@/lib/sync";
import { AlertCircle, Loader2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { type MouseEvent, useRef, useState } from "react";

/**
 * Signs out, warning first when this account has changes the server doesn't have yet
 * (0.5-4 §0, decision 3). Going ahead deletes them from the device, so whoever uses it next
 * can neither see nor send them.
 */
export function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { countUnsent, discardUnsent } = useSync();
  const [unsent, setUnsent] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Radix returns focus to a Trigger; this button opens the dialog only sometimes, so it isn't one.
  const opener = useRef<HTMLButtonElement | null>(null);

  const signOut = async () => {
    await authClient.signOut();
    // The welcome page, where the dashboard also sends anyone signed out: two different
    // destinations raced, and whichever navigation landed last won (found in 0.5-5).
    router.push("/");
  };

  const handleSignOut = async (event: MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget;
    // No outbox on this device (IndexedDB unavailable) means nothing is waiting in one.
    const count = await countUnsent().catch(() => 0);
    if (count === 0) {
      await signOut();
      return;
    }
    setUnsent(count);
    setError(null);
    setOpen(true);
  };

  const handleDiscard = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await discardUnsent();
      await signOut();
    } catch {
      setBusy(false);
      setError("Couldn't sign out. Try again.");
    }
  };

  const close = () => {
    if (!busy) setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={(event) => void handleSignOut(event)}
        className={className}
      >
        <LogOut className="h-4 w-4" />
        <span>Sign Out</span>
      </Button>

      <AlertDialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <AlertDialogContent
          onOverlayClick={close}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out now?</AlertDialogTitle>
            <AlertDialogDescription>
              {unsent === 1 ? "1 change hasn't" : `${unsent} changes haven't`} been sent yet.
              Signing out now deletes {unsent === 1 ? "it" : "them"} from this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="flex items-center gap-2 text-sm text-[var(--destructive)]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" aria-disabled={busy}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button
              variant="destructive"
              aria-busy={busy}
              aria-disabled={busy}
              onClick={() => void handleDiscard()}
            >
              {busy && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
              Sign out and delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
