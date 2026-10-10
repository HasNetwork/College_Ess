"use client";

import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { INITIAL_WARDROBE, type WardrobeItem } from "@/lib/mock-data";
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Plus,
  RefreshCw,
  Shirt,
  Sparkles,
  Tag,
} from "lucide-react";
import { useState } from "react";

export default function DripPage() {
  const [items, setItems] = useState<WardrobeItem[]>(INITIAL_WARDROBE);
  const [activeTab, setActiveTab] = useState<"All" | "Top" | "Bottom" | "Shoes" | "Laundry">("All");

  const logWear = (id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextWears = Math.max(0, item.wearsLeft - 1);
        return {
          ...item,
          wearsLeft: nextWears,
          inLaundry: nextWears === 0,
        };
      }),
    );
  };

  const washItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          wearsLeft: item.maxWears,
          inLaundry: false,
        };
      }),
    );
  };

  const washAllLaundry = () => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        wearsLeft: item.maxWears,
        inLaundry: false,
      })),
    );
  };

  const filteredItems = items.filter((item) => {
    if (activeTab === "Laundry") return item.inLaundry;
    if (activeTab === "All") return !item.inLaundry;
    return item.type === activeTab && !item.inLaundry;
  });

  const laundryCount = items.filter((i) => i.inLaundry).length;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)]">
                <Shirt className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Drip · Wardrobe & Outfits
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              Track wear counts, plan daily campus outfits, and never run out of clean clothes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {laundryCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20">
                <AlertTriangle className="h-3.5 w-3.5" /> {laundryCount} in laundry
              </span>
            )}
          </div>
        </div>

        {/* Outfit of the Day Generator Showcase */}
        <div className="p-5 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--primary)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Suggested Outfit for Today&apos;s Lab
              </h2>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Matched with Distributed Systems Lab &amp; pleasant 24°C campus weather.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-[var(--surface-raised)] p-2.5 rounded-[var(--radius-lg)] border border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)]">
              <span className="text-xl">👔</span>
              <span>Oxford Navy Shirt</span>
            </div>
            <span className="text-[var(--text-muted)]">+</span>
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)]">
              <span className="text-xl">👖</span>
              <span>Khaki Chinos</span>
            </div>
            <Button size="sm" className="h-8 text-xs ml-2" onClick={() => { logWear("drip-1"); logWear("drip-3"); }}>
              Wear Both Today
            </Button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2 text-xs">
          <div className="flex items-center gap-1 overflow-x-auto">
            {(["All", "Top", "Bottom", "Shoes", "Laundry"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-[var(--radius-md)] cursor-pointer font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs"
                    : "bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] border border-[var(--border-subtle)]"
                }`}
              >
                {tab === "Laundry" ? `🧺 Laundry Basket (${laundryCount})` : tab}
              </button>
            ))}
          </div>

          {activeTab === "Laundry" && laundryCount > 0 && (
            <Button size="sm" variant="outline" onClick={washAllLaundry} className="text-xs h-7 gap-1">
              <RefreshCw className="h-3 w-3" /> Wash All Clean
            </Button>
          )}
        </div>

        {/* Wardrobe Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredItems.length === 0 ? (
            <div className="col-span-full p-8 text-center rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-muted)] text-sm">
              {activeTab === "Laundry"
                ? "Your laundry basket is completely empty! Everything is clean."
                : "No garments found in this category."}
            </div>
          ) : (
            filteredItems.map((garment) => {
              const wearPercent = (garment.wearsLeft / garment.maxWears) * 100;
              return (
                <div
                  key={garment.id}
                  className="p-4 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)] flex flex-col justify-between gap-3 group hover:border-[var(--primary)]/40 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-3xl p-2 rounded-lg bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                        {garment.emoji}
                      </div>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                        {garment.tag}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        {garment.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mt-0.5">
                        <span>{garment.colorName}</span>
                        <span>•</span>
                        <span>{garment.type}</span>
                      </div>
                    </div>

                    {/* Wear bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--text-muted)]">Wear health:</span>
                        <span
                          className={`font-semibold ${
                            garment.wearsLeft === 0
                              ? "text-[var(--destructive)]"
                              : garment.wearsLeft === 1
                              ? "text-[var(--warning)]"
                              : "text-[var(--success)]"
                          }`}
                        >
                          {garment.wearsLeft} of {garment.maxWears} wears left
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[var(--surface-sunken)] overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            garment.wearsLeft === 0
                              ? "bg-[var(--destructive)]"
                              : garment.wearsLeft === 1
                              ? "bg-[var(--warning)]"
                              : "bg-[var(--primary)]"
                          }`}
                          style={{ width: `${wearPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-subtle)]">
                    {garment.inLaundry ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => washItem(garment.id)}
                        className="w-full text-xs gap-1.5"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Wash & Reset
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => logWear(garment.id)}
                        className="w-full text-xs"
                      >
                        Log Wear Today (-1)
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
