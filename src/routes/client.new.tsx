import { createFileRoute } from "@tanstack/react-router";

import { ClientForm } from "@/components/clients/client-form";
import { requireOnboardedUser } from "@/lib/auth-guard";

export const Route = createFileRoute("/client/new")({
  ssr: false,
  beforeLoad: requireOnboardedUser,
  head: () => ({
    meta: [
      { title: "Add client — Bookly" },
      { name: "description", content: "Add a new client profile to your business." },
      { property: "og:title", content: "Add client — Bookly" },
      {
        property: "og:description",
        content: "Add a new client profile to your business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewClientPage,
});

function NewClientPage() {
  return <ClientForm />;
}
