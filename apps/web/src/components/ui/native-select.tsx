import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

/**
 * shadcn/ui's NativeSelect, on the app's tokens: the platform's own picker, which is what a
 * phone is best at for a long list.
 */
export function NativeSelect({ className = "", ...props }: ComponentProps<"select">) {
  return (
    <div data-slot="native-select-wrapper" className="relative w-full">
      <select
        data-slot="native-select"
        className={`min-h-[44px] w-full cursor-pointer appearance-none truncate rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] py-2 pr-10 pl-3.5 text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-progress ${className}`.trim()}
        {...props}
      />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
      />
    </div>
  );
}

export function NativeSelectOptGroup(props: ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className="bg-[var(--surface-card)] text-[var(--text-secondary)]"
      {...props}
    />
  );
}

export function NativeSelectOption(props: ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className="bg-[var(--surface-card)] text-[var(--text-primary)]"
      {...props}
    />
  );
}
