import { useMemo, useState } from "react";
import { CaretDown, CreditCard, Gift, IdentificationBadge, Package } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  DateRangeButton,
  EmptyCard,
  FeatureIntro,
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
import { SkeletonTable } from "@/components/ui/skeletons";

const NEEDS_SETUP = "This arrives with the Catalog tab (it needs its own database table)";

function OptionsMenu({ items }: { items: Array<{ label: string; onSelect: () => void }> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            pillButton,
            "border border-input bg-card hover:bg-secondary data-[state=open]:bg-secondary",
          )}
        >
          Options <CaretDown size={13} weight="bold" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            onSelect={item.onSelect}
            className="rounded-lg px-3 py-2 text-body"
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const exportItems = ["PDF", "CSV", "Excel"].map((format) => ({
  label: `Export ${format}`,
  onSelect: () => toast(`Export ${format} — coming with Reports`),
}));

// ─── Payments ──────────────────────────────────────────────────────────────

type PaymentRow = {
  id: string;
  sale_date: string;
  status: "draft" | "completed" | "refunded";
  payment_method: "cash" | "card" | "other";
  total: number;
  team_member_id: string | null;
  clients: { first_name: string; last_name: string | null } | null;
  team_members: { first_name: string; last_name: string | null } | null;
};

const METHOD_LABEL = { cash: "Cash", card: "Card", other: "Other" } as const;

export function PaymentsList() {
  const { data: business } = useBusiness();
  const businessId = business?.id;
  const money = (value: number) =>
    business ? formatMoney(value, business.currency, business.country) : "—";
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRange>(() => makeRange("last30"));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ member: "all", type: "all", from: "", to: "" });
  const [draft, setDraft] = useState(filters);
  const bounds = rangeBounds(range);

  const { data = [], isLoading } = useQuery({
    queryKey: ["payments-list", businessId, bounds.from, bounds.to],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<PaymentRow[]> => {
      let query = supabase
        .from("sales")
        .select(
          "id, sale_date, status, payment_method, total, team_member_id, clients(first_name, last_name), team_members(first_name, last_name)",
        )
        .eq("business_id", businessId!)
        .neq("status", "draft")
        .order("sale_date", { ascending: false });
      if (bounds.from) query = query.gte("sale_date", bounds.from);
      if (bounds.to) query = query.lt("sale_date", bounds.to);
      const { data: rows, error } = await query;
      if (error) throw error;
      return (rows ?? []) as unknown as PaymentRow[];
    },
  });
  const { data: members = [] } = useQuery({
    queryKey: ["payments-members", businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("team_members")
        .select("id, first_name, last_name")
        .eq("business_id", businessId!)
        .order("created_at");
      if (error) throw error;
      return rows ?? [];
    },
  });

  const name = (person: { first_name: string; last_name: string | null } | null) =>
    person ? [person.first_name, person.last_name].filter(Boolean).join(" ") : null;
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase().replace(/^#/, "");
    return data
      .filter((row) => filters.member === "all" || row.team_member_id === filters.member)
      .filter(
        (row) =>
          filters.type === "all" ||
          (filters.type === "refund" ? row.status === "refunded" : row.status === "completed"),
      )
      .filter((row) => !filters.from || Number(row.total) >= Number(filters.from))
      .filter((row) => !filters.to || Number(row.total) <= Number(filters.to))
      .filter(
        (row) =>
          !term ||
          `${row.id.slice(0, 8)} ${name(row.clients) ?? "walk-in"}`.toLowerCase().includes(term),
      );
  }, [data, filters, search]);
  const count =
    (filters.member !== "all" ? 1 : 0) +
    (filters.type !== "all" ? 1 : 0) +
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment transactions"
        subtitle="View, filter and export the history of your payments."
        actions={<OptionsMenu items={exportItems} />}
      />
      <ListToolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search by Sale or Client" />
        <DateRangeButton value={range} onChange={setRange} />
        <FiltersChip
          count={count}
          onClick={() => {
            setDraft(filters);
            setFiltersOpen(true);
          }}
        />
      </ListToolbar>
      {isLoading ? (
        <SkeletonTable cols={6} label="Loading sales" />
      ) : rows.length === 0 ? (
        <EmptyCard
          icon={<CreditCard size={44} weight="duotone" />}
          title="No results found"
          body="Try adjusting your search and filters."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[44rem] whitespace-nowrap">
            <thead>
              <tr className="border-b border-border">
                {[
                  "Payment date",
                  "Sale #",
                  "Client",
                  "Team member",
                  "Type",
                  "Method",
                  "Amount",
                ].map((label) => (
                  <th
                    key={label}
                    className={cn("px-4 py-4 font-semibold", label === "Amount" && "text-right")}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-4">
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hourCycle: "h23",
                    }).format(new Date(row.sale_date))}
                  </td>
                  <td className="px-4 py-4 font-medium text-primary">
                    #{row.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-4">{name(row.clients) ?? "Walk-In"}</td>
                  <td className="px-4 py-4">{name(row.team_members) ?? "—"}</td>
                  <td className="px-4 py-4">{row.status === "refunded" ? "Refund" : "Sale"}</td>
                  <td className="px-4 py-4">{METHOD_LABEL[row.payment_method]}</td>
                  <td
                    className={cn(
                      "px-4 py-4 text-right tabular-nums",
                      row.status === "refunded" && "text-destructive",
                    )}
                  >
                    {row.status === "refunded" ? "-" : ""}
                    {money(Number(row.total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <FilterModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onClear={() => setDraft({ member: "all", type: "all", from: "", to: "" })}
        onApply={() => {
          setFilters(draft);
          setFiltersOpen(false);
        }}
      >
        <FilterSelect
          label="Team member"
          value={draft.member}
          onChange={(member) => setDraft({ ...draft, member })}
          options={[
            { value: "all", label: "All team members" },
            ...members.map((member) => ({ value: member.id, label: name(member)! })),
          ]}
        />
        <FilterSelect
          label="Type"
          value={draft.type}
          onChange={(type) => setDraft({ ...draft, type })}
          options={[
            { value: "all", label: "All types" },
            { value: "sale", label: "Sale" },
            { value: "refund", label: "Refund" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          {(["from", "to"] as const).map((edge) => (
            <label key={edge} className="text-body font-semibold">
              {edge === "from" ? "From amount" : "To amount"}
              <input
                inputMode="decimal"
                value={draft[edge]}
                onChange={(event) =>
                  setDraft({ ...draft, [edge]: event.target.value.replace(/[^\d.]/g, "") })
                }
                className="mt-2 h-12 w-full rounded-lg border border-border px-4 font-normal"
              />
            </label>
          ))}
        </div>
      </FilterModal>
    </div>
  );
}

// ─── Register ──────────────────────────────────────────────────────────────

export function RegisterIntro() {
  return (
    <FeatureIntro
      title="Track cash movements confidently with registers"
      body="Streamline your sales and payments using registers, with everything you need to handle daily transactions and stay on top of balances."
      bullets={[
        "Everything accounted for with daily opening and closing",
        "Seamlessly track every cash movement for full visibility",
        "Stay on top of petty cash and float balances",
      ]}
      onStart={() => toast("Registers need their own database table, coming in a later update")}
      art={
        <div className="rounded-3xl bg-card p-5 shadow-lg">
          <p className="text-body font-semibold">Register</p>
          <div className="mt-3 rounded-2xl border border-border p-4">
            <p className="text-[0.75rem] text-muted-foreground">Front Desk balance</p>
            <p className="text-2xl font-semibold">₦325,500</p>
          </div>
          {["Tip payout", "Cash sale", "Cash sale", "Petty cash"].map((label, index) => (
            <div
              key={`${label}-${index}`}
              className="mt-2 flex justify-between rounded-xl border border-border px-3 py-2 text-caption"
            >
              <span>{label}</span>
              <span className="font-medium">
                {index % 3 === 0 ? "-" : "+"}₦{(index + 1) * 2000}
              </span>
            </div>
          ))}
        </div>
      }
    />
  );
}

// ─── Sold items ────────────────────────────────────────────────────────────
