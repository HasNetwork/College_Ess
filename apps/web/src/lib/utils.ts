// shadcn/ui's components import `cn` from the `cn` package (shadcn, 2026-09); app code
// imports it from here. It joins class names, and a later Tailwind class beats a conflicting
// earlier one, so a caller's `className` can override a component's default.
export { cn } from "cn";
