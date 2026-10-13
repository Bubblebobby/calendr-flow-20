import { createFileRoute } from "@tanstack/react-router";

import { CalendarPage, type CalendarSearch } from "@/components/calendar/calendar-page";
import { VIEW_LABELS, fromDateParam, toDateParam, type CalendarView } from "@/components/calendar/calendar-data";

export const Route = createFileRoute("/_authenticated/calendar")({
  validateSearch: (search: Record<string, unknown>): CalendarSearch => {
    const result: CalendarSearch = {};
    if (typeof search["view"] === "string" && search["view"] in VIEW_LABELS) {
      result.view = search["view"] as CalendarView;
    }
    if (typeof search["date"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search["date"])) {
      result.date = search["date"];
    }
    if (typeof search["team"] === "string" && search["team"]) result.team = search["team"];
    return result;
  },
  head: () => ({
    meta: [
      { title: "Calendar — Bookly" },
      {
        name: "description",
        content: "Day, 3-day, week and month views of every team member's schedule.",
      },
      { property: "og:title", content: "Calendar — Bookly" },
      {
        property: "og:description",
        content: "Day, 3-day, week and month views of every team member's schedule.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarRoute,
});

function CalendarRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const view = search.view ?? "day";
  const anchor = fromDateParam(search.date);
  const selection = search.team ?? "scheduled";

  return (
    <CalendarPage
      view={view}
      anchor={anchor}
      selection={selection}
      onNavigate={(next) =>
        navigate({
          search: (previous) => {
            const merged: CalendarSearch = { ...previous };
            if (next.view) merged.view = next.view;
            if (next.date) merged.date = toDateParam(next.date);
            if (next.team) merged.team = next.team;
            return merged;
          },
          replace: true,
        })
      }
    />
  );
}
