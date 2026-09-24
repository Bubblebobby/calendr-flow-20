import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { DailySalesSummary } from "@/components/sales/daily-sales-summary";
import { SalesList } from "@/components/sales/sales-list";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Sales — Bookly" },
      { name: "description", content: "Daily sales summary, transactions and cash movement." },
      { property: "og:title", content: "Sales — Bookly" },
      { property: "og:description", content: "Daily sales summary, transactions and cash movement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SalesPage,
});

type SalesSection = "daily" | "sales";

const TOP_ITEMS: { id: SalesSection | string; label: string }[] = [
  { id: "daily", label: "Daily sales summary" },
  { id: "register", label: "Register" },
  { id: "appointments", label: "Appointments" },
  { id: "sales", label: "Sales" },
  { id: "payments", label: "Payments" },
];

const SOLD_ITEMS: { id: string; label: string }[] = [
  { id: "sold-items", label: "Sold items" },
  { id: "gift-cards", label: "Gift cards sold" },
  { id: "packages", label: "Packages sold" },
  { id: "memberships", label: "Memberships sold" },
];

function SalesPage() {
  const [section, setSection] = useState<SalesSection>("daily");

  const itemClass = (active: boolean) =>
    cn(
      "block w-full rounded-lg px-4 py-2 text-left text-sm font-medium transition-colors",
      active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted/70",
    );

  return (
    <div className="flex min-h-full w-full">
      {/* Sales submenu */}
      <aside className="w-56 shrink-0 border-r border-border px-4 py-8">
        <p className="px-4 text-sm font-semibold text-foreground">Sales</p>
        <nav className="mt-4 space-y-1">
          {TOP_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={itemClass(section === item.id)}
              onClick={() =>
                item.id === "daily" || item.id === "sales"
                  ? setSection(item.id as SalesSection)
                  : toast(`${item.label} — coming soon`)
              }
            >
              {item.label}
            </button>
          ))}
        </nav>
        <p className="mt-6 border-t border-border px-4 pt-5 text-sm font-bold text-foreground">
          Sold items
        </p>
        <nav className="mt-3 space-y-1">
          {SOLD_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={itemClass(false)}
              onClick={() => toast(`${item.label} — coming soon`)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="min-w-0 flex-1 px-8 py-10">
        {section === "daily" ? <DailySalesSummary /> : <SalesList />}
      </div>
    </div>
  );
}
