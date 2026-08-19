import { createFileRoute } from "@tanstack/react-router";

import { PageShell, PlaceholderPanel } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Sales — Bookly" },
      { name: "description", content: "Payments, invoices and revenue reporting for your business." },
      { property: "og:title", content: "Sales — Bookly" },
      { property: "og:description", content: "Payments, invoices and revenue reporting for your business." },
    ],
  }),
  component: () => (
    <PageShell title="Sales" description="Payments, invoices and revenue reporting.">
      <PlaceholderPanel label="Sales" />
    </PageShell>
  ),
});
