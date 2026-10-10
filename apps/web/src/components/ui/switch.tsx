"use client";

import { cn } from "@/lib/utils";
import { Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

/**
 * shadcn/ui's Switch (Radix), on the app's tokens. The track is 44 × 24 like the reminder
 * switch; an invisible margin brings the tap area to 44 px tall.
 */
export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-[var(--radius-full)] border-2 transition-colors duration-200 after:absolute after:-inset-2.5 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-progress data-[state=checked]:border-transparent data-[state=checked]:bg-[var(--primary)] data-[state=unchecked]:border-[var(--border-strong)] data-[state=unchecked]:bg-[var(--surface-sunken)]",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block h-5 w-5 rounded-[var(--radius-full)] shadow-[var(--shadow-md)] data-[state=checked]:bg-[var(--primary-foreground)] data-[state=unchecked]:bg-[var(--surface-card)] dark:data-[state=unchecked]:bg-[var(--text-secondary)] transition-transform duration-200 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}
