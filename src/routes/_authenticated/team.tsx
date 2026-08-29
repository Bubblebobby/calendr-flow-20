import { createFileRoute } from "@tanstack/react-router";

import { TeamMembersList } from "@/components/team/team-members-list";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "members", label: "Team members" },
  { key: "shifts", label: "Scheduled shifts" },
  { key: "timesheets", label: "Timesheets" },
] as const;

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team members — Bookly" },
      {
        name: "description",
        content: "Invite staff, manage permission roles and track invite status for your business.",
      },
      { property: "og:title", content: "Team members — Bookly" },
      {
        property: "og:description",
        content: "Invite staff, manage permission roles and track invite status for your business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  return (
    <div className="min-h-full w-full bg-white">
      <div className="mx-auto w-full max-w-6xl px-8 py-10">
        <nav className="mb-8 flex items-center gap-2 border-b border-border">
          {TABS.map((tab, index) => (
            <span
              key={tab.key}
              className={cn(
                "-mb-px border-b-2 px-4 py-3 text-sm font-semibold",
                index === 0
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground",
              )}
            >
              {tab.label}
            </span>
          ))}
        </nav>
        <TeamMembersList />
      </div>
    </div>
  );
}
