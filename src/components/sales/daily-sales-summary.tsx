import { useMemo, useState } from "react";
import { CaretDown, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { SaleDialog } from "@/components/sales/sale-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { businessLocale, formatMoney } from "@/lib/format";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

type DaySale = {
  id: string;
  status: "draft" | "completed" | "refunded";
  payment_method: "cash" | "card" | "other";
  total: number;
  sale_items: { id: string; quantity: number; price: number; service_id: string | null }[];
};

const soon = (label: string) => toast(`${label} — coming soon`);

function dayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function DailySalesSummary() {
  const { data: business } = useBusiness();
  const businessId = business?.id;

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [addOpen, setAddOpen] = useState(false);

  const { start, end } = dayRange(selectedDate);
  const isToday = dayRange(new Date()).start.getTime() === start.getTime();

  const salesQuery = useQuery({
    queryKey: ["daily-sales", businessId, start.toDateString()],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<DaySale[]> => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, status, payment_method, total, sale_items(id, quantity, price, service_id)")
        .eq("business_id", businessId!)
        .gte("sale_date", start.toISOString())
        .lt("sale_date", end.toISOString());
      if (error) throw error;
      return (data ?? []) as unknown as DaySale[];
    },
  });

  const money = (value: number) =>
    business ? formatMoney(value, business.currency, business.country) : "—";

  const summary = useMemo(() => {
    const sales = salesQuery.data ?? [];
    const completed = sales.filter((sale) => sale.status === "completed");
    const refunded = sales.filter((sale) => sale.status === "refunded");

    const serviceQty = (rows: DaySale[]) =>
      rows.reduce(
        (sum, sale) =>
          sum +
          sale.sale_items
            .filter((item) => item.service_id)
            .reduce((itemSum, item) => itemSum + item.quantity, 0),
        0,
      );

    const totalQty = (rows: DaySale[]) =>
      rows.reduce(
        (sum, sale) => sum + sale.sale_items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0,
      );

    const totalValue = (rows: DaySale[]) =>
      rows.reduce((sum, sale) => sum + Number(sale.total ?? 0), 0);

    const byMethod = (method: DaySale["payment_method"], rows: DaySale[]) =>
      totalValue(rows.filter((sale) => sale.payment_method === method));

    return {
      serviceSalesQty: serviceQty(completed),
      serviceRefundQty: serviceQty(refunded),
      servicesGross: totalValue(completed),
      totalSalesQty: totalQty(completed),
      totalRefundQty: totalQty(refunded),
      grossTotal: totalValue(completed),
      refundQty: refunded.length,
      refundTotal: totalValue(refunded),
      collectedCash: byMethod("cash", completed),
      collectedCard: byMethod("card", completed),
      collectedOther: byMethod("other", completed),
      refundsCash: byMethod("cash", refunded),
      refundsCard: byMethod("card", refunded),
      refundsOther: byMethod("other", refunded),
      collectedTotal: totalValue(completed),
      refundsTotal: totalValue(refunded),
    };
  }, [salesQuery.data]);

  const locale = businessLocale(business?.country);
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(selectedDate);

  const shiftDay = (days: number) =>
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      return next;
    });

  const itemRows: { label: string; salesQty: number; refundQty: number; gross: number }[] = [
    { label: "Services", salesQty: summary.serviceSalesQty, refundQty: summary.serviceRefundQty, gross: summary.servicesGross },
    { label: "Service add-ons", salesQty: 0, refundQty: 0, gross: 0 },
    { label: "Products", salesQty: 0, refundQty: 0, gross: 0 },
    { label: "Shipping", salesQty: 0, refundQty: 0, gross: 0 },
    { label: "Gift cards", salesQty: 0, refundQty: 0, gross: 0 },
    { label: "Packages", salesQty: 0, refundQty: 0, gross: 0 },
    { label: "Memberships", salesQty: 0, refundQty: 0, gross: 0 },
    { label: "Late cancellation fees", salesQty: 0, refundQty: 0, gross: 0 },
    { label: "No-show fees", salesQty: 0, refundQty: 0, gross: 0 },
    { label: "Refund amount", salesQty: 0, refundQty: summary.refundQty, gross: summary.refundTotal },
  ];

  const paymentRows: { label: string; collected: number; refunded: number }[] = [
    { label: "Cash", collected: summary.collectedCash, refunded: summary.refundsCash },
    { label: "Card", collected: summary.collectedCard, refunded: summary.refundsCard },
    { label: "Other", collected: summary.collectedOther, refunded: summary.refundsOther },
    { label: "Gift card redemptions", collected: 0, refunded: 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Daily sales</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            View, filter and export the transactions and cash movement for the day.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-11 gap-2 rounded-full border-border bg-card px-6 text-sm font-semibold"
              >
                Export
                <CaretDown size={14} weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 p-2">
              {["PDF", "CSV", "Excel"].map((label) => (
                <DropdownMenuItem
                  key={label}
                  className="px-3 py-2 text-sm font-medium"
                  onClick={() => soon(`Export ${label}`)}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button className="h-11 rounded-full px-7 text-sm font-semibold" onClick={() => setAddOpen(true)}>
            Add new
          </Button>
        </div>
      </div>

      {/* Date navigator */}
      <div className="inline-flex items-center overflow-hidden rounded-full border border-border bg-card">
        <button
          type="button"
          aria-label="Previous day"
          className="flex h-11 w-11 items-center justify-center border-r border-border text-foreground transition-colors hover:bg-muted/60"
          onClick={() => shiftDay(-1)}
        >
          <CaretLeft size={16} weight="bold" />
        </button>
        <button
          type="button"
          className={cn(
            "h-11 border-r border-border px-5 text-sm font-semibold transition-colors hover:bg-muted/60",
            isToday ? "text-muted-foreground" : "text-foreground",
          )}
          onClick={() => setSelectedDate(new Date())}
        >
          Today
        </button>
        <span className="h-11 px-5 text-sm font-medium leading-[2.75rem] text-foreground">
          {dateLabel}
        </span>
        <button
          type="button"
          aria-label="Next day"
          className="flex h-11 w-11 items-center justify-center border-l border-border text-foreground transition-colors hover:bg-muted/60"
          onClick={() => shiftDay(1)}
        >
          <CaretRight size={16} weight="bold" />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        {/* Transaction summary */}
        <section className="rounded-2xl border border-border bg-card">
          <h3 className="px-6 pb-2 pt-5 text-base font-bold text-foreground">Transaction summary</h3>
          <div className="grid grid-cols-[1fr_6rem_6rem_8rem] px-6 py-3 text-xs font-semibold text-muted-foreground">
            <span>Item type</span>
            <span className="text-right">Sales qty</span>
            <span className="text-right">Refund qty</span>
            <span className="text-right">Gross total</span>
          </div>
          <div className="divide-y divide-border">
            {itemRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_6rem_6rem_8rem] px-6 py-3.5 text-sm"
              >
                <span className="text-foreground">{row.label}</span>
                <span className="text-right tabular-nums text-foreground">{row.salesQty}</span>
                <span className="text-right tabular-nums text-foreground">{row.refundQty}</span>
                <span className="text-right tabular-nums text-foreground">{money(row.gross)}</span>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_6rem_6rem_8rem] px-6 py-3.5 text-sm font-bold">
              <span className="text-foreground">Total Sales</span>
              <span className="text-right tabular-nums text-foreground">{summary.totalSalesQty}</span>
              <span className="text-right tabular-nums text-foreground">{summary.totalRefundQty}</span>
              <span className="text-right tabular-nums text-foreground">{money(summary.grossTotal)}</span>
            </div>
          </div>
        </section>

        {/* Cash movement summary */}
        <section className="self-start rounded-2xl border border-border bg-card">
          <h3 className="px-6 pb-2 pt-5 text-base font-bold text-foreground">Cash movement summary</h3>
          <div className="grid grid-cols-[1fr_7rem_7rem] px-6 py-3 text-xs font-semibold text-muted-foreground">
            <span>Payment type</span>
            <span className="text-right">Payments collected</span>
            <span className="text-right">Refunds paid</span>
          </div>
          <div className="divide-y divide-border">
            {paymentRows.map((row) => (
              <div key={row.label} className="grid grid-cols-[1fr_7rem_7rem] px-6 py-3.5 text-sm">
                <span className="text-foreground">{row.label}</span>
                <span className="text-right tabular-nums text-foreground">{money(row.collected)}</span>
                <span className="text-right tabular-nums text-foreground">{money(row.refunded)}</span>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_7rem_7rem] px-6 py-3.5 text-sm font-bold">
              <span className="text-foreground">Payments collected</span>
              <span className="text-right tabular-nums text-foreground">{money(summary.collectedTotal)}</span>
              <span className="text-right tabular-nums text-foreground">{money(summary.refundsTotal)}</span>
            </div>
            <div className="grid grid-cols-[1fr_7rem_7rem] px-6 py-3.5 text-sm font-bold">
              <span className="text-foreground">Of which tips</span>
              <span className="text-right tabular-nums text-foreground">{money(0)}</span>
              <span className="text-right tabular-nums text-foreground">{money(0)}</span>
            </div>
          </div>
        </section>
      </div>

      <SaleDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
