import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "@/components/site/home-page";
import { ICON_FONT_URL } from "@/components/site/site-styles";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bookly — Booking software for salons, barbers and spas" },
      {
        name: "description",
        content:
          "Online booking, calendar, checkout, clients and your team in one place. Built for salons, barbers, spas and studios.",
      },
      { property: "og:title", content: "Bookly — Booking software for salons, barbers and spas" },
      {
        property: "og:description",
        content: "Booking software that keeps your chairs full.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    // Display serif, mono and icon font for the marketing page only (the app uses Inter alone).
    links: [
      { rel: "stylesheet", href: ICON_FONT_URL },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500&family=Newsreader:opsz,wght@6..72,300..600&display=swap",
      },
    ],
  }),
  component: HomePage,
});
