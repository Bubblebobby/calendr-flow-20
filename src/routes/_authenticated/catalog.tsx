import { createFileRoute, Link } from "@tanstack/react-router";

import { PageShell, PlaceholderPanel } from "@/components/page-shell";
import { cn } from "@/lib/utils";

type CatalogTab = "services" | "packages" | "products" | "inventory";
type InventoryTab = "stock-take" | "suppliers" | "stock-orders";

const tabs: { key: CatalogTab; label: string }[] = [
  { key: "services", label: "Services" },
  { key: "packages", label: "Packages" },
  { key: "products", label: "Products" },
  { key: "inventory", label: "Inventory" },
];

const inventoryTabs: { key: InventoryTab; label: string }[] = [
  { key: "stock-take", label: "Stock take" },
  { key: "suppliers", label: "Suppliers" },
  { key: "stock-orders", label: "Stock orders" },
];

export const Route = createFileRoute("/_authenticated/catalog")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (tabs.some((t) => t.key === search["tab"]) ? search["tab"] : "services") as CatalogTab,
    sub: (inventoryTabs.some((t) => t.key === search["sub"])
      ? search["sub"]
      : "stock-take") as InventoryTab,
  }),
  head: () => ({
    meta: [
      { title: "Catalog — Bookly" },
      { name: "description", content: "Services, packages, products and inventory offered by your business." },
      { property: "og:title", content: "Catalog — Bookly" },
      { property: "og:description", content: "Services, packages, products and inventory offered by your business." },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const { tab, sub } = Route.useSearch();

  return (
    <PageShell title="Catalog" description="Services, packages, products and stock in one place.">
      <div className="-mt-4 flex gap-1 border-b border-border">
        {tabs.map((item) => (
          <Link
            key={item.key}
            to="/catalog"
            search={{ tab: item.key, sub }}
            className={cn(
              "-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              tab === item.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="mt-6">
        {tab === "services" ? <PlaceholderPanel label="Services" /> : null}
        {tab === "packages" ? <PlaceholderPanel label="Packages" /> : null}
        {tab === "products" ? <PlaceholderPanel label="Products" /> : null}
        {tab === "inventory" ? (
          <div>
            <div className="flex flex-wrap gap-2">
              {inventoryTabs.map((item) => (
                <Link
                  key={item.key}
                  to="/catalog"
                  search={{ tab: "inventory", sub: item.key }}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    sub === item.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-6">
              <PlaceholderPanel
                label={inventoryTabs.find((item) => item.key === sub)?.label ?? "Inventory"}
              />
            </div>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
