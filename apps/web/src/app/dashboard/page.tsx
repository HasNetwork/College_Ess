"use client";

import { ProfilePhoto } from "@/components/profile/profile-photo";
import { AppShell } from "@/components/shell/app-shell";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import {
  DEMO_USER,
  INITIAL_EXAMS,
  INITIAL_HABITS,
  INITIAL_TASKS,
  INITIAL_WARDROBE,
  TODAY_SCHEDULE,
} from "@/lib/mock-data";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  Compass,
  Flame,
  GraduationCap,
  ListTodo,
  MapPin,
  MessageSquareQuote,
  Palmtree,
  PartyPopper,
  ShieldCheck,
  Shirt,
  ShoppingCart,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function DashboardPage() {
  const session = authClient.useSession();
  const rawUser = session.data?.user;

  // Gracefully use live session user if signed in, or DEMO_USER for smooth demo showcase
  const user = rawUser
    ? {
        name: rawUser.name,
        email: rawUser.email,
        id: rawUser.id,
        image: rawUser.image ?? null,
        college: DEMO_USER.college,
        branch: DEMO_USER.branch,
        semester: DEMO_USER.semester,
      }
    : {
        name: DEMO_USER.name,
        email: DEMO_USER.email,
        id: DEMO_USER.id,
        image: null,
        college: DEMO_USER.college,
        branch: DEMO_USER.branch,
        semester: DEMO_USER.semester,
      };

  // Interactive quick state for dashboard widgets
  const [tasks, setTasks] = useState(INITIAL_TASKS.slice(0, 3));
  const [habits, setHabits] = useState(INITIAL_HABITS.slice(0, 3));
  const [showSecuritySettings, setShowSecuritySettings] = useState(false);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
  };

  const toggleHabit = (id: string) => {
    setHabits((prev) =>
      prev.map((h) =>
        h.id === id
          ? {
              ...h,
              completedToday: !h.completedToday,
              streak: h.completedToday ? h.streak - 1 : h.streak + 1,
            }
          : h,
      ),
    );
  };

  const activeWearingTop = INITIAL_WARDROBE[0];
  const activeWearingBottom = INITIAL_WARDROBE[2];
  const nextExam = INITIAL_EXAMS[0];

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Greeting & College Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                {user.college}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {user.branch} · {user.semester}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1.5">
              Good morning, {user.name} 👋
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
              Wednesday, Oct 10 · Class Day · 3 classes scheduled today
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSecuritySettings((prev) => !prev)}
              className="text-xs"
            >
              <ShieldCheck className="h-4 w-4 mr-1.5 text-[var(--primary)]" />
              {showSecuritySettings ? "Hide Account Info" : "Account & 2FA"}
            </Button>
            <SignOutButton className="text-xs" />
          </div>
        </div>

        {/* Collapsible Account & 2FA Info Card (Satisfies existing security tests) */}
        {showSecuritySettings && (
          <section
            aria-labelledby="security-heading"
            className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-sm)] space-y-4 motion-safe:animate-in motion-safe:fade-in"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />
                <h2 id="security-heading" className="text-base font-semibold text-[var(--text-primary)]">
                  Account Identity & Security
                </h2>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-[var(--success)]/10 text-[var(--success)] font-medium">
                Protected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                <span className="text-xs text-[var(--text-muted)] block font-medium">Full Name</span>
                <span className="font-semibold text-[var(--text-primary)] mt-0.5 block">{user.name}</span>
              </div>
              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                <span className="text-xs text-[var(--text-muted)] block font-medium">Email</span>
                <span className="font-semibold text-[var(--text-primary)] mt-0.5 block">{user.email}</span>
              </div>
              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                <span className="text-xs text-[var(--text-muted)] block font-medium">User Identifier</span>
                <span className="font-mono text-xs text-[var(--text-secondary)] mt-0.5 block truncate">
                  {user.id}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Top 3 High-Impact Cards: Schedule, Wardrobe & Exam Alert */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 1. Rhythm: Today's Routine Widget */}
          <div className="lg:col-span-2 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-sm)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">
                    Today&apos;s Rhythm
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">Class schedule & locations</p>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link href="/rhythm">
                  Full Timetable <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            </div>

            <div className="space-y-2.5">
              {TODAY_SCHEDULE.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-[var(--radius-md)] border text-sm transition-colors ${
                    item.status === "in-progress"
                      ? "bg-[var(--primary)]/5 border-[var(--primary)]/40 shadow-xs"
                      : "bg-[var(--surface-raised)] border-[var(--border-subtle)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-[var(--surface-canvas)] text-[var(--text-primary)] border border-[var(--border-subtle)]">
                      {item.startTime}
                    </span>
                    <div>
                      <div className="font-medium text-[var(--text-primary)] flex items-center gap-2">
                        <span>{item.courseName}</span>
                        {item.status === "in-progress" && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[var(--primary)] text-[var(--primary-foreground)] animate-pulse">
                            NOW
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {item.hall}
                        </span>
                        <span>•</span>
                        <span>{item.instructor}</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-mono text-[var(--text-muted)] hidden sm:inline">
                    {item.courseCode}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Drip & Crunch Highlights */}
          <div className="space-y-5">
            {/* Drip: Today's Outfit */}
            <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-sm)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)]">
                    <Shirt className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Wearing Today (Drip)
                  </h3>
                </div>
                <Button asChild variant="ghost" size="sm" className="text-xs h-7 px-2">
                  <Link href="/drip">Wardrobe</Link>
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                  <div className="text-2xl mb-1">{activeWearingTop.emoji}</div>
                  <div className="font-semibold text-[var(--text-primary)] truncate">
                    {activeWearingTop.name}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {activeWearingTop.wearsLeft} wears remaining
                  </div>
                </div>
                <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                  <div className="text-2xl mb-1">{activeWearingBottom.emoji}</div>
                  <div className="font-semibold text-[var(--text-primary)] truncate">
                    {activeWearingBottom.name}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {activeWearingBottom.wearsLeft} wears remaining
                  </div>
                </div>
              </div>

              <div className="p-2 rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] text-[11px] text-[var(--text-secondary)] flex items-center justify-between">
                <span>🧺 Laundry status: 1 hoodie needs wash</span>
                <Link href="/drip" className="text-[var(--primary)] font-medium hover:underline">
                  Log wear →
                </Link>
              </div>
            </div>

            {/* Crunch: Next Exam Countdown */}
            <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-sm)] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-[var(--warning)]/10 text-[var(--warning)]">
                    <GraduationCap className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Next Crunch (Exam)
                  </h3>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-[var(--warning)]/10 text-[var(--warning)]">
                  in {nextExam.daysRemaining} days
                </span>
              </div>

              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] space-y-1 text-xs">
                <div className="font-semibold text-sm text-[var(--text-primary)]">
                  {nextExam.courseName} ({nextExam.courseCode})
                </div>
                <div className="text-[var(--text-secondary)] flex items-center justify-between">
                  <span>{nextExam.date}</span>
                  <span className="font-mono">{nextExam.time}</span>
                </div>
                <div className="text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span>📍 {nextExam.hall}</span>
                  <span className="font-medium text-[var(--text-primary)]">🪑 {nextExam.seatNo}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Row: Loop (Tasks) & Groove (Habits) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Loop: Tasks */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-sm)] space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                  <ListTodo className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Loop Tasks</h2>
                  <p className="text-xs text-[var(--text-secondary)]">Urgent & today&apos;s deadlines</p>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link href="/loop">
                  All Tasks <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            </div>

            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className="flex items-center gap-3 p-2.5 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:bg-[var(--surface-sunken)] cursor-pointer transition-colors"
                >
                  {task.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-[var(--success)] shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                  )}
                  <span
                    className={`text-xs flex-1 truncate ${
                      task.completed ? "line-through text-[var(--text-muted)]" : "text-[var(--text-primary)]"
                    }`}
                  >
                    {task.title}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-canvas)] text-[var(--text-muted)] border border-[var(--border-subtle)] shrink-0">
                    {task.dueDate}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Groove: Habits */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-sm)] space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[var(--warning)]/10 text-[var(--warning)]">
                  <Flame className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">
                    Groove Habits
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">Daily streaks & momentum</p>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link href="/groove">
                  Tracker <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            </div>

            <div className="space-y-2">
              {habits.map((habit) => (
                <div
                  key={habit.id}
                  onClick={() => toggleHabit(habit.id)}
                  className="flex items-center justify-between p-2.5 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:bg-[var(--surface-sunken)] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {habit.completedToday ? (
                      <CheckCircle2 className="h-4 w-4 text-[var(--success)] shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                    )}
                    <span
                      className={`text-xs ${
                        habit.completedToday
                          ? "line-through text-[var(--text-muted)]"
                          : "text-[var(--text-primary)] font-medium"
                      }`}
                    >
                      {habit.title}
                    </span>
                  </div>

                  <span className="flex items-center gap-1 text-xs font-bold text-[var(--warning)] bg-[var(--warning)]/10 px-2 py-0.5 rounded">
                    <Flame className="h-3.5 w-3.5" />
                    {habit.streak}d
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* All Modules Quick Showcase Navigator */}
        <section className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-sm)] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Explore All 12 College Modules
            </h2>
            <span className="text-xs text-[var(--text-secondary)]">Click to test each module</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { label: "Loop", sub: "Tasks & To-dos", icon: ListTodo, href: "/loop" },
              { label: "Rhythm", sub: "Class Timetable", icon: CalendarClock, href: "/rhythm" },
              { label: "Drip", sub: "Wardrobe & Laundry", icon: Shirt, href: "/drip" },
              { label: "Groove", sub: "Habits & Streaks", icon: Flame, href: "/groove" },
              { label: "Crunch", sub: "Exams & Seating", icon: GraduationCap, href: "/crunch" },
              { label: "Breather", sub: "Long Weekends", icon: Palmtree, href: "/breather" },
              { label: "Pantry", sub: "Hostel Restock", icon: ShoppingCart, href: "/pantry" },
              { label: "Circles", sub: "Clubs & Societies", icon: Users, href: "/circles" },
              { label: "Buzz", sub: "Campus Fests & Events", icon: PartyPopper, href: "/buzz" },
              { label: "Quad", sub: "Campus Social Feed", icon: MessageSquareQuote, href: "/quad" },
              { label: "Sage", sub: "AI Student Advisor", icon: Wand2, href: "/sage" },
              { label: "Compass", sub: "In-App Student Guide", icon: Compass, href: "/guide" },
            ].map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:bg-[var(--surface-sunken)] hover:border-[var(--primary)]/40 transition-colors group"
                >
                  <div className="p-2 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-[var(--primary-foreground)] transition-colors">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {mod.label}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] truncate">{mod.sub}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
