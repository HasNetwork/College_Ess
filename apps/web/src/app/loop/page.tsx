"use client";

import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INITIAL_TASKS, type TaskItem } from "@/lib/mock-data";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Circle,
  Filter,
  ListTodo,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";

export default function LoopPage() {
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [filter, setFilter] = useState<"All" | "Academic" | "Club" | "Personal">("All");
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<TaskItem["category"]>("Academic");
  const [newPriority, setNewPriority] = useState<TaskItem["priority"]>("medium");

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      dueDate: "This week",
      priority: newPriority,
      completed: false,
    };

    setTasks([newTask, ...tasks]);
    setNewTitle("");
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === "All") return true;
    return t.category === filter;
  });

  const pendingCount = tasks.filter((t) => !t.completed).length;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Module Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)]">
                <ListTodo className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Loop · Tasks & To-dos
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              Self-sorting student tasks with cross-module awareness.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] font-medium text-[var(--text-secondary)]">
              {pendingCount} tasks remaining
            </span>
          </div>
        </div>

        {/* AI Intent Suggestion Banner */}
        <div className="flex items-start gap-2.5 p-3 rounded-[var(--radius-lg)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
          <Sparkles className="h-4 w-4 text-[var(--primary)] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-[var(--text-primary)]">Smart classification: </span>
            Typing &ldquo;Physics exam next Tuesday&rdquo; or &ldquo;Drama meet today&rdquo; auto-associates items with <strong>Crunch</strong> or <strong>Circles</strong>.
          </div>
        </div>

        {/* Quick Add Form */}
        <form
          onSubmit={addTask}
          className="p-4 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)] space-y-3"
        >
          <div className="flex gap-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="What needs to be done? (e.g., Lab report, buy stationery...)"
              className="flex-1 text-sm"
            />
            <Button type="submit" size="sm" className="shrink-0 gap-1.5">
              <Plus className="h-4 w-4" /> Add Task
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] font-medium">Category:</span>
              {(["Academic", "Club", "Personal", "Urgent"] as const).map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setNewCategory(cat)}
                  className={`px-2 py-0.5 rounded cursor-pointer border transition-colors ${
                    newCategory === cat
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent font-medium"
                      : "bg-[var(--surface-raised)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] font-medium">Priority:</span>
              {(["low", "medium", "high"] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setNewPriority(p)}
                  className={`capitalize px-2 py-0.5 rounded cursor-pointer border transition-colors ${
                    newPriority === p
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent font-medium"
                      : "bg-[var(--surface-raised)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {(["All", "Academic", "Club", "Personal"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-[var(--radius-md)] cursor-pointer font-medium transition-colors ${
                filter === f
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs"
                  : "bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] border border-[var(--border-subtle)]"
              }`}
            >
              {f} ({f === "All" ? tasks.length : tasks.filter((t) => t.category === f).length})
            </button>
          ))}
        </div>

        {/* Task List */}
        <div className="space-y-2.5">
          {filteredTasks.length === 0 ? (
            <div className="p-8 text-center rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-muted)] text-sm">
              No tasks in this category. You&apos;re all caught up!
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3.5 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--primary)]/30 transition-colors shadow-xs group"
              >
                <div
                  onClick={() => toggleTask(task.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                >
                  {task.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-[var(--success)] shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-[var(--text-muted)] group-hover:text-[var(--primary)] shrink-0" />
                  )}

                  <div className="min-w-0">
                    <span
                      className={`text-sm block truncate ${
                        task.completed
                          ? "line-through text-[var(--text-muted)]"
                          : "text-[var(--text-primary)] font-medium"
                      }`}
                    >
                      {task.title}
                    </span>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--text-muted)]">
                      <span className="px-1.5 py-0.2 rounded bg-[var(--surface-raised)] border border-[var(--border-subtle)] font-medium">
                        {task.category}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {task.dueDate}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      task.priority === "high"
                        ? "bg-[var(--destructive)]/10 text-[var(--destructive)]"
                        : task.priority === "medium"
                        ? "bg-[var(--warning)]/10 text-[var(--warning)]"
                        : "bg-[var(--surface-raised)] text-[var(--text-muted)]"
                    }`}
                  >
                    {task.priority}
                  </span>

                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--destructive)] transition-colors rounded cursor-pointer"
                    aria-label="Delete task"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
