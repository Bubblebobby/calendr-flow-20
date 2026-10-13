import { createFileRoute } from "@tanstack/react-router";

import { ServiceMenu } from "@/components/catalog/service-menu";

export const Route = createFileRoute("/_authenticated/catalog")({
  head: () => ({
    meta: [
      { title: "Catalog — Bookly" },
      { name: "description", content: "Manage the services offered by your business." },
      { property: "og:title", content: "Catalog — Bookly" },
      { property: "og:description", content: "Manage the services offered by your business." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  return (
    <div className="w-full px-8 pb-10 pt-8">
      <ServiceMenu />
    </div>
  );
}

