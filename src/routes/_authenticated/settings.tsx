import { createFileRoute } from "@tanstack/react-router";

import { PageShell, PlaceholderPanel } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Bookly" },
      { name: "description", content: "Business profile, currency, notifications and account settings." },
      { property: "og:title", content: "Settings — Bookly" },
      { property: "og:description", content: "Business profile, currency, notifications and account settings." },
    ],
  }),
  component: () => (
    <PageShell title="Settings" description="Business profile, currency, notifications and account preferences.">
      <PlaceholderPanel label="Settings" />
    </PageShell>
  ),
});
