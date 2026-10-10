import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

export type GlassSurfaceProps<T extends ElementType = "div"> = {
  as?: T;
  children?: ReactNode;
  className?: string;
  chromeRole?: "navbar" | "tabbar" | "header" | "modal" | "sheet" | "toast";
} & ComponentPropsWithoutRef<T>;

/**
 * GlassSurface Primitive
 *
 * CRITICAL PERFORMANCE RULE (PLAN 0-7 §3):
 * Use GlassSurface ONLY on persistent chrome surfaces (navbar, tab bar, sheets, modals, sticky headers, toasts).
 * NEVER use GlassSurface on repeated content (list items, grid cells, or cards inside a scrolling collection).
 */
export function GlassSurface<T extends ElementType = "div">({
  as,
  children,
  className = "",
  chromeRole,
  ...props
}: GlassSurfaceProps<T>) {
  const Component = as || "div";

  return (
    <Component
      className={`glass-chrome ${className}`.trim()}
      data-glass-role={chromeRole}
      {...props}
    >
      {children}
    </Component>
  );
}
