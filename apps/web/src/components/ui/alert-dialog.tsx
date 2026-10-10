"use client";

import { cn } from "@/lib/utils";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { GlassSurface } from "./glass-surface";

// shadcn/ui's AlertDialog (Radix), on the app's tokens. The panel is glass: a modal is
// persistent chrome (R6.1).

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogCancel = AlertDialogPrimitive.Cancel;

export function AlertDialogContent({
  className,
  children,
  onOverlayClick,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Content> & {
  /** An alert dialog ignores a click outside it unless this makes one a choice. */
  onOverlayClick?: () => void;
}) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay
        data-slot="alert-dialog-overlay"
        onClick={onOverlayClick}
        className="fixed inset-0 z-50 bg-[var(--scrim)] transition-opacity duration-200 starting:opacity-0"
      />
      <AlertDialogPrimitive.Content data-slot="alert-dialog-content" asChild {...props}>
        <GlassSurface
          chromeRole="modal"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-5 rounded-[var(--radius-xl)] p-6 transition-[opacity,scale] duration-200 starting:scale-95 starting:opacity-0",
            className,
          )}
        >
          {children}
        </GlassSurface>
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("grid gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

export function AlertDialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export function AlertDialogTitle({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-lg font-semibold text-[var(--text-primary)]", className)}
      {...props}
    />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-sm leading-relaxed text-[var(--text-secondary)]", className)}
      {...props}
    />
  );
}
