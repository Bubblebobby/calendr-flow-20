import { createFileRoute } from "@tanstack/react-router";

import { ClientsList } from "@/components/clients/clients-list";
import {
  ClientLoyalty,
  ClientSegments,
  OnlineReputation,
} from "@/components/clients/clients-extra-pages";

const TABS = ["list", "segments", "loyalty", "reviews"] as const;
type ClientsTab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/clients")({
  validateSearch: (search: Record<string, unknown>): { tab?: ClientsTab } =>
    typeof search["tab"] === "string" && (TABS as readonly string[]).includes(search["tab"])
      ? { tab: search["tab"] as ClientsTab }
      : {},
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
  const { tab = "list" } = Route.useSearch();
  return (
    <div className="min-h-full w-full bg-white">
      <div className="mx-auto w-full max-w-6xl px-8 py-10">
        {tab === "segments" ? (
          <ClientSegments />
        ) : tab === "loyalty" ? (
          <ClientLoyalty />
        ) : tab === "reviews" ? (
          <OnlineReputation />
        ) : (
          <ClientsList />
        )}
      </div>
    </div>
  );
}
