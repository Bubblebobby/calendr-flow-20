import { createFileRoute } from "@tanstack/react-router";

import { ReportsHome, ReportsList } from "@/components/reports/reports-pages";

const VIEWS = ["all", "favourites", "dashboards", "standard"] as const;
type ReportsView = (typeof VIEWS)[number];

export const Route = createFileRoute("/_authenticated/reports")({
  validateSearch: (search: Record<string, unknown>): { view?: ReportsView } =>
    typeof search["view"] === "string" && (VIEWS as readonly string[]).includes(search["view"])
      ? { view: search["view"] as ReportsView }
      : {},
  head: () => ({
    meta: [
      { title: "Reports — Bookly" },
      { name: "description", content: "Sales, appointments, team and client reports." },
    ],
  }),
  component: ReportsRoute,
});

function ReportsRoute() {
  const { view } = Route.useSearch();
  return (
    <div className="min-h-full w-full bg-white">
      <div className="mx-auto w-full max-w-[1088px] px-8 pb-10 pt-8">
        {view ? <ReportsList view={view} /> : <ReportsHome />}
      </div>
    </div>
  );
}
