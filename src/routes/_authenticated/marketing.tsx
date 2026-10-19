import { createFileRoute } from "@tanstack/react-router";

import { DealsPage } from "@/components/marketing/deals-page";

import {
  AutomationsPage,
  BlastCampaigns,
  MessagesHistory,
  SmartPricing,
} from "@/components/marketing/marketing-pages";

const TABS = ["campaigns", "automations", "history", "deals", "pricing"] as const;
type MarketingTab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/marketing")({
  validateSearch: (search: Record<string, unknown>): { tab?: MarketingTab } =>
    typeof search["tab"] === "string" && (TABS as readonly string[]).includes(search["tab"])
      ? { tab: search["tab"] as MarketingTab }
      : {},
  head: () => ({
    meta: [
      { title: "Marketing — Bookly" },
      { name: "description", content: "Automated client messages, campaigns and deals." },
    ],
  }),
  component: MarketingPage,
});

function MarketingPage() {
  const { tab = "campaigns" } = Route.useSearch();
  return (
    <div className="min-h-full w-full bg-white">
      <div className="mx-auto w-full max-w-[1088px] px-8 pb-10 pt-8">
        {tab === "automations" ? (
          <AutomationsPage />
        ) : tab === "history" ? (
          <MessagesHistory />
        ) : tab === "deals" ? (
          <DealsPage />
        ) : tab === "pricing" ? (
          <SmartPricing />
        ) : (
          <BlastCampaigns />
        )}
      </div>
    </div>
  );
}
