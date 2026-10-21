import { createFileRoute } from "@tanstack/react-router";

import { HomeV2 } from "@/components/site-v2/home-v2";

// A second homepage design (Stripe-style) to compare with the main one at /. Not indexed.
export const Route = createFileRoute("/v2")({
  head: () => ({
    meta: [
      { title: "Bookly — Booking software for salons, barbers and spas" },
      {
        name: "description",
        content:
          "Online booking, calendar, checkout, clients and your team in one place. Built for salons, barbers, spas and studios.",
      },
      { name: "robots", content: "noindex" },
    ],
    // Inter's thin weight for the display type (the app loads 400–700).
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400&display=swap",
      },
    ],
  }),
  component: HomeV2,
});
