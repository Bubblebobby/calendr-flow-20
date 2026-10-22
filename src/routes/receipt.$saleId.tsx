import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, Gift, Money, Printer, Wallet } from "@phosphor-icons/react";
import JsBarcode from "jsbarcode";

import { pillButton } from "@/components/sales/list-ui";
import { supabase } from "@/integrations/supabase/client";
import { requireOnboardedUser } from "@/lib/auth-guard";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/receipt/$saleId")({
  ssr: false,
  beforeLoad: requireOnboardedUser,
  head: () => ({ meta: [{ title: "Receipt — Bookly" }] }),
  component: ReceiptPage,
});

type SaleRow = {
  id: string;
  sale_date: string;
  status: string;
  payment_method: string;
  total: number;
  notes: string | null;
  tip_amount?: number | null;
  tax_amount?: number | null;
  discount_amount?: number | null;
  clients: { first_name: string; last_name: string | null; email: string | null; phone: string | null } | null;
  team_members: { first_name: string; last_name: string | null } | null;
  sale_items: { description: string; price: number; quantity: number; tax_amount?: number | null; sort_order: number }[];
  businesses: { name: string; currency: string; country: string; location: { address?: string; city?: string } | null; receipt_footer?: string | null } | null;
};

const METHOD: Record<string, string> = { cash: "Cash", card: "Card", other: "Other" };

function ReceiptPage() {
  const { saleId } = Route.useParams();
  const navigate = useNavigate();
  const sale = useQuery({
    queryKey: ["receipt", saleId],
    queryFn: async (): Promise<SaleRow> => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, clients(first_name, last_name, email, phone), team_members(first_name, last_name), sale_items(*), businesses(*)")
        .eq("id", saleId)
        .single();
      if (error) throw error;
      return data as unknown as SaleRow;
    },
  });
  const gifts = useQuery({
    queryKey: ["receipt-gifts", saleId],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("gift_card_redemptions").select("amount, gift_cards(code)").eq("sale_id", saleId);
      if (error) return [];
      return (data ?? []) as unknown as { amount: number; gift_cards: { code: string } | null }[];
    },
  });

  if (sale.isLoading) return <div className="p-10 text-center text-body text-muted-foreground">Loading receipt…</div>;
  if (!sale.data) return <div className="p-10 text-center text-body text-muted-foreground">Receipt not found.</div>;
  const s = sale.data;
  const b = s.businesses;
  const money = (n: number) => (b ? formatMoney(n, b.currency, b.country) : String(n));
  const items = [...s.sale_items].sort((a, c) => a.sort_order - c.sort_order);
  const subtotal = items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
  const discount = Number(s.discount_amount ?? 0);
  const tip = Number(s.tip_amount ?? 0);
  const tax = Number(s.tax_amount ?? 0);
  const giftPaid = (gifts.data ?? []).reduce((sum, g) => sum + Number(g.amount), 0);
  const grand = Number(s.total) + tip;
  const date = new Date(s.sale_date);
  const when = `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date)} · ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date)}`;

  const refunded = s.status === "refunded";
  const number = s.id.slice(0, 8).toUpperCase();
  const clientName = s.clients ? [s.clients.first_name, s.clients.last_name].filter(Boolean).join(" ") : null;
  const method = METHOD[s.payment_method] ?? s.payment_method;
  const address = b?.location ? [b.location.address, b.location.city].filter(Boolean).join(", ") : "";

  return (
    <div className="min-h-screen bg-[#f3f5f9] py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-6 flex max-w-[26rem] justify-between px-4 print:hidden">
        <button type="button" onClick={() => navigate({ to: "/sales", search: { tab: "sales" } })} className={cn(pillButton, "h-10 border border-input bg-card text-body hover:bg-secondary")}>
          <ArrowLeft size={16} /> Sales
        </button>
        <button type="button" onClick={() => window.print()} className={cn(pillButton, "h-10 bg-ink text-body text-ink-foreground hover:bg-ink/90")}>
          <Printer size={18} /> Print
        </button>
      </div>

      <article className="relative mx-auto max-w-[26rem] px-4 drop-shadow-[0_24px_40px_rgba(30,41,82,0.08)] print:drop-shadow-none">
        {/* Top: thank you */}
        <section className="rounded-t-[1.75rem] bg-card px-8 pb-8 pt-10 text-center">
          <span aria-hidden className="block text-[3.5rem] leading-none">
            {refunded ? "↩️" : "🎉"}
          </span>
          <h1 className="mt-6 text-[1.75rem] font-bold leading-9 tracking-[-0.02em]">
            {refunded ? "Refund issued" : "Thank you!"}
          </h1>
          <p className="mx-auto mt-2 max-w-[16rem] text-body leading-6 text-muted-foreground">
            {refunded ? `Your refund from ${b?.name ?? "the salon"} has been issued` : "Your booking was successful"}
          </p>
        </section>

        <TearLine />

        {/* Details */}
        <section className="bg-card px-8 pb-8 pt-6">
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-6">
            <Field label="Receipt ID" value={`#${number}`} />
            <Field label="Amount" value={money(grand)} right />
            <Field label="Date & time" value={when} />
            {s.team_members ? (
              <Field label="Served by" value={[s.team_members.first_name, s.team_members.last_name].filter(Boolean).join(" ")} right />
            ) : null}
          </dl>

          <ul className="mt-7 space-y-2 border-t border-border pt-5 text-body">
            {items.map((item, index) => (
              <li key={index} className="flex justify-between gap-4">
                <span>
                  {item.description}
                  {item.quantity > 1 ? <span className="text-muted-foreground"> × {item.quantity}</span> : null}
                </span>
                <span className="tabular-nums">{money(Number(item.price) * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-border pt-4 text-body">
            {discount || tip ? <Row label="Subtotal" value={money(subtotal)} muted /> : null}
            {discount ? <Row label="Discount" value={`-${money(discount)}`} muted /> : null}
            {tip ? <Row label="Tip" value={money(tip)} muted /> : null}
            <Row label="Total" value={money(grand)} strong />
            {tax ? <Row label="Includes tax" value={money(tax)} muted /> : null}
          </dl>

          <div className="mt-6 space-y-2">
            {(gifts.data ?? []).map((g, i) => (
              <PaidBy key={i} icon={<Gift size={24} />} title={`Gift card ${g.gift_cards?.code ?? ""}`.trim()} detail={money(Number(g.amount))} />
            ))}
            {grand - giftPaid > 0.004 ? (
              <PaidBy
                icon={s.payment_method === "card" ? <CreditCard size={24} /> : s.payment_method === "cash" ? <Money size={24} /> : <Wallet size={24} />}
                title={clientName ?? "Walk-in client"}
                detail={`${method} · ${money(grand - giftPaid)}`}
              />
            ) : null}
            {s.notes && /Split payment/.test(s.notes) ? <p className="text-caption text-muted-foreground">{s.notes.match(/Split payment:[^·]*/)?.[0]}</p> : null}
          </div>
        </section>

        <div aria-hidden className="h-0.5 bg-card bg-[repeating-linear-gradient(90deg,var(--color-border)_0_1.75rem,transparent_1.75rem_2.5rem)]" />

        {/* Barcode stub */}
        <section className="bg-card px-8 pb-10 pt-7 text-center">
          <Barcode value={number} />
          <p className="mt-5 text-body font-semibold">{b?.name}</p>
          {address ? <p className="text-caption text-muted-foreground">{address}</p> : null}
          {b?.receipt_footer ? <p className="mt-3 whitespace-pre-line text-caption text-muted-foreground">{b.receipt_footer}</p> : null}
        </section>
        <Scallops />
      </article>
    </div>
  );
}

/** The dashed tear line, with a half-circle notch cut into each side. */
function TearLine() {
  return (
    <div aria-hidden className="relative h-7 overflow-hidden bg-card">
      <span className="absolute -left-3.5 top-0 size-7 rounded-full bg-[#f3f5f9] print:bg-white" />
      <span className="absolute -right-3.5 top-0 size-7 rounded-full bg-[#f3f5f9] print:bg-white" />
      <span className="absolute inset-x-12 top-1/2 h-[1.5px] -translate-y-1/2 bg-[repeating-linear-gradient(90deg,#b9bfcb_0_8px,transparent_8px_16px)]" />
    </div>
  );
}

/** Scalloped bottom edge, like a torn ticket stub. */
function Scallops() {
  return (
    <div aria-hidden className="relative h-6 overflow-hidden rounded-b-[1.75rem] bg-card">
      <div className="absolute inset-x-6 bottom-[-1.25rem] flex justify-between">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="h-10 w-12 rounded-full bg-[#f3f5f9] print:bg-white" />
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, right }: { label: string; value: string; right?: boolean }) {
  return (
    <div className={cn(right && "text-right")}>
      <dt className="text-body text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-[1.0625rem] font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function PaidBy({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-[#f5f7fb] px-5 py-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-foreground">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-body font-semibold">{title}</span>
        <span className="block text-body text-muted-foreground">{detail}</span>
      </span>
    </div>
  );
}

/** A scannable Code 128 barcode of the receipt number. */
function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    JsBarcode(ref.current, value, {
      format: "CODE128",
      width: 2,
      height: 72,
      margin: 0,
      fontSize: 13,
      textMargin: 6,
      font: "ui-monospace, SFMono-Regular, monospace",
      background: "transparent",
      lineColor: "#101010",
    });
  }, [value]);
  return <svg ref={ref} role="img" aria-label={`Barcode for receipt ${value}`} className="mx-auto h-auto max-w-full" />;
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between", strong && "text-heading font-semibold", muted && "text-caption text-muted-foreground")}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
