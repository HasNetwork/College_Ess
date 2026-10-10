import { Compass, LayoutDashboard, Settings } from "lucide-react";
import type { ElementType } from "react";

export interface NavItem {
  label: string;
  href: string;
  icon: ElementType;
  description: string;
}

// Only modules that exist get a tab (0.5-5): each returns with its phase. Drip, Loop, Rhythm
// and Crunch had tabs that opened "page not found". `design-pwa.test.ts` fails if a tab
// points at a route with no page.
export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Your account and today at a glance",
  },
  {
    label: "Compass",
    href: "/guide",
    icon: Compass,
    description: "How College Ess works",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Reminders, time zone and theme",
  },
];
