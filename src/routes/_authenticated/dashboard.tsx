import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, TrendingUp, UserPlus, Wallet } from "lucide-react";

import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Bookly" },
      { name: "description", content: "Overview of bookings, revenue and clients for your business." },
      { property: "og:title", content: "Dashboard — Bookly" },
      { property: "og:description", content: "Overview of bookings, revenue and clients for your business." },
    ],
  }),
  component: DashboardPage,
});

const stats = [
  { label: "Today's bookings", value: "—", icon: CalendarClock },
  { label: "Revenue this week", value: "—", icon: Wallet },
  { label: "New clients", value: "—", icon: UserPlus },
  { label: "Utilisation", value: "—", icon: TrendingUp },
];

function DashboardPage() {
  return (
    <PageShell
      title="Dashboard"
      description="A snapshot of your bookings, revenue and team activity."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="surface-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <stat.icon className="size-4 text-primary" />
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="surface-card min-h-64 p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground">Upcoming appointments</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your schedule will appear here once bookings start coming in.
          </p>
        </div>
        <div className="surface-card min-h-64 p-6">
          <h2 className="text-sm font-semibold text-foreground">Activity</h2>
          <p className="mt-2 text-sm text-muted-foreground">No activity yet.</p>
        </div>
      </div>
    </PageShell>
  );
}
