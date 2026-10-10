"use client";

import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INITIAL_HABITS, type HabitItem } from "@/lib/mock-data";
import {
  Award,
  CheckCircle2,
  Circle,
  Flame,
  Plus,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

export default function GroovePage() {
  const [habits, setHabits] = useState<HabitItem[]>(INITIAL_HABITS);
  const [newTitle, setNewTitle] = useState("");
  const [newTarget, setNewTarget] = useState("");

  const toggleHabit = (id: string) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const willComplete = !h.completedToday;
        return {
          ...h,
          completedToday: willComplete,
          streak: willComplete ? h.streak + 1 : Math.max(0, h.streak - 1),
        };
      }),
    );
  };

  const addHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newH: HabitItem = {
      id: `groove-${Date.now()}`,
      title: newTitle.trim(),
      target: newTarget.trim() || "Daily",
      streak: 1,
      completedToday: true,
      category: "Personal",
      history: [false, false, false, false, false, false, true],
    };

    setHabits([...habits, newH]);
    setNewTitle("");
    setNewTarget("");
  };

  const totalStreaks = habits.reduce((acc, curr) => acc + curr.streak, 0);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-[var(--warning)]/10 text-[var(--warning)]">
                <Flame className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Groove · Habit Builder &amp; Streaks
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              Habits that stick. Exam and holiday days pause rather than break your momentum.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20">
              <Flame className="h-4 w-4" /> {totalStreaks} Total Streak Days
            </span>
          </div>
        </div>

        {/* Add Habit Form */}
        <form
          onSubmit={addHabit}
          className="p-4 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)] flex flex-col sm:flex-row gap-2"
        >
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New habit name (e.g. Read 10 pages, DSA, 8 hrs sleep...)"
            className="text-sm flex-1"
          />
          <Input
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            placeholder="Target (e.g. 30 mins)"
            className="text-sm sm:w-40"
          />
          <Button type="submit" size="sm" className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" /> Add Habit
          </Button>
        </form>

        {/* Habits List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-1">
            <span>TODAY&apos;S HABIT CHECKLIST</span>
            <span>LAST 7 DAYS</span>
          </div>

          {habits.map((habit) => (
            <div
              key={habit.id}
              className={`p-4 rounded-[var(--radius-xl)] border transition-all ${
                habit.completedToday
                  ? "bg-[var(--surface-card)] border-[var(--success)]/40 shadow-xs"
                  : "bg-[var(--surface-card)] border-[var(--border-subtle)]"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div
                  onClick={() => toggleHabit(habit.id)}
                  className="flex items-center gap-3 cursor-pointer flex-1"
                >
                  {habit.completedToday ? (
                    <CheckCircle2 className="h-6 w-6 text-[var(--success)] shrink-0 transition-transform scale-110" />
                  ) : (
                    <Circle className="h-6 w-6 text-[var(--text-muted)] hover:text-[var(--primary)] shrink-0" />
                  )}

                  <div>
                    <h2
                      className={`text-sm font-semibold ${
                        habit.completedToday
                          ? "line-through text-[var(--text-muted)]"
                          : "text-[var(--text-primary)]"
                      }`}
                    >
                      {habit.title}
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
                      <span>{habit.target}</span>
                      <span>•</span>
                      <span>{habit.category}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 justify-between sm:justify-end">
                  {/* 7-day mini tracker circles */}
                  <div className="flex items-center gap-1">
                    {habit.history.map((done, i) => (
                      <div
                        key={i}
                        className={`size-2.5 rounded-full ${
                          done ? "bg-[var(--success)]" : "bg-[var(--surface-sunken)]"
                        }`}
                        title={`Day ${i + 1}: ${done ? "Completed" : "Missed"}`}
                      />
                    ))}
                  </div>

                  {/* Streak flame badge */}
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--warning)]/10 text-[var(--warning)] font-bold text-xs shrink-0">
                    <Flame className="h-4 w-4" />
                    <span>{habit.streak} days</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
