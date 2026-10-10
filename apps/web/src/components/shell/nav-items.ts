import {
  Bot,
  CalendarClock,
  CheckSquare,
  Compass,
  Flame,
  GraduationCap,
  LayoutDashboard,
  MessageSquareQuote,
  Palmtree,
  Settings,
  Shirt,
  ShoppingCart,
  Sparkles,
  Users,
} from "lucide-react";
import type { ElementType } from "react";

export interface NavItem {
  label: string;
  href: string;
  icon: ElementType;
  description: string;
  badge?: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Today at a glance and overview",
  },
  {
    label: "Loop",
    href: "/loop",
    icon: CheckSquare,
    description: "Tasks, to-dos and deadlines",
  },
  {
    label: "Rhythm",
    href: "/rhythm",
    icon: CalendarClock,
    description: "Class timetable and routine manager",
  },
  {
    label: "Drip",
    href: "/drip",
    icon: Shirt,
    description: "Wardrobe manager and laundry tracker",
  },
  {
    label: "Groove",
    href: "/groove",
    icon: Flame,
    description: "Habit builder and streak tracker",
  },
  {
    label: "Crunch",
    href: "/crunch",
    icon: GraduationCap,
    description: "Exam schedules, venues and countdowns",
  },
  {
    label: "Breather",
    href: "/breather",
    icon: Palmtree,
    description: "Long weekends and academic breaks",
  },
  {
    label: "Pantry",
    href: "/pantry",
    icon: ShoppingCart,
    description: "Hostel grocery and snack restocking",
  },
  {
    label: "Circles",
    href: "/circles",
    icon: Users,
    description: "Clubs, student committees and societies",
  },
  {
    label: "Buzz",
    href: "/buzz",
    icon: Sparkles,
    description: "Campus fests, hackathons and events",
  },
  {
    label: "Quad",
    href: "/quad",
    icon: MessageSquareQuote,
    description: "Campus social feed and discussions",
  },
  {
    label: "Sage",
    href: "/sage",
    icon: Bot,
    description: "AI academic guidance and assistant",
    badge: "AI",
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
    description: "Preferences and app settings",
  },
];
