import { createFileRoute } from "@tanstack/react-router";

import { TeamMemberForm } from "@/components/team/team-member-form";
import { requireOnboardedUser } from "@/lib/auth-guard";

export const Route = createFileRoute("/team/new")({
  ssr: false,
  beforeLoad: requireOnboardedUser,
  head: () => ({
    meta: [
      { title: "Add team member — Bookly" },
      {
        name: "description",
        content: "Add a team member, set their profile details and send them an invite.",
      },
      { property: "og:title", content: "Add team member — Bookly" },
      {
        property: "og:description",
        content: "Add a team member, set their profile details and send them an invite.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewTeamMemberPage,
});

function NewTeamMemberPage() {
  return <TeamMemberForm />;
}
