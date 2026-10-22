import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown, Gift, Stack } from "@phosphor-icons/react";

import { EmptyState, outlinePill } from "@/components/customer/customer-ui";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SkeletonList } from "@/components/ui/skeletons";

export const Route = createFileRoute("/account/wallet")({
  head: () => ({ meta: [{ title: "Wallet — Bookly" }] }),
  component: WalletPage,
});

type Salon = { name: string; slug: string | null; currency?: string; country?: string };
type Wallet = {
  gift_cards: {
    id: string;
    code: string;
    balance: number;
    initial: number;
    expires_on: string | null;
    status: string;
    recipient: string | null;
    business: Salon & { currency: string; country: string };
  }[];
  packages: {
    id: string;
    name: string;
    expires_on: string | null;
    bought: string;
    items: { service: string; total: number; used: number }[];
    business: Salon;
  }[];
  memberships: {
    id: string;
    name: string;
    discount_percent: number;
    starts_on: string;
    ends_on: string;
    status: string;
    business: Salon;
  }[];
};

const today = () => new Date().toISOString().slice(0, 10);
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));

function WalletPage() {
  const wallet = useQuery({
    queryKey: ["my-wallet"],
    queryFn: async (): Promise<Wallet> => {
      const { data, error } = await supabase.rpc("my_wallet");
      if (error) throw error;
      return (
        (data as unknown as Wallet | null) ?? { gift_cards: [], packages: [], memberships: [] }
      );
    },
  });

  if (wallet.isLoading)
    return <SkeletonList rows={3} thumb="square" label="Loading your wallet" />;
  if (wallet.isError || !wallet.data)
    return (
      <p className="text-body text-destructive">Couldn&apos;t load your wallet. Please refresh.</p>
    );
  const { gift_cards, packages, memberships } = wallet.data;
  const nothing = !gift_cards.length && !packages.length && !memberships.length;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-display font-semibold">Wallet</h1>
        <p className="mt-1 text-body text-muted-foreground">
          Gift cards, packages and memberships from the salons you visit.
        </p>
      </div>

      {nothing ? (
        <EmptyState
          icon={Gift}
          title="Your wallet is empty"
          text="Gift cards, packages and memberships you buy at a salon show up here, with what's left to use."
          action={
            <Link to="/discover" className={outlinePill}>
              Find a salon
            </Link>
          }
        />
      ) : null}

      {gift_cards.length ? (
        <section>
          <h2 className="text-title font-semibold">Gift cards</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {gift_cards.map((g) => {
              const expired = g.expires_on != null && g.expires_on < today();
              const usable = g.status === "active" && !expired && Number(g.balance) > 0;
              const money = (n: number) => formatMoney(n, g.business.currency, g.business.country);
              return (
                <div
                  key={g.id}
                  className={cn(
                    "rounded-2xl p-5 text-white",
                    usable ? "bg-gradient-to-br from-[#101010] to-[#1f3b73]" : "bg-[#8d8d99]",
                  )}
                >
                  <p className="text-caption opacity-80">{g.business.name}</p>
                  <p className="mt-3 text-[2rem] font-bold leading-none tabular-nums">
                    {money(Number(g.balance))}
                  </p>
                  <p className="mt-1 text-caption opacity-80">left of {money(Number(g.initial))}</p>
                  <div className="mt-5 flex items-end justify-between gap-3">
                    <span className="rounded-lg bg-white/20 px-2 py-1 font-mono text-body tracking-wider">
                      {g.code}
                    </span>
                    <span className="text-right text-caption opacity-90">
                      {g.status === "void"
                        ? "Cancelled"
                        : expired
                          ? `Expired ${dateLabel(g.expires_on!)}`
                          : Number(g.balance) <= 0
                            ? "Used up"
                            : g.expires_on
                              ? `Valid until ${dateLabel(g.expires_on)}`
                              : "No expiry"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-caption text-muted-foreground">
            Show the code at the salon to pay with your gift card.
          </p>
        </section>
      ) : null}

      {packages.length ? (
        <section>
          <h2 className="text-title font-semibold">Packages</h2>
          <div className="mt-4 space-y-3">
            {packages.map((p) => {
              const expired = p.expires_on != null && p.expires_on < today();
              return (
                <div
                  key={p.id}
                  className="rounded-2xl bg-card p-5 shadow-[inset_0_0_0_1px_var(--color-border)]"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent">
                      <Stack size={20} className="text-primary" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-heading font-semibold">{p.name}</p>
                      <p className="text-caption text-muted-foreground">
                        {p.business.name} ·{" "}
                        {expired
                          ? `Expired ${dateLabel(p.expires_on!)}`
                          : p.expires_on
                            ? `Valid until ${dateLabel(p.expires_on)}`
                            : "No expiry"}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {p.items.map((item, index) => {
                      const left = Math.max(0, item.total - item.used);
                      return (
                        <li key={index}>
                          <div className="flex justify-between text-body">
                            <span>{item.service}</span>
                            <span className="font-semibold tabular-nums">
                              {left} of {item.total} left
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${(left / Math.max(1, item.total)) * 100}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {p.business.slug && !expired ? (
                    <a href={`/book/${p.business.slug}`} className={cn(outlinePill, "mt-4")}>
                      Book a session
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {memberships.length ? (
        <section>
          <h2 className="text-title font-semibold">Memberships</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {memberships.map((m) => {
              const active = m.status === "active" && m.ends_on >= today();
              return (
                <div
                  key={m.id}
                  className="rounded-2xl bg-card p-5 shadow-[inset_0_0_0_1px_var(--color-border)]"
                >
                  <div className="flex items-center gap-2">
                    <Crown
                      size={20}
                      weight="fill"
                      className={active ? "text-rating" : "text-muted-foreground"}
                    />
                    <p className="text-heading font-semibold">{m.name}</p>
                  </div>
                  <p className="mt-1 text-body">{Number(m.discount_percent)}% off services</p>
                  <p className="text-caption text-muted-foreground">
                    {m.business.name} ·{" "}
                    {m.status === "cancelled"
                      ? "Cancelled"
                      : active
                        ? `Active until ${dateLabel(m.ends_on)}`
                        : `Ended ${dateLabel(m.ends_on)}`}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
