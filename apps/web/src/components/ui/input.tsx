import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

// shadcn/ui's Input (radix-vega), on the app's look: 44 px tall (R6), and 16 px text on a
// phone so iOS Safari does not zoom the page when the field is focused.
function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "min-h-11 w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-card px-3.5 py-2 text-base text-foreground transition-colors placeholder:text-muted-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--primary)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
