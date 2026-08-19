import { createFileRoute } from "@tanstack/react-router";

import { PageShell, PlaceholderPanel } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Bookly" },
      { name: "description", content: "Manage appointments and staff availability on a shared calendar." },
      { property: "og:title", content: "Calendar — Bookly" },
      { property: "og:description", content: "Manage appointments and staff availability on a shared calendar." },
    ],
  }),
  component: () => (
    <PageShell title="Calendar" description="Appointments, availability and shift planning.">
      <PlaceholderPanel label="Calendar" />
    </PageShell>
  ),
});
