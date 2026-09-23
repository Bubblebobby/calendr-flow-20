import { createFileRoute } from "@tanstack/react-router";

import { SalesList } from "@/components/sales/sales-list";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Sales — Bookly" },
      {
        name: "description",
        content: "Record sales, review payments and manage drafts for your business.",
      },
      { property: "og:title", content: "Sales — Bookly" },
      {
        property: "og:description",
        content: "Record sales, review payments and manage drafts for your business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SalesPage,
});

function SalesPage() {
  return (
    <div className="min-h-full w-full bg-white">
      <div className="mx-auto w-full max-w-6xl px-8 py-10">
        <SalesList />
      </div>
    </div>
  );
}
