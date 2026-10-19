import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { FeatureIntro } from "@/components/sales/list-ui";
import { ScheduledShifts } from "@/components/team/scheduled-shifts";
import { TeamMembersList } from "@/components/team/team-members-list";

const TABS = ["members", "shifts", "timesheets", "payruns"] as const;
type TeamTab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/team")({
  validateSearch: (search: Record<string, unknown>): { tab?: TeamTab } =>
    typeof search["tab"] === "string" && (TABS as readonly string[]).includes(search["tab"])
      ? { tab: search["tab"] as TeamTab }
      : {},
  head: () => ({
    meta: [
      { title: "Team — Bookly" },
      { name: "description", content: "Team members, scheduled shifts, timesheets and pay runs." },
    ],
  }),
  component: TeamPage,
});

const later = (feature: string) => () => toast(`${feature} is coming in a later update`);

function TeamPage() {
  const { tab = "members" } = Route.useSearch();
  return (
    <div className="min-h-full w-full bg-white">
      <div className="w-full px-8 pb-10 pt-8">
        {tab === "shifts" ? (
          <ScheduledShifts />
        ) : tab === "timesheets" ? (
          <FeatureIntro
            title="Simple time tracking and attendance"
            body="Track your team's working hours and make pay calculations straightforward."
            bullets={["Record hours and breaks as they happen", "Feeds straight into pay runs", "See attendance and punctuality at a glance"]}
            onStart={later("Timesheets")}
          />
        ) : tab === "payruns" ? (
          <FeatureIntro
            title="Pay your team without the spreadsheets"
            body="Bring wages, commissions and tips together so paying your team takes minutes."
            bullets={["Wages, commissions and tips in one pay run", "Add bonuses and adjustments", "Share an earnings report with each team member"]}
            onStart={later("Pay runs")}
          />
        ) : (
          <TeamMembersList />
        )}
      </div>
    </div>
  );
}
