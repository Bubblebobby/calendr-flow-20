import { createFileRoute } from "@tanstack/react-router";

import { ClientForm } from "@/components/clients/client-form";
import { requireOnboardedUser } from "@/lib/auth-guard";

export const Route = createFileRoute("/client/$clientId")({
  ssr: false,
  beforeLoad: requireOnboardedUser,
  head: () => ({
    meta: [
      { title: "Edit client — Bookly" },
      { name: "description", content: "Update a client's contact details and preferences." },
      { property: "og:title", content: "Edit client — Bookly" },
      {
        property: "og:description",
        content: "Update a client's contact details and preferences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EditClientPage,
});

function EditClientPage() {
  const { clientId } = Route.useParams();
  return <ClientForm clientId={clientId} />;
}
