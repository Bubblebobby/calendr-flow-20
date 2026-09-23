import { useMemo, useState } from "react";
import { DotsThreeVertical } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { SaleDialog } from "@/components/sales/sale-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { businessLocale, formatMoney } from "@/lib/format";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

type SaleRow = {
  id: string;
  sale_date: string;
  status: "draft" | "completed" | "refunded";
  payment_method: "cash" | "card" | "other";
  total: number;
  is_walk_in: boolean;
  clients: { first_name: string; last_name: string | null } | null;
  team_members: { first_name: string; last_name: string | null } | null;
  sale_items: { id: string; description: string; price: number; quantity: number }[];
};

const soon = (label: string) => toast(`${label} — coming soon`);

const personName = (row: { first_name: string; last_name: string | null } | null) =>
  row ? [row.first_name, row.last_name].filter(Boolean).join(" ").trim() : null;

const statusStyles: Record<SaleRow["status"], string> = {
  draft: "border-border bg-muted text-muted-foreground",
  completed: "border-transparent bg-primary/10 text-primary",
  refunded: "border-transparent bg-destructive/10 text-destructive",
};

const methodLabel: Record<SaleRow["payment_method"], string> = {
  cash: "Cash",
  card: "Card",
  other: "Other",
};

export function SalesList() {
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const businessId = business?.id;

  const [tab, setTab] = useState<"sales" | "draft">("sales");
  const [addOpen, setAddOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const salesQuery = useQuery({
    queryKey: ["sales", businessId],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<SaleRow[]> => {
      const { data, error } = await supabase
        .from("sales")
        .select(
          "id, sale_date, status, payment_method, total, is_walk_in, clients(first_name, last_name), team_members(first_name, last_name), sale_items(id, description, price, quantity)",
        )
        .eq("business_id", businessId!)
        .order("sale_date", { ascending: false });
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
      queryClient.invalidateQueries({ queryKey: ["sales", businessId] });
      toast.success("Sale refunded");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = useMemo(() => {
    const all = salesQuery.data ?? [];
    return tab === "draft"
      ? all.filter((row) => row.status === "draft")
      : all.filter((row) => row.status === "completed" || row.status === "refunded");
  }, [salesQuery.data, tab]);

  const gross = rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);

  const money = (value: number) =>
    business ? formatMoney(value, business.currency, business.country) : "—";

  const dateFormatter = new Intl.DateTimeFormat(businessLocale(business?.country), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Sales</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Record payments, review completed sales and keep drafts for later.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {["PDF", "CSV", "Excel"].map((label) => (
            <Button
              key={label}
              variant="outline"
              className="h-11 rounded-full border-border bg-white px-5 text-sm font-semibold"
              onClick={() => soon(`Export ${label}`)}
            >
              {label}
            </Button>
          ))}
          <Button className="h-11 rounded-full px-7 text-sm font-semibold" onClick={() => setAddOpen(true)}>
            Add sale
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card px-5 py-4">
          <p className="text-sm text-muted-foreground">Sales</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{rows.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-5 py-4">
          <p className="text-sm text-muted-foreground">Gross total</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{money(gross)}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-4 font-bold text-foreground">Date</th>
              <th className="px-4 py-4 font-bold text-foreground">Client</th>
              <th className="px-4 py-4 font-bold text-foreground">Team member</th>
              <th className="px-4 py-4 font-bold text-foreground">Total</th>
              <th className="px-4 py-4 font-bold text-foreground">Payment</th>
              <th className="px-4 py-4 font-bold text-foreground">Status</th>
              <th className="w-12 px-4 py-4" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  {salesQuery.isLoading ? "Loading sales…" : "No sales here yet."}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <>
                <tr key={row.id} className="border-b border-border">
                  <td className="px-4 py-4 text-foreground">
                    {dateFormatter.format(new Date(row.sale_date))}
                  </td>
                  <td className="px-4 py-4 font-medium text-foreground">
                    {personName(row.clients) ?? "Walk-in"}
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {personName(row.team_members) ?? "–"}
                  </td>
                  <td className="px-4 py-4 text-foreground">{money(Number(row.total ?? 0))}</td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {methodLabel[row.payment_method]}
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant="outline" className={cn("capitalize", statusStyles[row.status])}>
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-full"
                          aria-label="Sale actions"
                        >
                          <DotsThreeVertical size={18} weight="bold" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 p-2">
                        <DropdownMenuItem
                          className="px-3 py-2 text-sm font-medium"
                          onClick={() =>
                            setExpanded((prev) => (prev === row.id ? null : row.id))
                          }
                        >
                          View
                        </DropdownMenuItem>
                        {row.status === "completed" && (
                          <DropdownMenuItem
                            className="px-3 py-2 text-sm font-medium text-destructive focus:text-destructive"
                            onClick={() => refund.mutate(row.id)}
                          >
                            Refund
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
                {expanded === row.id && (
                  <tr key={`${row.id}-items`} className="border-b border-border bg-muted/40">
                    <td colSpan={7} className="px-8 py-4">
                      <ul className="space-y-1.5">
                        {row.sale_items.map((item) => (
                          <li key={item.id} className="flex justify-between text-sm">
                            <span className="text-foreground">
                              {item.description}
                              {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                            </span>
                            <span className="text-muted-foreground">
                              {money(Number(item.price) * item.quantity)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <SaleDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
