"use client";

import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { Toggle as TogglePrimitive } from "radix-ui";
import type { ComponentProps } from "react";

// shadcn/ui's Toggle (radix-vega), on the app's look: every size keeps a 44 px tap area (R6),
// and focus is the app's solid outline rather than shadcn's faint ring.
const toggleVariants = cva(
  "group/toggle inline-flex cursor-pointer items-center justify-center gap-1 rounded-[var(--radius-md)] text-sm font-medium whitespace-nowrap transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-pressed:bg-muted [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-[var(--border-strong)] bg-transparent shadow-[var(--shadow-sm)] hover:bg-muted",
      },
      size: {
        default: "min-h-11 min-w-11 px-3",
        // 32 px drawn, 44 px to tap: the invisible ::after adds 6 px above and below.
        sm: "relative h-8 min-w-11 px-2.5 after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']",
        lg: "min-h-12 min-w-12 px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
