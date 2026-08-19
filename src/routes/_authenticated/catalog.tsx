import { createFileRoute } from "@tanstack/react-router";

import { PageShell, PlaceholderPanel } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/catalog")({
  head: () => ({
    meta: [
      { title: "Catalog — Bookly" },
      { name: "description", content: "Services, packages and pricing offered by your business." },
      { property: "og:title", content: "Catalog — Bookly" },
      { property: "og:description", content: "Services, packages and pricing offered by your business." },
    ],
  }),
  component: () => (
    <PageShell title="Catalog" description="Services, packages, durations and pricing.">
      <PlaceholderPanel label="Catalog" />
    </PageShell>
  ),
});
