import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CaretDown, GoogleLogo, Play, Star, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { ClientProfile } from "@/components/clients/client-profile";
import { FeatureIntro, PageHeader, pillButton } from "@/components/sales/list-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

const DAY = 86_400_000;
/** Fresha's "high spender" bar, scaled for naira. */
const HIGH_SPENDER_THRESHOLD = 50_000;

type SegmentClient = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
};

// ─── Client segments ───────────────────────────────────────────────────────

export function ClientSegments() {
  const { data: business } = useBusiness();
  const businessId = business?.id;
  const [tab, setTab] = useState<"standard" | "custom">("standard");
  const [viewing, setViewing] = useState<{ title: string; ids: string[] } | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["client-segments", businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const [clients, items, sales] = await Promise.all([
        supabase
          .from("clients")
          .select(
            "id, first_name, last_name, email, created_at, birth_day, birth_month, client_source",
          )
          .eq("business_id", businessId!),
        supabase
          .from("appointment_items")
          .select("start_time, appointments!inner(client_id, status)")
          .eq("business_id", businessId!),
        supabase
          .from("sales")
          .select("client_id, total, sale_date, status")
          .eq("business_id", businessId!)
          .eq("status", "completed"),
      ]);
      if (clients.error) throw clients.error;
      if (items.error) throw items.error;
      if (sales.error) throw sales.error;
      return {
        clients: clients.data ?? [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        visits: (items.data ?? []).map((row: any) => ({
          clientId: row.appointments?.client_id as string | null,
          status: row.appointments?.status as string,
          at: new Date(row.start_time).getTime(),
        })),
        sales: (sales.data ?? []).map((row) => ({
          clientId: row.client_id,
          total: Number(row.total),
          at: new Date(row.sale_date).getTime(),
        })),
      };
    },
  });

  const segments = useMemo(() => {
    const now = Date.now();
    const clients = data?.clients ?? [];
    const visits = (data?.visits ?? []).filter(
      (visit) => visit.clientId && visit.status !== "cancelled",
    );
    const sales = (data?.sales ?? []).filter((sale) => sale.clientId);
    const byClient = <T extends { clientId: string | null }>(rows: T[], id: string) =>
      rows.filter((row) => row.clientId === id);
    const ids = (test: (client: (typeof clients)[number]) => boolean) =>
      clients.filter(test).map((client) => client.id);
    const inNext30 = (day: number | null, month: number | null) => {
      if (!day || !month) return false;
      const today = new Date();
      for (let offset = 0; offset <= 30; offset += 1) {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
        if (date.getDate() === day && date.getMonth() + 1 === month) return true;
      }
      return false;
    };
    const money = (value: number) =>
      business ? formatMoney(value, business.currency, business.country) : String(value);
    const standard = [
      {
        title: "New clients",
        body: "Clients added in the last 30 days",
        ids: ids((client) => now - new Date(client.created_at).getTime() <= 30 * DAY),
      },
      {
        title: "Recent clients",
        body: "Clients with appointments in the last 30 days",
        ids: ids((client) =>
          byClient(visits, client.id).some(
            (visit) => visit.at <= now && now - visit.at <= 30 * DAY,
          ),
        ),
      },
      {
        title: "First visit",
        body: "Clients with no appointments in the past, and with appointments in the future",
        ids: ids((client) => {
          const mine = byClient(visits, client.id);
          return mine.some((visit) => visit.at > now) && !mine.some((visit) => visit.at <= now);
        }),
      },
      {
        title: "Loyal clients",
        body: "Clients with 2 or more sales in the last 5 months",
        ids: ids(
          (client) =>
            byClient(sales, client.id).filter((sale) => now - sale.at <= 152 * DAY).length >= 2,
        ),
      },
      {
        title: "Lapsed clients",
        body: "Clients with 3 or more sales in the last 12 months, and with no sales in the last 2 months",
        ids: ids((client) => {
          const mine = byClient(sales, client.id);
          return (
            mine.filter((sale) => now - sale.at <= 365 * DAY).length >= 3 &&
            !mine.some((sale) => now - sale.at <= 61 * DAY)
          );
        }),
      },
      {
        title: "High spenders",
        body: `Clients with more than ${money(HIGH_SPENDER_THRESHOLD)} in sales in the last 12 months`,
        ids: ids(
          (client) =>
            byClient(sales, client.id)
              .filter((sale) => now - sale.at <= 365 * DAY)
              .reduce((sum, sale) => sum + sale.total, 0) > HIGH_SPENDER_THRESHOLD,
        ),
      },
      {
        title: "Upcoming birthdays",
        body: "Clients with birthdays in the next 30 days",
        ids: ids((client) => inNext30(client.birth_day, client.birth_month)),
      },
    ];
    const custom = [
      {
        title: "Clients with upcoming appointments",
        body: "Clients with appointments in the future",
        ids: ids((client) => byClient(visits, client.id).some((visit) => visit.at > now)),
      },
      {
        title: "Clients with sales",
        body: "Clients with sales in the last 30 days",
        ids: ids((client) => byClient(sales, client.id).some((sale) => now - sale.at <= 30 * DAY)),
      },
      {
        title: "Imported clients",
        body: "Clients with selected client source",
        ids: ids((client) => /import/i.test(client.client_source ?? "")),
      },
    ];
    return { standard, custom, clients };
  }, [data, business]);

  const list = tab === "standard" ? segments.standard : segments.custom;
  const segmentClients: SegmentClient[] = viewing
    ? segments.clients.filter((client) => viewing.ids.includes(client.id))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client segments"
        subtitle="Create and manage automated segments you can easily use across Bookly including marketing tools, reporting, and calendar."
        learnMore
        actions={
          <button
            type="button"
            onClick={() =>
              toast("Custom segments need their own database table, coming in a later update")
            }
            className={cn(pillButton, "bg-ink px-6 text-ink-foreground hover:bg-ink/90")}
          >
            Add
          </button>
        }
      />
      <div className="flex gap-2">
        {(
          [
            ["standard", "Standard"],
            ["custom", "Custom"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "h-9 rounded-full px-4 text-[0.875rem] font-semibold",
              tab === key ? "bg-ink text-ink-foreground" : "hover:bg-secondary",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        {list.map((segment) => (
          <div key={segment.title} className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                {segment.title}
                <span className="rounded-full bg-secondary px-2 text-[0.75rem] font-medium text-muted-foreground">
                  {segment.ids.length}
                </span>
              </p>
              <p className="text-[0.8125rem] text-muted-foreground">{segment.body}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border px-4 text-[0.875rem] font-semibold hover:bg-secondary"
                >
                  Actions <CaretDown size={12} weight="bold" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5">
                <DropdownMenuItem
                  onSelect={() => setViewing({ title: segment.title, ids: segment.ids })}
                  className="rounded-lg px-3 py-2 text-[0.9375rem]"
                >
                  View clients
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => toast("Blast campaigns arrive with Marketing")}
                  className="rounded-lg px-3 py-2 text-[0.9375rem]"
                >
                  Send a campaign
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      {viewing ? (
        <div className="fixed inset-y-0 right-0 z-50 flex animate-in slide-in-from-right-8 duration-200">
          <div className="pr-4 pt-4">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setViewing(null)}
              className="flex size-11 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-secondary"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex h-full w-[30rem] max-w-[calc(100vw-4rem)] flex-col border-l border-border bg-card shadow-[-12px_0_32px_-12px_rgb(0_0_0/0.2)]">
            <h2 className="px-6 pb-1 pt-6 text-[1.75rem] font-bold tracking-tight">
              {viewing.title}
            </h2>
            <p className="px-6 pb-4 text-[0.875rem] text-muted-foreground">
              {segmentClients.length} clients
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto px-3">
              {segmentClients.length === 0 ? (
                <p className="px-3 py-10 text-center text-[0.875rem] text-muted-foreground">
                  No clients in this segment yet.
                </p>
              ) : (
                segmentClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setProfileId(client.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-secondary"
                  >
                    <span className="flex size-10 items-center justify-center rounded-full bg-[#ebe8ff] font-semibold text-primary">
                      {client.first_name[0]}
                    </span>
                    <span>
                      <span className="block text-[0.9375rem] font-medium">
                        {[client.first_name, client.last_name].filter(Boolean).join(" ")}
                      </span>
                      <span className="block text-[0.8125rem] text-muted-foreground">
                        {client.email}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
      <ClientProfile clientId={profileId} onClose={() => setProfileId(null)} />
    </div>
  );
}

// ─── Client loyalty ────────────────────────────────────────────────────────

export function ClientLoyalty() {
  return (
    <FeatureIntro
      eyebrow="CLIENT LOYALTY ADD-ON"
      title="Turn all clients into regulars"
      body="Watch your sales grow with a custom loyalty program, encouraging repeat visits and larger purchases."
      bullets={[
        "Offer the ultimate loyalty experience with points, tiers and referrals",
        "Reward your clients with exclusive offers, discounts and incentives to celebrate their loyalty",
        "Allow clients to easily track their progress and redeem rewards online",
      ]}
      onStart={() =>
        toast("Client loyalty needs its own database tables, coming in a later update")
      }
      art={
        <div className="rounded-3xl bg-card p-5 shadow-lg">
          <p className="text-[0.8125rem] text-muted-foreground">Gold member</p>
          <p className="text-2xl font-bold">2,450 pts</p>
          <div className="mt-3 h-2 rounded-full bg-secondary">
            <div className="h-2 w-2/3 rounded-full bg-primary" />
          </div>
          <p className="mt-2 text-[0.75rem] text-muted-foreground">550 pts to Platinum</p>
          {["Free blow dry", "10% off colour", "Refer a friend"].map((reward) => (
            <div
              key={reward}
              className="mt-2 flex items-center justify-between rounded-xl border border-border px-3 py-2 text-[0.8125rem]"
            >
              {reward}
              <Star size={14} weight="fill" className="text-primary" />
            </div>
          ))}
        </div>
      }
    />
  );
}

// ─── Online reputation ─────────────────────────────────────────────────────

export function OnlineReputation() {
  const [tab, setTab] = useState<"overview" | "all">("overview");
  const [videoOpen, setVideoOpen] = useState(true);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Online reputation"
        subtitle="Manage reviews across Bookly and Google in one place."
        learnMore
      />
      {videoOpen ? (
        <div className="relative flex items-center gap-4 rounded-2xl bg-[#ebe8ff] p-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-card text-primary">
            <Play size={20} weight="fill" />
          </span>
          <p className="text-[0.9375rem]">
            Explore tools to get client reviews that grow your business.
          </p>
          <button
            type="button"
            onClick={() => setVideoOpen(false)}
            className="ml-auto text-[0.875rem] font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}
      <div className="flex gap-2">
        {(
          [
            ["overview", "Overview"],
            ["all", "All reviews"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "h-9 rounded-full px-4 text-[0.875rem] font-semibold",
              tab === key ? "bg-ink text-ink-foreground" : "hover:bg-secondary",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Overall rating", "0.0"],
              ["Total reviews", "0"],
              ["Response rate", "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-border bg-card p-5">
                <p className="text-[0.9375rem] font-semibold">{label}</p>
                <p className="mt-2 text-[1.75rem] font-bold">{value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-[1.0625rem] font-semibold">No reviews yet</p>
            <div className="mt-4 space-y-2">
              {[5, 4, 3, 2, 1].map((stars) => (
                <div key={stars} className="flex items-center gap-3 text-[0.875rem]">
                  <span className="w-3">{stars}</span>
                  <Star size={14} weight="fill" className="text-[#f5b301]" />
                  <div className="h-2 flex-1 rounded-full bg-secondary" />
                  <span className="w-4 text-right text-muted-foreground">0</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <GoogleLogo size={28} weight="bold" />
              <div>
                <p className="text-[0.9375rem] font-semibold">Link your Google account</p>
                <p className="text-[0.8125rem] text-muted-foreground">
                  View and manage your Google reviews in one place
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => toast("Google Business connection arrives with Online booking")}
              className={cn(pillButton, "h-10 border border-border hover:bg-secondary")}
            >
              Connect
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-16 text-center">
          <Star size={40} weight="duotone" className="text-primary" />
          <p className="mt-4 text-[1.0625rem] font-semibold">No reviews yet</p>
          <p className="mt-1 max-w-sm text-[0.875rem] text-muted-foreground">
            Reviews appear here once clients rate their visits after online booking.
          </p>
        </div>
      )}
    </div>
  );
}
