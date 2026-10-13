import { useMemo, useState } from "react";
import {
  ArrowsDownUp,
  CaretDown,
  Check,
  DotsThreeVertical,
  Gear,
  Receipt,
  X,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { CheckoutScreen, type CheckoutStart } from "@/components/sales/checkout-screen";
import {
  ChipButton,
  DateRangeButton,
  EmptyCard,
  FilterModal,
  FilterSelect,
  FiltersChip,
  ListToolbar,
  PageHeader,
  SearchBox,
  makeRange,
  pillButton,
  rangeBounds,
  type DateRange,
} from "@/components/sales/list-ui";
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

type SaleRow = {
  id: string;
  sale_date: string;
  status: "draft" | "completed" | "refunded";
  payment_method: "cash" | "card" | "other";
  total: number;
  notes: string | null;
  is_walk_in: boolean;
  client_id: string | null;
  appointment_id: string | null;
  clients: { first_name: string; last_name: string | null; email: string | null } | null;
  team_members: { first_name: string; last_name: string | null } | null;
  sale_items: Array<{
    id: string;
    description: string;
    price: number;
    quantity: number;
    service_id: string | null;
    appointment_item_id: string | null;
  }>;
};

type Sort = "date-desc" | "date-asc" | "total-desc" | "total-asc";
const SORT_LABELS: Record<Sort, string> = {
  "date-desc": "Sale date (newest first)",
  "date-asc": "Sale date (oldest first)",
  "total-desc": "Gross total (highest first)",
  "total-asc": "Gross total (lowest first)",
};

const STATUS_LABEL: Record<SaleRow["status"], string> = {
  draft: "Draft",
  completed: "Completed",
  refunded: "Refunded",
};
const STATUS_PILL: Record<SaleRow["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  completed: "bg-status-completed text-status-completed-foreground",
  refunded: "bg-status-cancelled text-status-cancelled-foreground",
};
const METHOD_LABEL: Record<SaleRow["payment_method"], string> = {
  cash: "Cash",
  card: "Card",
  other: "Other",
};

const personName = (row: { first_name: string; last_name: string | null } | null) =>
  row ? [row.first_name, row.last_name].filter(Boolean).join(" ").trim() : null;
const saleRef = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;
const stamp = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));

export function SalesList() {
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const businessId = business?.id;
  const money = (value: number) =>
    business ? formatMoney(value, business.currency, business.country) : "—";

  const [tab, setTab] = useState<"sales" | "draft">("sales");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRange>(() => makeRange("today"));
  const [sort, setSort] = useState<Sort>("date-desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ status: "all", from: "", to: "" });
  const [draftFilters, setDraftFilters] = useState(filters);
  const [checkout, setCheckout] = useState<CheckoutStart | null>(null);
  const [viewing, setViewing] = useState<SaleRow | null>(null);
  const [confirmRefund, setConfirmRefund] = useState(false);

  const bounds = rangeBounds(range);
  const salesQuery = useQuery({
    queryKey: ["sales", businessId, bounds.from, bounds.to],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<SaleRow[]> => {
      let query = supabase
        .from("sales")
        .select(
          "id, sale_date, status, payment_method, total, notes, is_walk_in, client_id, appointment_id, clients(first_name, last_name, email), team_members(first_name, last_name), sale_items(id, description, price, quantity, service_id, appointment_item_id)",
        )
        .eq("business_id", businessId!)
        .order("sale_date", { ascending: false });
      if (bounds.from) query = query.gte("sale_date", bounds.from);
      if (bounds.to) query = query.lt("sale_date", bounds.to);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as SaleRow[];
    },
  });

  const refund = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales").update({ status: "refunded" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["daily-sales"] });
      toast.success("Sale refunded");
      setConfirmRefund(false);
      setViewing(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filterCount =
    (filters.status !== "all" ? 1 : 0) + (filters.from ? 1 : 0) + (filters.to ? 1 : 0);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = (salesQuery.data ?? [])
      .filter((row) => (tab === "draft" ? row.status === "draft" : row.status !== "draft"))
      .filter((row) => filters.status === "all" || row.status === filters.status)
      .filter((row) => !filters.from || Number(row.total) >= Number(filters.from))
      .filter((row) => !filters.to || Number(row.total) <= Number(filters.to))
      .filter((row) => {
        if (!term) return true;
        const haystack = [saleRef(row.id), personName(row.clients) ?? "walk-in"]
          .join(" ")
          .toLowerCase();
        return haystack.includes(term.replace(/^#/, "")) || haystack.includes(term);
      });
    return list.sort((a, b) => {
      if (sort === "date-asc") return a.sale_date.localeCompare(b.sale_date);
      if (sort === "total-desc") return Number(b.total) - Number(a.total);
      if (sort === "total-asc") return Number(a.total) - Number(b.total);
      return b.sale_date.localeCompare(a.sale_date);
    });
  }, [salesQuery.data, tab, filters, search, sort]);

  function resumeDraft(row: SaleRow) {
    setCheckout({
      saleId: row.id,
      appointmentId: row.appointment_id,
      clientId: row.client_id,
      lines: row.sale_items.map((item) => ({
        key: item.id,
        serviceId: item.service_id,
        description: item.description,
        price: Number(item.price),
        quantity: item.quantity,
        durationMinutes: null,
        teamMemberId: null,
        appointmentItemId: item.appointment_item_id,
      })),
      step: "payment",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        subtitle="View, filter and export the history of your sales."
        learnMore
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    pillButton,
                    "border border-border bg-card hover:bg-secondary data-[state=open]:bg-secondary",
                  )}
                >
                  Options <CaretDown size={13} weight="bold" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5">
                <DropdownMenuItem
                  onSelect={() => toast("Sales settings live in Settings → Sales")}
                  className="gap-3 rounded-lg px-3 py-2 text-[0.9375rem]"
                >
                  <Gear size={18} /> Sales settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={() => setCheckout({})}
              className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
            >
              Add new
            </button>
          </>
        }
      />

      <div className="flex gap-2">
        {(
          [
            ["sales", "Sales"],
            ["draft", "Drafts"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "h-9 rounded-full px-4 text-[0.875rem] font-semibold transition-colors",
              tab === key ? "bg-ink text-ink-foreground" : "text-foreground hover:bg-secondary",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <ListToolbar
        right={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ChipButton>
                Sort by <ArrowsDownUp size={16} />
              </ChipButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-xl p-1.5">
              {(Object.keys(SORT_LABELS) as Sort[]).map((key) => (
                <DropdownMenuItem
                  key={key}
                  onSelect={() => setSort(key)}
                  className="rounded-lg px-3 py-2 text-[0.9375rem]"
                >
                  <span className="flex-1">{SORT_LABELS[key]}</span>
                  {sort === key ? <Check size={14} weight="bold" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <SearchBox value={search} onChange={setSearch} placeholder="Search by Sale or Client" />
        <DateRangeButton value={range} onChange={setRange} />
        <FiltersChip
          count={filterCount}
          onClick={() => {
            setDraftFilters(filters);
            setFiltersOpen(true);
          }}
        />
      </ListToolbar>

      {salesQuery.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-secondary" />
      ) : rows.length === 0 ? (
        <EmptyCard
          icon={<Receipt size={44} weight="duotone" />}
          title={tab === "draft" ? "No draft sales" : "No sales yet"}
          {...(tab === "draft" ? { body: "Sales saved as drafts or unpaid appear here" } : {})}
          action={
            <button
              type="button"
              onClick={() => setCheckout({})}
              className={cn(pillButton, "h-10 border border-border hover:bg-secondary")}
            >
              Create new sale
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[46rem] whitespace-nowrap text-left text-[0.8125rem]">
            <thead>
              <tr className="border-b border-border text-foreground">
                {[
                  "Sale #",
                  "Client",
                  "Status",
                  "Sale date",
                  "Team member",
                  "Payment",
                  "Gross total",
                ].map((label) => (
                  <th
                    key={label}
                    className={cn(
                      "px-4 py-4 font-semibold",
                      label === "Gross total" && "text-right",
                    )}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => (row.status === "draft" ? resumeDraft(row) : setViewing(row))}
                  className="cursor-pointer border-b border-border last:border-b-0 hover:bg-secondary/50"
                >
                  <td className="px-4 py-4 font-medium text-primary">{saleRef(row.id)}</td>
                  <td className="px-4 py-4 text-primary">{personName(row.clients) ?? "Walk-In"}</td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        "inline-flex h-6 items-center rounded-full px-3 font-medium",
                        STATUS_PILL[row.status],
                      )}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-4">{stamp(row.sale_date)}</td>
                  <td className="px-4 py-4">{personName(row.team_members) ?? "—"}</td>
                  <td className="px-4 py-4">
                    {row.status === "draft" ? "Unpaid" : METHOD_LABEL[row.payment_method]}
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">{money(Number(row.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border py-4 text-center text-[0.8125rem] text-muted-foreground">
            Viewing 1 - {rows.length} of {rows.length} results
          </p>
        </div>
      )}

      <FilterModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onClear={() => setDraftFilters({ status: "all", from: "", to: "" })}
        onApply={() => {
          setFilters(draftFilters);
          setFiltersOpen(false);
        }}
      >
        <FilterSelect
          label="Status"
          value={draftFilters.status}
          onChange={(status) => setDraftFilters({ ...draftFilters, status })}
          options={[
            { value: "all", label: "All statuses" },
            { value: "completed", label: "Completed" },
            { value: "draft", label: "Unpaid" },
            { value: "refunded", label: "Refunded" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          {(["from", "to"] as const).map((edge) => (
            <label key={edge} className="text-[0.9375rem] font-semibold">
              {edge === "from" ? "From amount" : "To amount"}
              <span className="mt-2 flex h-12 items-center gap-2 rounded-lg border border-border px-4 font-normal">
                <span className="text-muted-foreground">{business?.currency}</span>
                <input
                  inputMode="decimal"
                  value={draftFilters[edge]}
                  onChange={(event) =>
                    setDraftFilters({
                      ...draftFilters,
                      [edge]: event.target.value.replace(/[^\d.]/g, ""),
                    })
                  }
                  className="h-full w-full bg-transparent outline-none"
                />
              </span>
            </label>
          ))}
        </div>
      </FilterModal>

      {/* Sale details */}
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
            <div className="flex items-start justify-between gap-3 px-6 pb-4 pt-6">
              <div>
                <h2 className="text-[1.75rem] font-bold tracking-tight">
                  Sale {saleRef(viewing.id)}
                </h2>
                <p className="text-[0.875rem] text-muted-foreground">{stamp(viewing.sale_date)}</p>
              </div>
              <span
                className={cn(
                  "mt-2 inline-flex h-7 items-center rounded-full px-3 text-[0.8125rem] font-medium",
                  STATUS_PILL[viewing.status],
                )}
              >
                {STATUS_LABEL[viewing.status]}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6">
              <div className="rounded-2xl border border-border p-4">
                <p className="text-[0.9375rem] font-semibold">
                  {personName(viewing.clients) ?? "Walk-In"}
                </p>
                {viewing.clients?.email ? (
                  <p className="text-[0.8125rem] text-muted-foreground">{viewing.clients.email}</p>
                ) : null}
              </div>
              <div className="mt-5 divide-y divide-border">
                {viewing.sale_items.map((item) => (
                  <div key={item.id} className="flex justify-between py-3 text-[0.9375rem]">
                    <span>
                      {item.description}
                      {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                    </span>
                    <span className="tabular-nums">
                      {money(Number(item.price) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 space-y-1 border-t border-border pt-3 text-[0.9375rem]">
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{money(Number(viewing.total))}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Paid with {METHOD_LABEL[viewing.payment_method]}</span>
                  <span>{money(Number(viewing.total))}</span>
                </div>
              </div>
              {viewing.notes ? (
                <p className="mt-5 rounded-lg bg-secondary/60 px-4 py-3 text-[0.875rem]">
                  {viewing.notes}
                </p>
              ) : null}
            </div>
            <div className="flex gap-3 border-t border-border px-6 py-5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="More actions"
                    className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border hover:bg-secondary"
                  >
                    <DotsThreeVertical size={20} weight="bold" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-52 rounded-xl p-1.5">
                  <DropdownMenuItem
                    onSelect={() => window.print()}
                    className="rounded-lg px-3 py-2 text-[0.9375rem]"
                  >
                    Print receipt
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => toast("Emailing receipts arrives with Marketing → Automations")}
                    className="rounded-lg px-3 py-2 text-[0.9375rem]"
                  >
                    Email receipt
                  </DropdownMenuItem>
                  {viewing.status === "completed" ? (
                    <DropdownMenuItem
                      onSelect={() => setConfirmRefund(true)}
                      className="rounded-lg px-3 py-2 text-[0.9375rem] text-destructive focus:text-destructive"
                    >
                      Refund
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className={cn(pillButton, "h-12 flex-1 bg-ink text-ink-foreground hover:bg-ink/90")}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmRefund && viewing ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal
        >
          <div className="w-full max-w-[30rem] rounded-2xl bg-card p-9">
            <h3 className="text-xl font-semibold">Refund this sale?</h3>
            <p className="mt-3 text-[0.9375rem]">
              {money(Number(viewing.total))} will be marked as refunded and taken out of
              today&apos;s totals.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmRefund(false)}
                className={cn(pillButton, "h-12 border border-border hover:bg-secondary")}
              >
                Go back
              </button>
              <button
                type="button"
                disabled={refund.isPending}
                onClick={() => refund.mutate(viewing.id)}
                className={cn(pillButton, "h-12 bg-[#c8273a] text-white hover:bg-[#b01f31]")}
              >
                {refund.isPending ? "Refunding…" : "Refund"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CheckoutScreen open={checkout !== null} start={checkout} onClose={() => setCheckout(null)} />
    </div>
  );
}
