import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Tag, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { isMissingTable } from "@/components/calendar/blocked-time";
import { ConfirmDialog } from "@/components/catalog/catalog-ui";
import { FeatureIntro, pillButton } from "@/components/sales/list-ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import { isoDay } from "@/lib/team-shifts";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

type Deal = {
  id: string;
  name: string;
  code: string;
  discount_type: string;
  value: number;
  applies_to: string;
  starts_on: string | null;
  ends_on: string | null;
  max_uses: number | null;
  online: boolean;
  is_active: boolean;
  deal_redemptions: { amount: number }[];
};

const field =
  "mt-2 h-12 w-full rounded-[8px] border border-input bg-card px-4 text-body font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
const dateFmt = (d: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${d}T12:00:00`));

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function DealsPage() {
  const { data: business } = useBusiness();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Deal | "new" | null>(null);
  const [remove, setRemove] = useState<Deal | null>(null);
  const money = (n: number) => (business ? formatMoney(n, business.currency, business.country) : String(n));
  const deals = useQuery({
    queryKey: ["deals", business?.id],
    enabled: Boolean(business?.id),
    retry: false,
    queryFn: async (): Promise<Deal[]> => {
      const { data, error } = await supabase
        .from("deals")
        .select("*, deal_redemptions(amount)")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Deal[];
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["deals"] });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setRemove(null);
      refresh();
      toast.success("Deal deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isMissingTable(deals.error as { code?: string; message?: string } | null)) {
    return (
      <p className="rounded-xl bg-warning-soft px-5 py-4 text-body text-warning">
        Deals need a database update first: run notes/supabase-update-2026-10-19.sql in Supabase.
      </p>
    );
  }
  if (deals.data && deals.data.length === 0 && editing === null) {
    return (
      <FeatureIntro
        title="Reward and keep clients with deals"
        body="Create discount codes clients can use at checkout or when they book online."
        bullets={[
          "Percentage or fixed-amount discounts",
          "Set start and end dates, and a usage limit",
          "Choose whether a code works online or only in the salon",
          "See how often each code is used and what it's cost you",
        ]}
        cta="Create a deal"
        onStart={() => setEditing("new")}
      />
    );
  }

  const today = isoDay(new Date());
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display font-semibold">Deals</h1>
          <p className="mt-1 text-body text-muted-foreground">Discount codes for checkout and online booking.</p>
        </div>
        <button type="button" onClick={() => setEditing("new")} className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}>
          Add
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-[760px]">
          <thead>
            <tr>
              <th className="px-4">Deal</th>
              <th className="px-4">Discount</th>
              <th className="px-4">Runs</th>
              <th className="px-4">Uses</th>
              <th className="px-4 text-right">Discount given</th>
              <th className="px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {(deals.data ?? []).map((d) => {
              const used = d.deal_redemptions.length;
              const given = d.deal_redemptions.reduce((s, r) => s + Number(r.amount), 0);
              const status = !d.is_active
                ? "Paused"
                : d.ends_on && d.ends_on < today
                  ? "Ended"
                  : d.starts_on && d.starts_on > today
                    ? "Scheduled"
                    : d.max_uses && used >= d.max_uses
                      ? "Used up"
                      : "Active";
              return (
                <tr key={d.id} className="cursor-pointer" onClick={() => setEditing(d)}>
                  <td className="px-4">
                    <span className="block font-semibold">{d.name}</span>
                    <span className="flex items-center gap-2 text-caption text-muted-foreground">
                      <span className="font-mono">{d.code}</span>
                      <button
                        type="button"
                        aria-label={`Copy ${d.code}`}
                        onClick={async (event) => {
                          event.stopPropagation();
                          try {
                            await navigator.clipboard.writeText(d.code);
                            toast.success("Code copied");
                          } catch {
                            toast.error("Couldn't copy");
                          }
                        }}
                        className="rounded p-0.5 hover:bg-secondary"
                      >
                        <Copy size={14} />
                      </button>
                      {d.online ? "" : "· salon only"}
                    </span>
                  </td>
                  <td className="px-4">
                    {d.discount_type === "percent" ? `${Number(d.value)}% off` : `${money(Number(d.value))} off`}
                    <span className="block text-caption text-muted-foreground">{d.applies_to === "all" ? "Whole sale" : "Services"}</span>
                  </td>
                  <td className="px-4 text-muted-foreground">
                    {d.starts_on || d.ends_on ? `${d.starts_on ? dateFmt(d.starts_on) : "Now"} – ${d.ends_on ? dateFmt(d.ends_on) : "No end"}` : "No end date"}
                  </td>
                  <td className="px-4 tabular-nums">
                    {used}
                    {d.max_uses ? ` / ${d.max_uses}` : ""}
                  </td>
                  <td className="px-4 text-right tabular-nums">{money(given)}</td>
                  <td className="px-4">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-caption font-semibold",
                        status === "Active" ? "bg-success-soft text-success" : status === "Scheduled" ? "bg-accent text-primary" : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <DealDialog value={editing} onClose={() => setEditing(null)} onSaved={refresh} onDelete={(d) => setRemove(d)} />
      <ConfirmDialog
        open={remove !== null}
        destructive
        busy={del.isPending}
        title="Delete deal"
        body="The code stops working, and its usage history is removed. Pause it instead to keep the history."
        confirmLabel="Delete"
        onConfirm={() => remove && del.mutate(remove.id)}
        onClose={() => setRemove(null)}
      />
    </div>
  );
}

function DealDialog({
  value,
  onClose,
  onSaved,
  onDelete,
}: {
  value: Deal | "new" | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete: (d: Deal) => void;
}) {
  const { data: business } = useBusiness();
  const empty = { name: "", code: "", type: "percent", value: "10", applies: "services", starts: "", ends: "", max: "", online: true, active: true };
  const [form, setForm] = useState(empty);
  useEffect(() => {
    if (value === "new") setForm({ ...empty, code: randomCode() });
    else if (value)
      setForm({
        name: value.name,
        code: value.code,
        type: value.discount_type,
        value: String(value.value),
        applies: value.applies_to,
        starts: value.starts_on ?? "",
        ends: value.ends_on ?? "",
        max: value.max_uses ? String(value.max_uses) : "",
        online: value.online,
        active: value.is_active,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const amount = Number(form.value);
  const valid =
    form.name.trim() &&
    /^[A-Z0-9]{3,20}$/.test(form.code) &&
    amount > 0 &&
    (form.type !== "percent" || amount <= 100) &&
    (!form.starts || !form.ends || form.ends >= form.starts);
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        business_id: business!.id,
        name: form.name.trim(),
        code: form.code,
        discount_type: form.type,
        value: amount,
        applies_to: form.applies,
        starts_on: form.starts || null,
        ends_on: form.ends || null,
        max_uses: form.max ? Number(form.max) : null,
        online: form.online,
        is_active: form.active,
      };
      const { error } =
        value === "new" ? await supabase.from("deals").insert(payload) : await supabase.from("deals").update(payload).eq("id", (value as Deal).id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deal saved");
      onSaved();
      onClose();
    },
    onError: (e: { code?: string; message: string }) => toast.error(e.code === "23505" ? "Another deal already uses that code" : e.message),
  });
  return (
    <Dialog open={value !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[36rem] gap-0 overflow-y-auto rounded-2xl border-0 p-0 [&>button]:hidden">
        <div className="flex items-start justify-between gap-4 px-8 pt-6">
          <DialogTitle className="flex items-center gap-2 pt-3 text-title font-semibold">
            <Tag size={22} className="text-primary" /> {value === "new" ? "Create deal" : "Edit deal"}
          </DialogTitle>
          <button type="button" aria-label="Close" onClick={onClose} className="flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-secondary">
            <X size={20} />
          </button>
        </div>
        <DialogDescription className="sr-only">Discount code details</DialogDescription>
        <div className="space-y-4 px-8 pt-4">
          <label className="block text-body font-semibold">
            Name <span className="text-destructive">*</span>
            <input value={form.name} maxLength={120} placeholder="e.g. Launch week" onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
          </label>
          <label className="block text-body font-semibold">
            Code
            <span className="mt-2 flex gap-2">
              <input
                value={form.code}
                maxLength={20}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
                className={cn(field, "mt-0 font-mono uppercase tracking-wider")}
              />
              <button type="button" onClick={() => setForm({ ...form, code: randomCode() })} className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}>
                Generate
              </button>
            </span>
            <span className="mt-1 block text-caption font-normal text-muted-foreground">3–20 letters and numbers. Clients type this at checkout or when booking.</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-body font-semibold">
              Discount
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={field}>
                <option value="percent">Percentage (%)</option>
                <option value="amount">Fixed amount ({business?.currency})</option>
              </select>
            </label>
            <label className="block text-body font-semibold">
              Value
              <input inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value.replace(/[^0-9.]/g, "") })} className={field} />
            </label>
          </div>
          <label className="block text-body font-semibold">
            Applies to
            <select value={form.applies} onChange={(e) => setForm({ ...form, applies: e.target.value })} className={field}>
              <option value="services">Services only</option>
              <option value="all">Whole sale (services and products)</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-body font-semibold">
              Starts <span className="font-normal text-muted-foreground">(optional)</span>
              <input type="date" value={form.starts} onChange={(e) => setForm({ ...form, starts: e.target.value })} className={field} />
            </label>
            <label className="block text-body font-semibold">
              Ends <span className="font-normal text-muted-foreground">(optional)</span>
              <input type="date" value={form.ends} min={form.starts || undefined} onChange={(e) => setForm({ ...form, ends: e.target.value })} className={field} />
            </label>
          </div>
          <label className="block text-body font-semibold">
            Usage limit <span className="font-normal text-muted-foreground">(optional)</span>
            <input inputMode="numeric" value={form.max} placeholder="Unlimited" onChange={(e) => setForm({ ...form, max: e.target.value.replace(/[^0-9]/g, "") })} className={field} />
          </label>
          <label className="flex items-center justify-between gap-4 text-body font-semibold">
            Can be used on the booking page
            <Switch checked={form.online} onCheckedChange={(online) => setForm({ ...form, online })} />
          </label>
          <label className="flex items-center justify-between gap-4 text-body font-semibold">
            Active
            <Switch checked={form.active} onCheckedChange={(active) => setForm({ ...form, active })} />
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2 px-8 pb-8 pt-8">
          {value && value !== "new" ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onDelete(value);
              }}
              className={cn(pillButton, "mr-auto border border-input bg-card text-destructive hover:bg-secondary")}
            >
              Delete
            </button>
          ) : null}
          <button type="button" onClick={onClose} className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}>
            Cancel
          </button>
          <button type="button" disabled={!valid || save.isPending} onClick={() => save.mutate()} className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}>
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
