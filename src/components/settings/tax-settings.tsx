import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

import { isMissingTable } from "@/components/calendar/blocked-time";
import { ConfirmDialog } from "@/components/catalog/catalog-ui";
import { pillButton } from "@/components/sales/list-ui";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

const card = "rounded-xl bg-card shadow-[inset_0_0_0_1px_var(--color-border)]";
const field =
  "mt-2 h-12 w-full rounded-[8px] border border-input bg-card px-4 text-body font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

export type TaxRate = { id: string; name: string; rate: number };

export function useTaxRates() {
  const { data: business } = useBusiness();
  return useQuery({
    queryKey: ["tax-rates", business?.id],
    enabled: Boolean(business?.id),
    retry: false,
    queryFn: async (): Promise<TaxRate[]> => {
      const { data, error } = await supabase.from("tax_rates").select("id, name, rate").eq("business_id", business!.id).order("name");
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, rate: Number(r.rate) }));
    },
  });
}

/** Select for a service or product: "Default" uses the business default rate. */
export function TaxRateSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const rates = useTaxRates();
  if (!rates.data?.length) return null;
  return (
    <label className="block text-body font-semibold">
      Sales tax
      <select value={value} onChange={(e) => onChange(e.target.value)} className={field}>
        <option value="">Business default</option>
        {rates.data.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} ({r.rate}%)
          </option>
        ))}
      </select>
      <span className="mt-1 block text-caption font-normal text-muted-foreground">Prices include tax.</span>
    </label>
  );
}

/** Settings → Sales: "tax" shows tax rates; "receipts" shows the receipt footer. */
export function TaxSettings({ view }: { view: "tax" | "receipts" }) {
  const { data: business } = useBusiness();
  const queryClient = useQueryClient();
  const rates = useTaxRates();
  const [form, setForm] = useState({ name: "VAT", rate: "7.5" });
  const [remove, setRemove] = useState<TaxRate | null>(null);
  const biz = useQuery({
    queryKey: ["business-tax", business?.id],
    enabled: Boolean(business?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("businesses").select("*").eq("id", business!.id).single();
      if (error) throw error;
      return data as { default_tax_rate_id?: string | null; receipt_footer?: string | null };
    },
  });
  const [footer, setFooter] = useState("");
  useEffect(() => {
    if (biz.data) setFooter(biz.data.receipt_footer ?? "");
  }, [biz.data]);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["tax-rates"] });
    queryClient.invalidateQueries({ queryKey: ["business-tax"] });
    queryClient.invalidateQueries({ queryKey: ["checkout-tax"] });
  };
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tax_rates").insert({ business_id: business!.id, name: form.name.trim(), rate: Number(form.rate) });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Tax rate added");
    },
    onError: (e: { code?: string; message: string }) => toast.error(e.code === "23505" ? "A rate with that name already exists" : e.message),
  });
  const update = useMutation({
    mutationFn: async (patch: { default_tax_rate_id?: string | null; receipt_footer?: string | null }) => {
      const { error } = await supabase.from("businesses").update(patch).eq("id", business!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tax_rates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setRemove(null);
      refresh();
      toast.success("Tax rate deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (isMissingTable(rates.error as { code?: string; message?: string } | null)) {
    return (
      <p className="rounded-xl bg-warning-soft px-5 py-4 text-body text-warning">
        Tax rates need a database update first: run notes/supabase-update-2026-10-19.sql in Supabase.
      </p>
    );
  }
  if (view === "receipts") {
    return (
      <section className="space-y-6">
        <div>
          <h2 className="text-display font-semibold leading-9 text-foreground">Receipts</h2>
          <p className="mt-1 max-w-2xl text-body text-muted-foreground">
            Every receipt shows your business name, address, the items, tax and how it was paid. Add a
            line of your own at the bottom.
          </p>
        </div>
        <div className={cn(card, "p-6")}>
          <label className="block text-body font-semibold">
            Receipt footer <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea rows={2} maxLength={300} value={footer} placeholder="e.g. Thank you for visiting! Follow us @yoursalon" onChange={(e) => setFooter(e.target.value)} className="mt-2 w-full resize-none rounded-[8px] border border-input p-4 text-body font-normal" />
          </label>
          <button type="button" disabled={footer === (biz.data?.receipt_footer ?? "")} onClick={() => update.mutate({ receipt_footer: footer.trim() || null })} className={cn(pillButton, "mt-3 border border-input bg-card hover:bg-secondary")}>
            Save footer
          </button>
        </div>
      </section>
    );
  }
  const valid = form.name.trim() && form.rate !== "" && Number(form.rate) >= 0 && Number(form.rate) <= 100;
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-display font-semibold leading-9 text-foreground">Tax rates</h2>
        <p className="mt-1 max-w-2xl text-body text-muted-foreground">
          Prices include tax. Checkout shows how much of each sale is tax, and it appears on receipts and in reports. Give services and
          products their own rate, or they use the default.
        </p>
      </div>
      <form
        className={cn(card, "grid items-end gap-3 p-6 sm:grid-cols-[2fr_1fr_auto]")}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) add.mutate();
        }}
      >
        <label className="block text-body font-semibold">
          Name
          <input value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
        </label>
        <label className="block text-body font-semibold">
          Rate (%)
          <input inputMode="decimal" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value.replace(/[^0-9.]/g, "") })} className={field} />
        </label>
        <button type="submit" disabled={!valid || add.isPending} className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}>
          Add
        </button>
      </form>
      <ul className={cn(card, "divide-y divide-border")}>
        {(rates.data ?? []).map((r) => (
          <li key={r.id} className="flex items-center gap-4 px-5 py-3">
            <span className="flex-1 text-body font-medium">
              {r.name} <span className="text-muted-foreground">{r.rate}%</span>
              {biz.data?.default_tax_rate_id === r.id ? (
                <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-caption font-semibold text-primary">Default</span>
              ) : null}
            </span>
            {biz.data?.default_tax_rate_id !== r.id ? (
              <button type="button" onClick={() => update.mutate({ default_tax_rate_id: r.id })} className="text-body font-medium text-primary hover:underline">
                Make default
              </button>
            ) : (
              <button type="button" onClick={() => update.mutate({ default_tax_rate_id: null })} className="text-body font-medium text-muted-foreground hover:underline">
                Remove default
              </button>
            )}
            <button type="button" aria-label={`Delete ${r.name}`} onClick={() => setRemove(r)} className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary">
              <Trash size={18} />
            </button>
          </li>
        ))}
        {rates.data && rates.data.length === 0 ? <li className="px-5 py-8 text-center text-body text-muted-foreground">No tax rates. Sales show no tax.</li> : null}
      </ul>
      <ConfirmDialog
        open={remove !== null}
        destructive
        busy={del.isPending}
        title="Delete tax rate"
        body="Services and products using it fall back to the default. Past sales keep their tax."
        confirmLabel="Delete"
        onConfirm={() => remove && del.mutate(remove.id)}
        onClose={() => setRemove(null)}
      />
    </section>
  );
}
