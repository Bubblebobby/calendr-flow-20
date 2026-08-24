import { createFileRoute } from "@tanstack/react-router";

import { ClientsList } from "@/components/clients/clients-list";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({
    meta: [
      { title: "Clients list — Bookly" },
      { name: "description", content: "View, add, edit and delete your client's details." },
      { property: "og:title", content: "Clients list — Bookly" },
      {
        property: "og:description",
        content: "View, add, edit and delete your client's details.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  return (
    <div className="min-h-full w-full bg-white">
      <div className="mx-auto w-full max-w-6xl px-8 py-10">
        <ClientsList />
      </div>
    </div>
  );
}
