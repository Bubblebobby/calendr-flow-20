import { createFileRoute } from "@tanstack/react-router";

import { PageShell, PlaceholderPanel } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/online-booking")({
  head: () => ({
    meta: [
      { title: "Online Booking — Bookly" },
      { name: "description", content: "Your public booking link, availability and booking preferences." },
      { property: "og:title", content: "Online Booking — Bookly" },
      { property: "og:description", content: "Your public booking link, availability and booking preferences." },
    ],
  }),
  component: () => (
    <PageShell title="Online Booking" description="Your public booking link and booking preferences.">
      <PlaceholderPanel label="Online booking" />
    </PageShell>
  ),
});
