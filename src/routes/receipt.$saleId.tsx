import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "@phosphor-icons/react";

import { pillButton } from "@/components/sales/list-ui";
import { supabase } from "@/integrations/supabase/client";
import { requireOnboardedUser } from "@/lib/auth-guard";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SkeletonPanel } from "@/components/ui/skeletons";
import { useApplyBrand } from "@/lib/brand";
import { SalonLogo } from "@/components/customer/salon-logo";

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
  team_members: { first_name: string } | null;
  sale_items: { description: string; price: number; quantity: number; tax_amount?: number | null; sort_order: number }[];
  businesses: { name: string; currency: string; country: string; location: { address?: string; city?: string } | null; receipt_footer?: string | null; brand_color?: string | null; logo_path?: string | null } | null;
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
        .select("*, clients(first_name, last_name, email, phone), team_members(first_name), sale_items(*), businesses(*)")
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

  useApplyBrand(sale.data?.businesses?.brand_color);

  if (sale.isLoading)
    return (
      <div className="flex min-h-screen justify-center bg-surface px-4 py-8">
        <SkeletonPanel lines={7} label="Loading receipt" />
      </div>
    );
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
  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s.sale_date));

  return (
    <div className="min-h-screen bg-surface py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-md justify-between px-4 print:hidden">
        <button type="button" onClick={() => navigate({ to: "/sales", search: { tab: "sales" } })} className={cn(pillButton, "h-10 border border-input bg-card text-body hover:bg-secondary")}>
          <ArrowLeft size={16} /> Sales
        </button>
        <button type="button" onClick={() => window.print()} className={cn(pillButton, "h-10 bg-ink text-body text-ink-foreground hover:bg-ink/90")}>
          <Printer size={18} /> Print
        </button>
      </div>
      <article className="mx-auto max-w-md bg-card px-8 py-10 shadow-[inset_0_0_0_1px_var(--color-border)] print:max-w-none print:shadow-none">
        <header className="text-center">
          {b ? <SalonLogo path={b.logo_path} name={b.name} size={64} className="mx-auto mb-3" /> : null}
          <h1 className="text-title font-semibold">{b?.name}</h1>
          {b?.location?.address ? (
            <p className="text-caption text-muted-foreground">{[b.location.address, b.location.city].filter(Boolean).join(", ")}</p>
          ) : null}
          <p className="mt-4 text-body font-semibold">
            {s.status === "refunded" ? "Refund receipt" : "Receipt"} #{s.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="text-caption text-muted-foreground">{when}</p>
        </header>

        {s.clients ? (
          <p className="mt-6 text-body">
            <span className="text-muted-foreground">Client: </span>
            {[s.clients.first_name, s.clients.last_name].filter(Boolean).join(" ")}
          </p>
        ) : null}
        {s.team_members ? (
          <p className="text-body">
            <span className="text-muted-foreground">Served by: </span>
            {s.team_members.first_name}
          </p>
        ) : null}

        <table className="mt-6 w-full text-body">
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="align-top">
                <td className="py-1.5 pr-2">
                  {item.description}
                  {item.quantity > 1 ? <span className="text-muted-foreground"> × {item.quantity}</span> : null}
                </td>
                <td className="py-1.5 text-right tabular-nums">{money(Number(item.price) * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-4 space-y-1 border-t border-dashed border-border pt-4 text-body">
          <Row label="Subtotal" value={money(subtotal)} />
          {discount ? <Row label="Discount" value={`-${money(discount)}`} /> : null}
          {tip ? <Row label="Tip" value={money(tip)} /> : null}
          <Row label="Total" value={money(grand)} strong />
          {tax ? <Row label="Includes tax" value={money(tax)} muted /> : null}
        </dl>

        <dl className="mt-4 space-y-1 border-t border-dashed border-border pt-4 text-body">
          {(gifts.data ?? []).map((g, i) => (
            <Row key={i} label={`Gift card ${g.gift_cards?.code ?? ""}`} value={money(Number(g.amount))} />
          ))}
          {grand - giftPaid > 0.004 ? <Row label={`Paid by ${METHOD[s.payment_method] ?? s.payment_method}`} value={money(grand - giftPaid)} /> : null}
          {s.notes && /Split payment/.test(s.notes) ? <p className="text-caption text-muted-foreground">{s.notes.match(/Split payment:[^·]*/)?.[0]}</p> : null}
        </dl>

        {b?.receipt_footer ? <p className="mt-8 whitespace-pre-line text-center text-caption text-muted-foreground">{b.receipt_footer}</p> : null}
        <p className="mt-6 text-center text-caption text-muted-foreground">Thank you!</p>
      </article>
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between", strong && "text-heading font-semibold", muted && "text-caption text-muted-foreground")}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
