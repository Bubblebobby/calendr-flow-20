import { createFileRoute } from "@tanstack/react-router";

import { DayCalendar } from "@/components/calendar/day-calendar";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Bookly" },
      {
        name: "description",
        content: "A day view of every team member's schedule, aligned to your business hours.",
      },
      { property: "og:title", content: "Calendar — Bookly" },
      {
        property: "og:description",
        content: "A day view of every team member's schedule, aligned to your business hours.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <DayCalendar />,
});
