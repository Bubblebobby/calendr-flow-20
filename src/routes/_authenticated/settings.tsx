import { createFileRoute } from "@tanstack/react-router";

import { PageShell } from "@/components/page-shell";
import { BusinessHoursPanel } from "@/components/settings/business-hours-panel";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Business hours — Bookly" },
      {
        name: "description",
        content: "Set the opening and closing times your business runs on each day of the week.",
      },
      { property: "og:title", content: "Business hours — Bookly" },
      {
        property: "og:description",
        content: "Set the opening and closing times your business runs on each day of the week.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PageShell
      title="Business hours"
      description="Set when your business is open each day. The calendar only allows bookings inside these hours."
    >
      <BusinessHoursPanel />
    </PageShell>
  ),
});
