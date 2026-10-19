import { createFileRoute } from "@tanstack/react-router";

import {
  CatalogPackages,
  CatalogProducts,
  CatalogStockOrders,
  CatalogStocktakes,
  CatalogSuppliers,
} from "@/components/catalog/catalog-extra-pages";
import { ServiceMenu } from "@/components/catalog/service-menu";

const TABS = ["services", "packages", "products", "stocktakes", "orders", "suppliers"] as const;
type CatalogTab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/catalog")({
  validateSearch: (search: Record<string, unknown>): { tab?: CatalogTab } =>
    typeof search["tab"] === "string" && (TABS as readonly string[]).includes(search["tab"])
      ? { tab: search["tab"] as CatalogTab }
      : {},
  head: () => ({
    meta: [
      { title: "Service menu — Bookly" },
      { name: "description", content: "View and manage the services offered by your business." },
      { property: "og:title", content: "Service menu — Bookly" },
      { property: "og:description", content: "View and manage the services offered by your business." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const { tab = "services" } = Route.useSearch();
  const surface = tab === "services" ? "bg-surface" : "bg-white";
  return (
    <div className={`min-h-full w-full ${surface}`}>
      <div className="mx-auto w-full max-w-[1088px] px-8 pb-10 pt-8">
        {tab === "packages" ? (
          <CatalogPackages />
        ) : tab === "products" ? (
          <CatalogProducts />
        ) : tab === "stocktakes" ? (
          <CatalogStocktakes />
        ) : tab === "orders" ? (
          <CatalogStockOrders />
        ) : tab === "suppliers" ? (
          <CatalogSuppliers />
        ) : (
          <ServiceMenu />
        )}
      </div>
    </div>
  );
}
