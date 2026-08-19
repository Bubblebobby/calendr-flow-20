import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, CalendarDays, Receipt, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bookly — Booking & scheduling for growing businesses" },
      {
        name: "description",
        content:
          "Bookly is a booking and scheduling platform for managing appointments, clients, catalog, sales and your team in one dashboard.",
      },
      { property: "og:title", content: "Bookly — Booking & scheduling for growing businesses" },
      {
        property: "og:description",
        content: "Manage appointments, clients, catalog, sales and your team in one clean dashboard.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  { title: "Smart calendar", body: "Appointments and staff availability in one shared view.", icon: CalendarDays },
  { title: "Client records", body: "Every customer, contact detail and booking history.", icon: Users },
  { title: "Sales & catalog", body: "Services, pricing and revenue tracking built in.", icon: Receipt },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarCheck className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">Bookly</span>
        </div>
        <Button asChild variant="outline">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main>
        <section className="mx-auto w-full max-w-3xl px-6 pb-16 pt-20 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">Booking platform</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Run your bookings, clients and sales from one dashboard
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
            A clean, professional workspace for scheduling appointments, managing your catalog and keeping
            your team in sync.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Get started</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="surface-card p-6">
              <feature.icon className="size-5 text-primary" />
              <h2 className="mt-4 text-sm font-semibold text-foreground">{feature.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
