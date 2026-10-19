import { createFileRoute } from "@tanstack/react-router";

import { AddOnsPage } from "@/components/add-ons/add-ons-page";

export const Route = createFileRoute("/_authenticated/add-ons")({
  validateSearch: (search: Record<string, unknown>): { tab?: "integrations" } =>
    search["tab"] === "integrations" ? { tab: "integrations" } : {},
  head: () => ({ meta: [{ title: "Add-ons — Bookly" }] }),
  component: AddOnsRoute,
});

function AddOnsRoute() {
  const { tab } = Route.useSearch();
  return (
    <div className="min-h-full w-full bg-white">
      <div className="mx-auto w-full max-w-[1088px] px-8 pb-10 pt-8">
        <AddOnsPage tab={tab ?? "add-ons"} />
      </div>
    </div>
  );
}
