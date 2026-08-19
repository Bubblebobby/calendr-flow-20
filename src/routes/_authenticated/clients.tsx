import { createFileRoute } from "@tanstack/react-router";

import { PageShell, PlaceholderPanel } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({
    meta: [
      { title: "Clients — Bookly" },
      { name: "description", content: "Client records, contact details and booking history." },
      { property: "og:title", content: "Clients — Bookly" },
      { property: "og:description", content: "Client records, contact details and booking history." },
    ],
  }),
  component: () => (
    <PageShell title="Clients" description="Your customer list, contact details and booking history.">
      <PlaceholderPanel label="Clients" />
    </PageShell>
  ),
});
