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

const TABS: { id: SalesSection | string; label: string }[] = [
  { id: "daily", label: "Daily sales summary" },
  { id: "register", label: "Register" },
  { id: "appointments", label: "Appointments" },
  { id: "sales", label: "Sales" },
  { id: "payments", label: "Payments" },
  { id: "gift-cards", label: "Gift cards sold" },
  { id: "packages", label: "Packages sold" },
  { id: "memberships", label: "Memberships sold" },
];

function SalesPage() {
  const [section, setSection] = useState<SalesSection>("daily");

  return (
    <div className="min-h-full w-full">
      {/* Sales tabs */}
      <div className="border-b border-border px-8 pt-6">
        <nav className="flex flex-wrap gap-1">
          {TABS.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
                onClick={() =>
                  item.id === "daily" || item.id === "sales"
                    ? setSection(item.id as SalesSection)
                    : toast(`${item.label} — coming soon`)
                }
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="min-w-0 px-8 py-8">
        {section === "daily" ? <DailySalesSummary /> : <SalesList />}
      </div>
    </div>
  );
}
