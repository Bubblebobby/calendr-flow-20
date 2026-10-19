import { createFileRoute } from "@tanstack/react-router";

import { ReportPage } from "@/components/reports/reports-pages";
import { reportById } from "@/components/reports/report-definitions";

export const Route = createFileRoute("/_authenticated/reports_/$reportId")({
  head: ({ params }) => ({
    meta: [{ title: `${reportById(params.reportId)?.name ?? "Report"} — Bookly` }],
  }),
  component: ReportRoute,
});

function ReportRoute() {
  const { reportId } = Route.useParams();
  return (
    <div className="min-h-full w-full bg-white">
      <div className="mx-auto w-full max-w-[1184px] px-8 pb-10 pt-8">
        <ReportPage reportId={reportId} />
      </div>
    </div>
  );
}
