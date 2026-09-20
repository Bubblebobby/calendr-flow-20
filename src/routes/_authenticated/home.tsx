import { createFileRoute } from "@tanstack/react-router";

import { HomeDashboard } from "@/components/home/home-dashboard";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — Bookly" },
      { name: "description", content: "Daily overview of your bookings, sales and team activity." },
      { property: "og:title", content: "Home — Bookly" },
      { property: "og:description", content: "Daily overview of your bookings, sales and team activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomeDashboard,
});
