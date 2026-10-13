import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "@phosphor-icons/react";

import { DailySalesSummary } from "@/components/sales/daily-sales-summary";
import { SalesAppointmentsList } from "@/components/sales/sales-appointments-list";
import { SalesList } from "@/components/sales/sales-list";
import {
  GiftCardsSold,
  MembershipsSold,
  PackagesSold,
  PaymentsList,
  RegisterIntro,
} from "@/components/sales/sales-extra-pages";

const TAB_LABELS: Record<string, string> = {
  daily: "Daily sales summary",
  register: "Register",
  appointments: "Appointments",
  sales: "Sales",
  payments: "Payments",
  "gift-cards": "Gift cards sold",
  packages: "Packages sold",
  memberships: "Memberships sold",
};

export const Route = createFileRoute("/_authenticated/sales")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab:
      typeof search["tab"] === "string" && search["tab"] in TAB_LABELS
        ? (search["tab"] as string)
        : "daily",
  }),
  head: () => ({
    meta: [
      { title: "Sales — Bookly" },
      { name: "description", content: "Daily sales summary, transactions and cash movement." },
      { property: "og:title", content: "Sales — Bookly" },
      { property: "og:description", content: "Daily sales summary, transactions and cash movement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SalesPage,
});

function SalesPage() {
  const { tab } = Route.useSearch();

  return (
    <div className="min-w-0 px-8 py-10">
      {tab === "daily" ? (
        <DailySalesSummary />
      ) : tab === "appointments" ? (
        <SalesAppointmentsList />
      ) : tab === "sales" ? (
        <SalesList />
      ) : tab === "payments" ? (
        <PaymentsList />
      ) : tab === "register" ? (
        <RegisterIntro />
      ) : tab === "gift-cards" ? (
        <GiftCardsSold />
      ) : tab === "packages" ? (
        <PackagesSold />
      ) : tab === "memberships" ? (
        <MembershipsSold />
      ) : (
        <ComingSoon label={TAB_LABELS[tab] ?? "This section"} />
      )}
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Receipt size={22} />
      </span>
      <h2 className="mt-2 text-base font-semibold text-foreground">{label}</h2>
      <p className="text-sm text-muted-foreground">This section is coming soon.</p>
    </div>
  );
}
