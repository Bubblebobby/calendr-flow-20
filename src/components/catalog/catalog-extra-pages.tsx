import { Package, Truck } from "@phosphor-icons/react";
import { toast } from "sonner";

import { EmptyCard, FeatureIntro, pillButton } from "@/components/sales/list-ui";
import { cn } from "@/lib/utils";

const later = (feature: string) => () =>
  toast(`${feature} need their own database tables, coming in a later update`);

/** List-page header with a count bubble next to the title (Fresha's Stock orders / Suppliers). */
function CountHeader({
  title,
  count,
  subtitle,
  action,
}: {
  title: string;
  count: number;
  subtitle: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-3 text-display font-semibold">
          {title}
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-secondary px-2 text-body font-semibold text-muted-foreground">
            {count}
          </span>
        </h1>
        <p className="mt-1 text-body text-muted-foreground">
          {subtitle} <span className="cursor-pointer text-primary hover:underline">Learn more</span>
        </p>
      </div>
      {action}
    </div>
  );
}

export function CatalogPackages() {
  return (
    <FeatureIntro
      title="Increase your average order value with packages"
      body="Encourage clients to spend more and keep coming back by bundling services, products and discounts together."
      bullets={[
        "Incentivise clients to spend more with package purchases",
        "Upsell packages to clients booking online",
        "Track how each benefit is redeemed and control its limits",
      ]}
      onStart={later("Packages")}
      art={
        <div className="rounded-3xl bg-card p-5 shadow-lg">
          <p className="text-heading font-semibold">Spa package</p>
          <p className="text-caption text-muted-foreground">6 sessions included</p>
          <p className="mt-3 text-title font-semibold">₦40,000</p>
          <p className="text-caption font-semibold text-[#1f8a3e]">Save up to ₦10,000</p>
          <div className="mt-4 space-y-2">
            {[
              ["Full body massage", "5 sessions"],
              ["Head massage", "1 session"],
            ].map(([name, sessions]) => (
              <div key={name} className="flex justify-between rounded-xl border border-border px-3 py-2 text-caption">
                <span className="font-medium">{name}</span>
                <span className="text-muted-foreground">{sessions}</span>
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
}

export function CatalogProducts() {
  return (
    <FeatureIntro
      title="Manage your inventory with a product list"
      body="Keep track of the products you sell and use, with stock levels that make ordering, tracking and selling easy."
      bullets={[
        "Start with a single product or import many at once",
        "Organise your list with brands and categories",
        "Keep quantities right with low-stock reminders",
        "Sell products online and at checkout",
      ]}
      onStart={later("Products")}
      art={
        <div className="space-y-3">
          {[
            ["Argan oil shampoo", "12 in stock"],
            ["Leave-in conditioner", "3 in stock · low"],
            ["Styling wax", "20 in stock"],
          ].map(([name, stock]) => (
            <div key={name} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-md">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
                <Package size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold">{name}</span>
                <span className="block text-caption text-muted-foreground">{stock}</span>
              </span>
            </div>
          ))}
        </div>
      }
    />
  );
}

export function CatalogStocktakes() {
  return (
    <FeatureIntro
      title="Track and record your product stock"
      body="Count your inventory down to the item, and see trends and insights in your reports."
      bullets={[
        "Count products quickly with a barcode scanner",
        "Pause a stocktake and pick it up later",
        "Update your inventory as soon as you finish",
        "Add notes to every stocktake",
      ]}
      onStart={later("Stocktakes")}
    />
  );
}

export function CatalogStockOrders() {
  return (
    <div className="space-y-8">
      <CountHeader
        title="Stock orders"
        count={0}
        subtitle="Add and manage your stock orders."
        action={
          <button type="button" onClick={later("Stock orders")} className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}>
            Options
          </button>
        }
      />
      <EmptyCard
        icon={<Package size={48} weight="duotone" />}
        title="No products created yet"
        body="Add products in minutes and start creating stock orders."
      />
    </div>
  );
}

export function CatalogSuppliers() {
  return (
    <div className="space-y-8">
      <CountHeader
        title="Suppliers"
        count={0}
        subtitle="Add and manage details of your suppliers."
        action={
          <button type="button" onClick={later("Suppliers")} className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}>
            Add
          </button>
        }
      />
      <EmptyCard
        icon={<Truck size={48} weight="duotone" />}
        title="No suppliers yet"
        body="Add a supplier to start tracking where your stock comes from."
        action={
          <button type="button" onClick={later("Suppliers")} className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}>
            Add supplier
          </button>
        }
      />
    </div>
  );
}
