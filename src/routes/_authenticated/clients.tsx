import { createFileRoute } from "@tanstack/react-router";

import { ClientsList } from "@/components/clients/clients-list";
import {
  ClientLoyalty,
  ClientSegments,
  OnlineReputation,
} from "@/components/clients/clients-extra-pages";
import { sectionTitle } from "@/components/nav/nav-items";

const TABS = ["list", "segments", "loyalty", "reviews"] as const;
type ClientsTab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/clients")({
  validateSearch: (search: Record<string, unknown>): { tab?: ClientsTab } =>
    typeof search["tab"] === "string" && (TABS as readonly string[]).includes(search["tab"])
      ? { tab: search["tab"] as ClientsTab }
      : {},
  head: ({ match }) => ({
    meta: [
      { title: `${sectionTitle("clients", match.search.tab)} — Bookly` },
      { name: "description", content: "View, add, edit and delete your client's details." },
      { property: "og:title", content: `${sectionTitle("clients", match.search.tab)} — Bookly` },
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
      <div className="w-full px-8 pb-10 pt-8">
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
