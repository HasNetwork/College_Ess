"use client";

import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INITIAL_POSTS, type SocialPost } from "@/lib/mock-data";
import {
  Heart,
  MessageCircle,
  MessageSquareQuote,
  Send,
  Share2,
  Sparkles,
  ThumbsUp,
} from "lucide-react";
import { useState } from "react";

export default function QuadPage() {
  const [posts, setPosts] = useState<SocialPost[]>(INITIAL_POSTS);
  const [newContent, setNewContent] = useState("");

  const upvotePost = (id: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, upvotes: p.upvotes + 1 } : p)),
    );
  };

  const createPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    const newP: SocialPost = {
      id: `post-${Date.now()}`,
      author: "Harshit",
      handle: "@harshit_cs",
      timeAgo: "Just now",
      tag: "General",
      content: newContent.trim(),
      upvotes: 1,
      commentsCount: 0,
    };

    setPosts([newP, ...posts]);
    setNewContent("");
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)]">
                <MessageSquareQuote className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Quad · Campus Social Feed
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              Real-time discussions, announcements, lost &amp; found, and peer banter.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
              NIT Campus Community
            </span>
          </div>
        </div>

        {/* Stories Avatar Bar */}
        <div className="p-3 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)] flex items-center gap-3 overflow-x-auto no-scrollbar">
          {[
            { name: "You", initial: "H", ring: false },
            { name: "Wave '26", initial: "🌊", ring: true },
            { name: "GDG NIT", initial: "💻", ring: true },
            { name: "Thespians", initial: "🎭", ring: true },
            { name: "SAC Council", initial: "🏛️", ring: true },
            { name: "Robotics", initial: "🤖", ring: false },
          ].map((st, i) => (
            <div key={i} className="flex flex-col items-center gap-1 shrink-0 cursor-pointer">
              <div
                className={`size-12 rounded-full flex items-center justify-center font-bold text-sm bg-[var(--surface-raised)] transition-transform hover:scale-105 ${
                  st.ring ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface-canvas)]" : "border border-[var(--border-subtle)]"
                }`}
              >
                {st.initial}
              </div>
              <span className="text-[10px] text-[var(--text-secondary)] font-medium max-w-[50px] truncate">
                {st.name}
              </span>
            </div>
          ))}
        </div>

        {/* Create Post Input */}
        <form
          onSubmit={createPost}
          className="p-4 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)] space-y-3"
        >
          <Input
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Share something with your college batch..."
            className="text-sm"
          />
          <div className="flex justify-between items-center text-xs">
            <span className="text-[var(--text-muted)]">Visible to enrolled students only</span>
            <Button type="submit" size="sm" className="gap-1.5">
              <Send className="h-3.5 w-3.5" /> Post to Quad
            </Button>
          </div>
        </form>

        {/* Feed Posts */}
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="p-5 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)] space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-bold flex items-center justify-center text-xs">
                    {post.author[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-[var(--text-primary)]">
                      {post.author}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">
                      {post.handle} • {post.timeAgo}
                    </div>
                  </div>
                </div>

                <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--border-subtle)] font-medium">
                  {post.tag}
                </span>
              </div>

              <p className="text-sm text-[var(--text-primary)] leading-relaxed">{post.content}</p>

              {/* Interaction Row */}
              <div className="flex items-center gap-6 pt-2 border-t border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                <button
                  type="button"
                  onClick={() => upvotePost(post.id)}
                  className="flex items-center gap-1.5 hover:text-[var(--primary)] transition-colors cursor-pointer"
                >
                  <ThumbsUp className="h-4 w-4" />
                  <span>{post.upvotes}</span>
                </button>

                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <MessageCircle className="h-4 w-4" />
                  <span>{post.commentsCount} comments</span>
                </div>

                <button
                  type="button"
                  className="flex items-center gap-1.5 hover:text-[var(--primary)] transition-colors cursor-pointer ml-auto text-[var(--text-muted)]"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
