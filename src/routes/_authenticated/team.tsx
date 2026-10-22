import { createFileRoute } from "@tanstack/react-router";

import { PayRunsPage, TimesheetsPage } from "@/components/team/pay-pages";
import { ScheduledShifts } from "@/components/team/scheduled-shifts";
import { TeamMembersList } from "@/components/team/team-members-list";
import { sectionTitle } from "@/components/nav/nav-items";

const TABS = ["members", "shifts", "timesheets", "payruns"] as const;
type TeamTab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/team")({
  validateSearch: (search: Record<string, unknown>): { tab?: TeamTab } =>
    typeof search["tab"] === "string" && (TABS as readonly string[]).includes(search["tab"])
      ? { tab: search["tab"] as TeamTab }
      : {},
  head: ({ match }) => ({
    meta: [
      { title: `${sectionTitle("team", match.search.tab)} — Bookly` },
      { name: "description", content: "Team members, scheduled shifts, timesheets and pay runs." },
    ],
  }),
  component: TeamPage,
});


function TeamPage() {
  const { tab = "members" } = Route.useSearch();
  return (
    <div className="min-h-full w-full bg-white">
      <div className="w-full px-8 pb-10 pt-8">
        {tab === "shifts" ? (
          <ScheduledShifts />
        ) : tab === "timesheets" ? (
          <TimesheetsPage />
        ) : tab === "payruns" ? (
          <PayRunsPage />
        ) : (
          <TeamMembersList />
        )}
      </div>
    </div>
  );
}
