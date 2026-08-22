import { createFileRoute } from "@tanstack/react-router";

import { PageShell, PlaceholderPanel } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — Bookly" },
      { name: "description", content: "Daily overview of your bookings, sales and team activity." },
      { property: "og:title", content: "Home — Bookly" },
      { property: "og:description", content: "Daily overview of your bookings, sales and team activity." },
    ],
  }),
  component: () => (
    <PageShell title="Home" description="Your daily overview across bookings, sales and team.">
      <PlaceholderPanel label="Home" />
    </PageShell>
  ),
});
