import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

// shadcn/ui's Button (radix-vega), on the app's look: every size keeps a 44 px tap area (R6),
// and focus is the app's solid outline rather than shadcn's faint ring.
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center font-medium whitespace-nowrap transition-all duration-200 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-primary text-primary-foreground shadow-[var(--shadow-sm)] hover:bg-[var(--primary-hover)]",
        secondary:
          "border border-[var(--border-subtle)] bg-secondary text-secondary-foreground hover:bg-[var(--surface-sunken)]",
        outline:
          "border border-[var(--border-strong)] bg-transparent text-foreground hover:bg-accent",
        ghost: "border border-transparent bg-transparent text-foreground hover:bg-accent",
        destructive:
          "border border-transparent bg-destructive text-destructive-foreground shadow-[var(--shadow-sm)] hover:opacity-90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 gap-2 rounded-[var(--radius-md)] px-4 py-2 text-sm",
        // 36 px drawn, 44 px to tap: the invisible ::after adds 4 px above and below.
        sm: "relative min-h-9 gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-xs after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
        lg: "min-h-12 gap-2.5 rounded-[var(--radius-lg)] px-6 py-2.5 text-base",
        icon: "size-11 rounded-[var(--radius-md)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  // A plain button, unlike shadcn's, never submits a form by accident: ask for "submit".
  type = asChild ? undefined : "button",
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      type={type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
