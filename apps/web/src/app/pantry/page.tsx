"use client";

import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INITIAL_PANTRY, type PantryItem } from "@/lib/mock-data";
import {
  AlertCircle,
  CheckCircle2,
  Package,
  Plus,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import { useState } from "react";

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>(INITIAL_PANTRY);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<PantryItem["category"]>("Snacks");

  const restockItem = (id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status: "In Stock", quantity: "Restocked full" } : i,
      ),
    );
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newItem: PantryItem = {
      id: `pantry-${Date.now()}`,
      name: newName.trim(),
      category: newCategory,
      quantity: "1 pack",
      status: "In Stock",
    };

    setItems([newItem, ...items]);
    setNewName("");
  };

  const lowStockCount = items.filter((i) => i.status !== "In Stock").length;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)]">
                <ShoppingCart className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Pantry · Hostel Groceries &amp; Supplies
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              Track hostel room snacks, dairy, toiletries and auto-generated restocking checklists.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20">
              {lowStockCount} items need restock
            </span>
          </div>
        </div>

        {/* Add Item Form */}
        <form
          onSubmit={addItem}
          className="p-4 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)] flex flex-col sm:flex-row gap-2"
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add item (e.g., Maggi, Green Tea, Biscuits...)"
            className="text-sm flex-1"
          />
          <div className="flex gap-2">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as PantryItem["category"])}
              className="text-xs px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-primary)] cursor-pointer"
            >
              <option value="Snacks">Snacks</option>
              <option value="Dairy & Drinks">Dairy &amp; Drinks</option>
              <option value="Essentials">Essentials</option>
            </select>
            <Button type="submit" size="sm" className="gap-1.5 shrink-0">
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </div>
        </form>

        {/* Inventory List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] px-1">
            <span>ROOM PANTRY INVENTORY</span>
            <span>{items.length} ITEMS</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--primary)]/30 transition-colors shadow-xs flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-2 py-0.5 rounded bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                      {item.category}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        item.status === "In Stock"
                          ? "bg-[var(--success)]/10 text-[var(--success)]"
                          : item.status === "Low Stock"
                          ? "bg-[var(--warning)]/10 text-[var(--warning)]"
                          : "bg-[var(--destructive)]/10 text-[var(--destructive)]"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mt-2">
                    {item.name}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{item.quantity}</p>

                  {item.expiryWarning && (
                    <div className="flex items-center gap-1 text-[11px] text-[var(--warning)] mt-1.5 font-medium">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {item.expiryWarning}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)]">
                  {item.status !== "In Stock" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restockItem(item.id)}
                      className="w-full text-xs gap-1.5"
                    >
                      <RefreshCw className="h-3 w-3" /> Mark Restocked
                    </Button>
                  ) : (
                    <div className="text-[11px] text-[var(--text-muted)] text-center py-1">
                      ✓ Stocked
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
