"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import Image from "next/image";
import Link from "next/link";

// The welcome page, and where a signed-out launch of the installed app lands (the dashboard
// sends a signed-out visitor here). Sign In and Sign Up are in the server's HTML, so they work
// before the script loads and when the session can't be checked. A student who is already
// signed in gets a way into the app instead, in the same space, so nothing below moves.
export default function WelcomePage() {
  const { data } = authClient.useSession();
  const user = data?.user;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex w-full max-w-xs flex-col items-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
        {/* Decorative: the heading below names the app. Unoptimised, so it is the file the
            service worker already holds. */}
        <Image
          src="/icon-512.png"
          alt=""
          width={96}
          height={96}
          priority
          unoptimized
          className="size-24 rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)]"
        />
        <h1 className="mt-8 text-4xl font-bold text-[var(--text-primary)] sm:text-5xl">
          College Ess
        </h1>
        <p className="mt-3 text-lg text-balance text-[var(--text-secondary)] sm:text-xl">
          Your college life, in one place.
        </p>

        <div className="mt-10 flex w-full flex-col gap-3">
          {user ? (
            <>
              <Button asChild size="lg">
                <Link href="/dashboard">Open College Ess</Link>
              </Button>
              <p className="flex min-h-12 items-center justify-center text-sm text-[var(--text-secondary)]">
                <span className="truncate">Signed in as {user.name}</span>
              </p>
            </>
          ) : (
            <>
              <Button asChild size="lg">
                <Link href="/dashboard">Launch Demo Presentation</Link>
              </Button>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline" className="flex-1 text-xs">
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="flex-1 text-xs">
                  <Link href="/sign-up">Sign Up</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
