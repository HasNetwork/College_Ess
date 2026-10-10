import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

// shadcn/ui's Skeleton (radix-vega), on the sunken surface the app has always used for it.
function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-sunken)]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
