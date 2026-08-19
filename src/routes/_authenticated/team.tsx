import { createFileRoute } from "@tanstack/react-router";

import { PageShell, PlaceholderPanel } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team — Bookly" },
      { name: "description", content: "Staff members, roles and permissions for your business." },
      { property: "og:title", content: "Team — Bookly" },
      { property: "og:description", content: "Staff members, roles and permissions for your business." },
    ],
  }),
  component: () => (
    <PageShell title="Team" description="Staff members, roles and permissions.">
      <PlaceholderPanel label="Team" />
    </PageShell>
  ),
});
