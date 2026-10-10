"use client";

import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  KeyRound,
  Send,
  Shirt,
  Sparkles,
  User,
  Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";

interface Message {
  id: string;
  sender: "user" | "sage";
  text: string;
  time: string;
  isLiveAi?: boolean;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "m-1",
    sender: "sage",
    text: "Hey Harshit! I'm Sage, your AI collegiate advisor powered by Google Gemini. I have real-time context on your timetable, upcoming Midsems, wardrobe, and club commitments. How can I assist your schedule today?",
    time: "10:00 AM",
  },
];

const PRESET_QUERIES = [
  "What is my schedule for today?",
  "How should I prepare for the Distributed Systems exam?",
  "What outfit should I wear for tomorrow's lab?",
  "Can you help me balance Drama rehearsals and study hours?",
];

export default function SagePage() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKeyModal, setShowKeyModal] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("clg_ess_gemini_key");
    if (saved) setApiKey(saved);
  }, []);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem("clg_ess_gemini_key", key);
    setShowKeyModal(false);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: text.trim(),
      time: "Just now",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      // Call the Google GenAI backend route
      const res = await fetch("/api/sage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text.trim(),
          apiKey: apiKey || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: `sage-${Date.now()}`,
            sender: "sage",
            text: data.reply,
            time: "Just now",
            isLiveAi: true,
          },
        ]);
        setIsTyping(false);
        return;
      }
    } catch {
      // Graceful fallback to built-in student context simulation
    }

    // Fallback contextual response if no API key is provided or offline
    setTimeout(() => {
      let reply =
        "I analyzed your campus context and timeline. Everything is aligned in your College Ess modules.";

      if (text.toLowerCase().includes("schedule")) {
        reply =
          "Today is a Class Day. You have CS301 (Algorithms) at 8:30 AM (Done), CS305L (Distributed Systems Lab) in Computing Lab 2 until 12:15 PM, and CS303 (Computer Networks) in LH-101 at 2:00 PM. Drama club rehearsal begins at 4:30 PM!";
      } else if (text.toLowerCase().includes("exam") || text.toLowerCase().includes("distributed")) {
        reply =
          "Your Distributed Systems (CS305) Midsem is in 6 days (Oct 16, 9:30 AM at LH-201, Seat C-42). You have completed Lab 3, but make sure to review Byzantine Fault Tolerance and Raft consensus algorithms before Sunday.";
      } else if (text.toLowerCase().includes("wear") || text.toLowerCase().includes("outfit")) {
        reply =
          "For tomorrow's lab sessions, I recommend your Charcoal Graphic Tee paired with Black Cargo Trousers. Both are fresh in Drip with 2 wears remaining, and suitable for lab safety guidelines!";
      } else if (text.toLowerCase().includes("drama") || text.toLowerCase().includes("balance")) {
        reply =
          "You have 3 open tasks in Circles for Thespians Drama Society. Since rehearsal ends at 6:00 PM today, block 7:30 PM to 10:00 PM for Lab Report wrap-up to protect your 14-day Groove study streak.";
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `sage-${Date.now()}`,
          sender: "sage",
          text: reply,
          time: "Just now",
          isLiveAi: false,
        },
      ]);
      setIsTyping(false);
    }, 600);
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-4 flex flex-col h-[calc(100vh-8.5rem)]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border-subtle)] pb-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)]">
                <Wand2 className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Sage · AI Context Advisor
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              Google Gemini powered assistant with live campus context grounding.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowKeyModal((prev) => !prev)}
              className="text-xs gap-1.5"
            >
              <KeyRound className="h-3.5 w-3.5 text-[var(--primary)]" />
              {apiKey ? "Gemini Key Configured" : "Add Gemini Key"}
            </Button>
          </div>
        </div>

        {/* Bring Your Own Key Bar */}
        {showKeyModal && (
          <div className="p-4 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)] space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <KeyRound className="h-4 w-4 text-[var(--primary)]" /> Bring Your Own Gemini API Key
              </h2>
              <span className="text-[10px] text-[var(--text-muted)]">Saved locally in browser</span>
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your Google AI Studio API key (AIzaSy...)"
                className="text-xs font-mono"
              />
              <Button size="sm" onClick={() => saveApiKey(apiKey)} className="text-xs shrink-0">
                Save Key
              </Button>
            </div>
          </div>
        )}

        {/* Preset Query Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0 text-xs">
          {PRESET_QUERIES.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => sendMessage(q)}
              className="px-3 py-1.5 rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] hover:border-[var(--primary)]/40 hover:bg-[var(--surface-sunken)] text-[var(--text-secondary)] whitespace-nowrap transition-colors cursor-pointer"
            >
              ✨ {q}
            </button>
          ))}
        </div>

        {/* Chat Messages Log */}
        <div className="flex-1 overflow-y-auto space-y-4 p-4 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)]">
          {messages.map((m) => {
            const isUser = m.sender === "user";
            return (
              <div
                key={m.id}
                className={`flex gap-3 max-w-[85%] ${isUser ? "ml-auto flex-row-reverse" : ""}`}
              >
                <div
                  className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
                    isUser
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "bg-[var(--surface-raised)] text-[var(--primary)] border border-[var(--border-subtle)]"
                  }`}
                >
                  {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                <div
                  className={`p-3.5 rounded-[var(--radius-xl)] text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] rounded-tr-xs"
                      : "bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-tl-xs"
                  }`}
                >
                  {m.text}
                  <div
                    className={`text-[10px] mt-1 flex items-center justify-between gap-2 ${
                      isUser
                        ? "text-[var(--primary-foreground)]/70 text-right"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    <span>{m.time}</span>
                    {m.isLiveAi !== undefined && (
                      <span className="font-medium text-[var(--primary)]">
                        {m.isLiveAi ? "⚡ Live Gemini 2.5" : "Context Simulator"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] p-2">
              <Bot className="h-4 w-4 animate-spin text-[var(--primary)]" />
              <span>Sage is consulting your schedule and campus context...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-2 shrink-0"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Sage anything about your timetable, exams, or tasks..."
            className="text-sm flex-1"
          />
          <Button type="submit" size="sm" className="gap-1.5 shrink-0 px-4">
            <Send className="h-4 w-4" /> Send
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
