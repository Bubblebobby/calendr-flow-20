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
