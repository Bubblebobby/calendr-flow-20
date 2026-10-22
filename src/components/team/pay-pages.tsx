import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CaretLeft, CaretRight, Clock, DotsThreeVertical, Money, Plus, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { isMissingTable } from "@/components/calendar/blocked-time";
import { ConfirmDialog } from "@/components/catalog/catalog-ui";
import { memberName, useTeamMembers } from "@/components/catalog/service-team-members";
import { FeatureIntro, pillButton } from "@/components/sales/list-ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import { computePay, workedHours, type PayLine } from "@/lib/pay";
import { addDays, isoDay, weekStart } from "@/lib/team-shifts";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";
import { csvCell } from "@/lib/csv";
import { SkeletonRows, SkeletonTable } from "@/components/ui/skeletons";

const NOTICE = "Timesheets and pay runs need a database update first: run notes/supabase-update-2026-10-19.sql in Supabase.";
const field = "mt-2 h-12 w-full rounded-[8px] border border-input bg-card px-4 text-body font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
const menuItem = "h-10 rounded-[8px] px-3 text-body font-medium";
const missing = (e: unknown) => isMissingTable(e as { code?: string; message?: string } | null);
const fmtDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
const fmtTime = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const hoursLabel = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;
/** Local "YYYY-MM-DDTHH:MM" for datetime-local inputs. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return `${isoDay(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function useMoney() {
  const { data: business } = useBusiness();
  return (n: number) => (business ? formatMoney(n, business.currency, business.country) : String(n));
}

type Entry = { id: string; team_member_id: string; clock_in: string; clock_out: string | null; break_minutes: number; notes: string | null };

// ─── Timesheets ─────────────────────────────────────────────────────────────

export function TimesheetsPage() {
  const { data: business } = useBusiness();
  const queryClient = useQueryClient();
  const members = useTeamMembers(business?.id).data ?? [];
  const [anchor, setAnchor] = useState(() => weekStart(isoDay(new Date())));
  const [editing, setEditing] = useState<Entry | { memberId: string } | null>(null);
  const [remove, setRemove] = useState<Entry | null>(null);
  const from = new Date(`${anchor}T00:00:00`);
  const to = new Date(`${addDays(anchor, 7)}T00:00:00`);

  const entries = useQuery({
    queryKey: ["timesheets", business?.id, anchor],
    enabled: Boolean(business?.id),
    retry: false,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Entry[]> => {
      const { data, error } = await supabase
        .from("timesheets")
        .select("id, team_member_id, clock_in, clock_out, break_minutes, notes")
        .eq("business_id", business!.id)
        .or(`clock_out.is.null,and(clock_in.gte.${from.toISOString()},clock_in.lt.${to.toISOString()})`)
        .order("clock_in", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["timesheets"] });
  const clock = useMutation({
    mutationFn: async ({ memberId, open }: { memberId: string; open: Entry | undefined }) => {
      if (open) {
        const { error } = await supabase.from("timesheets").update({ clock_out: new Date().toISOString() }).eq("id", open.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("timesheets").insert({ business_id: business!.id, team_member_id: memberId, clock_in: new Date().toISOString() });
        if (error) throw error;
      }
      return open ? "out" : "in";
    },
    onSuccess: (dir) => {
      refresh();
      toast.success(dir === "in" ? "Clocked in" : "Clocked out");
    },
    onError: (e: { message: string }) => toast.error(/one_open/.test(e.message) ? "Already clocked in" : /timesheets_length/.test(e.message) ? "That shift is over 24 hours: edit the entry instead" : e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timesheets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setRemove(null);
      refresh();
      toast.success("Entry deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (missing(entries.error)) return <p className="rounded-xl bg-[#fff7e6] px-5 py-4 text-body text-[#7a4b00]">{NOTICE}</p>;
  const list = entries.data ?? [];
  const weekEntries = list.filter((e) => new Date(e.clock_in) >= from && new Date(e.clock_in) < to);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display font-semibold">Timesheets</h1>
          <p className="mt-1 text-body text-muted-foreground">Clock team members in and out, and correct entries. Hours feed into pay runs.</p>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {members.map((m) => {
          const open = list.find((e) => e.team_member_id === m.id && !e.clock_out);
          const week = weekEntries.filter((e) => e.team_member_id === m.id).reduce((s, e) => s + workedHours(e), 0);
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-xl bg-card p-4 shadow-[inset_0_0_0_1px_var(--color-border)]">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full text-body font-semibold" style={{ backgroundColor: m.avatar_color }}>
                {m.initials || m.first_name[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold">{memberName(m)}</span>
                <span className={cn("block text-caption", open ? "text-[#1f8a3e]" : "text-muted-foreground")}>
                  {open ? `Clocked in since ${fmtTime(open.clock_in)}` : `${hoursLabel(week)} this week`}
                </span>
              </span>
              <button
                type="button"
                disabled={clock.isPending}
                onClick={() => clock.mutate({ memberId: m.id, open })}
                className={cn(pillButton, "h-10 px-4 text-body", open ? "border border-input bg-card hover:bg-secondary" : "bg-ink text-ink-foreground hover:bg-ink/90")}
              >
                <Clock size={18} /> {open ? "Clock out" : "Clock in"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-toolbar p-4">
        <button type="button" disabled={!members.length} onClick={() => setEditing({ memberId: members[0]!.id })} className="inline-flex h-9 items-center gap-2 rounded-full border border-input bg-card px-4 text-body font-medium hover:bg-secondary">
          <Plus size={16} /> Add entry
        </button>
        <div className="flex h-9 items-center overflow-hidden rounded-full border border-input bg-card">
          <button type="button" aria-label="Previous week" onClick={() => setAnchor(addDays(anchor, -7))} className="flex h-full w-10 items-center justify-center hover:bg-secondary">
            <CaretLeft size={16} />
          </button>
          <span className="border-x border-input px-4 text-body font-medium">
            {fmtDate(from.toISOString())} – {fmtDate(addDays(anchor, 6) + "T12:00:00")}
          </span>
          <button type="button" aria-label="Next week" onClick={() => setAnchor(addDays(anchor, 7))} className="flex h-full w-10 items-center justify-center hover:bg-secondary">
            <CaretRight size={16} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table min-w-[720px]">
          <thead>
            <tr>
              <th className="px-4">Team member</th>
              <th className="px-4">Date</th>
              <th className="px-4">In</th>
              <th className="px-4">Out</th>
              <th className="px-4 text-right">Break</th>
              <th className="px-4 text-right">Worked</th>
              <th className="w-12 px-4" />
            </tr>
          </thead>
          <tbody>
            {weekEntries.map((e) => {
              const m = members.find((x) => x.id === e.team_member_id);
              return (
                <tr key={e.id}>
                  <td className="px-4 font-semibold">{m ? memberName(m) : "—"}</td>
                  <td className="px-4">{fmtDate(e.clock_in)}</td>
                  <td className="px-4 tabular-nums">{fmtTime(e.clock_in)}</td>
                  <td className="px-4 tabular-nums">{e.clock_out ? fmtTime(e.clock_out) : <span className="text-[#1f8a3e]">Working</span>}</td>
                  <td className="px-4 text-right tabular-nums">{e.break_minutes ? `${e.break_minutes} min` : "—"}</td>
                  <td className="px-4 text-right font-semibold tabular-nums">{e.clock_out ? hoursLabel(workedHours(e)) : "—"}</td>
                  <td className="px-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger aria-label="Entry actions" className="flex size-9 items-center justify-center rounded-full hover:bg-secondary">
                        <DotsThreeVertical size={20} weight="bold" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 rounded-xl p-2">
                        <DropdownMenuItem className={menuItem} onSelect={() => setEditing(e)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className={cn(menuItem, "text-destructive focus:text-destructive")} onSelect={() => setRemove(e)}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
            {weekEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  No time recorded this week.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <EntryDialog value={editing} members={members} businessId={business?.id} onClose={() => setEditing(null)} onSaved={refresh} />
      <ConfirmDialog
        open={remove !== null}
        destructive
        busy={del.isPending}
        title="Delete entry"
        body="This time won't count towards pay runs."
        confirmLabel="Delete"
        onConfirm={() => remove && del.mutate(remove.id)}
        onClose={() => setRemove(null)}
      />
    </div>
  );
}

function EntryDialog({
  value,
  members,
  businessId,
  onClose,
  onSaved,
}: {
  value: Entry | { memberId: string } | null;
  members: { id: string; first_name: string; last_name: string | null }[];
  businessId: string | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(value && "id" in value);
  const [form, setForm] = useState({ memberId: "", start: "", end: "", breakMin: "0", notes: "" });
  useEffect(() => {
    if (!value) return;
    if ("id" in value) {
      setForm({ memberId: value.team_member_id, start: toLocalInput(value.clock_in), end: value.clock_out ? toLocalInput(value.clock_out) : "", breakMin: String(value.break_minutes), notes: value.notes ?? "" });
    } else {
      const today = isoDay(new Date());
      setForm({ memberId: value.memberId, start: `${today}T09:00`, end: `${today}T17:00`, breakMin: "30", notes: "" });
    }
  }, [value]);
  const valid = form.memberId && form.start && (!form.end || form.end > form.start);
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        business_id: businessId!,
        team_member_id: form.memberId,
        clock_in: new Date(form.start).toISOString(),
        clock_out: form.end ? new Date(form.end).toISOString() : null,
        break_minutes: Number(form.breakMin || 0),
        notes: form.notes.trim() || null,
      };
      const { error } = isEdit
        ? await supabase.from("timesheets").update(payload).eq("id", (value as Entry).id)
        : await supabase.from("timesheets").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Timesheet saved");
      onSaved();
      onClose();
    },
    onError: (e: { message: string }) =>
      toast.error(/timesheets_length/.test(e.message) ? "An entry can't be longer than 24 hours" : /one_open/.test(e.message) ? "This person already has an open entry" : e.message),
  });
  return (
    <Dialog open={value !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[30rem] gap-0 rounded-2xl border-0 p-0 [&>button]:hidden">
        <div className="flex items-start justify-between gap-4 px-8 pt-6">
          <DialogTitle className="pt-3 text-title font-semibold">{isEdit ? "Edit entry" : "Add entry"}</DialogTitle>
          <button type="button" aria-label="Close" onClick={onClose} className="flex size-12 items-center justify-center rounded-full hover:bg-secondary">
            <X size={20} />
          </button>
        </div>
        <DialogDescription className="sr-only">Timesheet entry</DialogDescription>
        <div className="space-y-4 px-8 pt-4">
          <label className="block text-body font-semibold">
            Team member
            <select value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} className={field}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {memberName(m)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-body font-semibold">
              Clock in
              <input type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={field} />
            </label>
            <label className="block text-body font-semibold">
              Clock out
              <input type="datetime-local" value={form.end} min={form.start} onChange={(e) => setForm({ ...form, end: e.target.value })} className={field} />
            </label>
          </div>
          <label className="block text-body font-semibold">
            Break (minutes)
            <input inputMode="numeric" value={form.breakMin} onChange={(e) => setForm({ ...form, breakMin: e.target.value.replace(/[^0-9]/g, "") })} className={field} />
          </label>
          <label className="block text-body font-semibold">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
            <input value={form.notes} maxLength={200} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={field} />
          </label>
        </div>
        <div className="flex justify-end gap-2 px-8 pb-8 pt-8">
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

// ─── Pay runs ───────────────────────────────────────────────────────────────

type MemberPay = { id: string; first_name: string; last_name: string | null; hourly_rate: number | null; service_commission_percent: number | null; product_commission_percent: number | null };
type Run = { id: string; period_start: string; period_end: string; status: string; paid_at: string | null; created_at: string; pay_run_lines: { total: number }[] };

export function PayRunsPage() {
  const { data: business } = useBusiness();
  const queryClient = useQueryClient();
  const money = useMoney();
  const [view, setView] = useState<"runs" | "settings">("runs");
  const [building, setBuilding] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const runs = useQuery({
    queryKey: ["pay-runs", business?.id],
    enabled: Boolean(business?.id),
    retry: false,
    queryFn: async (): Promise<Run[]> => {
      const { data, error } = await supabase.from("pay_runs").select("*, pay_run_lines(total)").eq("business_id", business!.id).order("period_end", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Run[];
    },
  });
  if (missing(runs.error)) return <p className="rounded-xl bg-[#fff7e6] px-5 py-4 text-body text-[#7a4b00]">{NOTICE}</p>;
  if (opened) return <PayRunDetail runId={opened} onBack={() => { setOpened(null); queryClient.invalidateQueries({ queryKey: ["pay-runs"] }); }} />;
  if (building) return <PayRunBuilder onDone={(id) => { setBuilding(false); queryClient.invalidateQueries({ queryKey: ["pay-runs"] }); if (id) setOpened(id); }} />;

  if (runs.data && runs.data.length === 0 && view === "runs") {
    return (
      <div className="space-y-6">
        <FeatureIntro
          title="Pay your team without the spreadsheets"
          body="Bookly adds up hours from timesheets, commission from what each person sold, and tips, so a pay run takes minutes."
          bullets={["Hourly wages from timesheets", "Commission on services and products", "Tips credited to the right person", "Adjustments for bonuses or deductions"]}
          cta="Create a pay run"
          onStart={() => setBuilding(true)}
        />
        <button type="button" onClick={() => setView("settings")} className="text-body font-medium text-primary hover:underline">
          Set hourly rates and commission first
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display font-semibold">Pay runs</h1>
          <p className="mt-1 text-body text-muted-foreground">Wages, commission and tips for each pay period.</p>
        </div>
        <button type="button" onClick={() => setBuilding(true)} className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}>
          New pay run
        </button>
      </div>
      <div className="flex gap-2">
        {(["runs", "settings"] as const).map((key) => (
          <button key={key} type="button" onClick={() => setView(key)} className={cn("h-9 rounded-full px-4 text-body font-medium", view === key ? "bg-ink text-ink-foreground" : "border border-input bg-card hover:bg-secondary")}>
            {key === "runs" ? "Pay runs" : "Pay settings"}
          </button>
        ))}
      </div>
      {view === "settings" ? (
        <PaySettings />
      ) : (
        <ul className="divide-y divide-border rounded-xl shadow-[inset_0_0_0_1px_var(--color-border)]">
          {(runs.data ?? []).map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setOpened(r.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-secondary/60">
                <Money size={24} className="text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold">
                    {fmtDate(`${r.period_start}T12:00:00`)} – {fmtDate(`${r.period_end}T12:00:00`)}
                  </span>
                  <span className="block text-caption text-muted-foreground">
                    {r.pay_run_lines.length} team member{r.pay_run_lines.length === 1 ? "" : "s"}
                    {r.paid_at ? ` · paid ${fmtDate(r.paid_at)}` : ""}
                  </span>
                </span>
                <span className="text-body font-semibold tabular-nums">{money(r.pay_run_lines.reduce((s, l) => s + Number(l.total), 0))}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-caption font-semibold", r.status === "paid" ? "bg-[#e6f6ea] text-[#1f8a3e]" : "bg-secondary text-muted-foreground")}>
                  {r.status === "paid" ? "Paid" : "Draft"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function usePayMembers() {
  const { data: business } = useBusiness();
  return useQuery({
    queryKey: ["pay-members", business?.id],
    enabled: Boolean(business?.id),
    queryFn: async (): Promise<MemberPay[]> => {
      const { data, error } = await supabase.from("team_members").select("*").eq("business_id", business!.id).eq("is_active", true).order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as MemberPay[];
    },
  });
}

function PaySettings() {
  const queryClient = useQueryClient();
  const members = usePayMembers();
  const [draft, setDraft] = useState<Record<string, { rate: string; service: string; product: string }>>({});
  useEffect(() => {
    if (members.data)
      setDraft(Object.fromEntries(members.data.map((m) => [m.id, { rate: m.hourly_rate?.toString() ?? "", service: m.service_commission_percent?.toString() ?? "", product: m.product_commission_percent?.toString() ?? "" }])));
  }, [members.data]);
  const save = useMutation({
    mutationFn: async () => {
      for (const m of members.data ?? []) {
        const d = draft[m.id];
        if (!d) continue;
        const num = (v: string) => (v.trim() === "" ? null : Number(v));
        const { error } = await supabase
          .from("team_members")
          .update({ hourly_rate: num(d.rate), service_commission_percent: num(d.service), product_commission_percent: num(d.product) })
          .eq("id", m.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pay-members"] });
      toast.success("Pay settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const LABEL = { rate: "hourly rate", service: "service commission", product: "product commission" } as const;
  const input = (id: string, key: "rate" | "service" | "product", suffix: string, who: string) => (
    <span className="flex items-center gap-1">
      <input
        aria-label={`${who} ${LABEL[key]}`}
        inputMode="decimal"
        value={draft[id]?.[key] ?? ""}
        onChange={(e) => setDraft({ ...draft, [id]: { ...draft[id]!, [key]: e.target.value.replace(/[^0-9.]/g, "") } })}
        className="h-10 w-24 rounded-[8px] border border-input px-3 text-right text-body tabular-nums"
      />
      <span className="text-caption text-muted-foreground">{suffix}</span>
    </span>
  );
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="data-table min-w-[640px]">
          <thead>
            <tr>
              <th className="px-4">Team member</th>
              <th className="px-4">Hourly rate</th>
              <th className="px-4">Service commission</th>
              <th className="px-4">Product commission</th>
            </tr>
          </thead>
          <tbody>
            {(members.data ?? []).map((m) => (
              <tr key={m.id}>
                <td className="px-4 font-semibold">{memberName(m)}</td>
                <td className="px-4">{input(m.id, "rate", "/hr", memberName(m))}</td>
                <td className="px-4">{input(m.id, "service", "%", memberName(m))}</td>
                <td className="px-4">{input(m.id, "product", "%", memberName(m))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-caption text-muted-foreground">Commission is worked out on what was charged, after discounts and without tax. Leave blank for none.</p>
      <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}>
        Save pay settings
      </button>
    </div>
  );
}

function PayRunBuilder({ onDone }: { onDone: (id?: string) => void }) {
  const { data: business } = useBusiness();
  const money = useMoney();
  const members = usePayMembers();
  const today = isoDay(new Date());
  const [period, setPeriod] = useState({ start: addDays(today, -13), end: today });
  const [adjust, setAdjust] = useState<Record<string, { amount: string; note: string }>>({});

  const data = useQuery({
    queryKey: ["pay-run-data", business?.id, period.start, period.end],
    enabled: Boolean(business?.id && period.start && period.end && period.end >= period.start),
    queryFn: async () => {
      const from = new Date(`${period.start}T00:00:00`).toISOString();
      const to = new Date(`${addDays(period.end, 1)}T00:00:00`).toISOString();
      const [sheets, sales] = await Promise.all([
        supabase.from("timesheets").select("team_member_id, clock_in, clock_out, break_minutes").eq("business_id", business!.id).gte("clock_in", from).lt("clock_in", to),
        supabase
          .from("sales")
          .select("*, sale_items(*)")
          .eq("business_id", business!.id)
          .eq("status", "completed")
          .gte("sale_date", from)
          .lt("sale_date", to),
      ]);
      if (sheets.error) throw sheets.error;
      if (sales.error) throw sales.error;
      return {
        sheets: sheets.data ?? [],
        sales: (sales.data ?? []).map((s) => {
          const row = s as unknown as { team_member_id: string | null; total: number; tip_amount: number | null; sale_items: { team_member_id?: string | null; service_id: string | null; product_id?: string | null; price: number; quantity: number; tax_amount?: number | null; discount_amount?: number | null }[] };
          return {
            team_member_id: row.team_member_id,
            total: Number(row.total),
            tip_amount: row.tip_amount,
            items: row.sale_items.map((i) => ({ team_member_id: i.team_member_id ?? null, service_id: i.service_id, product_id: i.product_id ?? null, price: Number(i.price), quantity: i.quantity, tax_amount: i.tax_amount ?? 0, discount_amount: i.discount_amount ?? null })),
          };
        }),
      };
    },
  });

  const lines: PayLine[] = useMemo(
    () =>
      data.data && members.data
        ? computePay(
            members.data.map((m) => ({ id: m.id, name: memberName(m), hourly_rate: m.hourly_rate, service_commission_percent: m.service_commission_percent, product_commission_percent: m.product_commission_percent })),
            data.data.sheets,
            data.data.sales,
          )
        : [],
    [data.data, members.data],
  );
  const totalFor = (l: PayLine) => Math.round((l.wages + l.commission + l.tips + Number(adjust[l.team_member_id]?.amount || 0)) * 100) / 100;

  const save = useMutation({
    mutationFn: async (paid: boolean) => {
      const { data: run, error } = await supabase
        .from("pay_runs")
        .insert({ business_id: business!.id, period_start: period.start, period_end: period.end })
        .select("id")
        .single();
      if (error) throw error;
      const { error: linesError } = await supabase.from("pay_run_lines").insert(
        lines.map((l) => ({
          business_id: business!.id,
          pay_run_id: run.id,
          team_member_id: l.team_member_id,
          member_name: l.member_name,
          hours: l.hours,
          wages: l.wages,
          commission: l.commission,
          tips: l.tips,
          adjustment: Number(adjust[l.team_member_id]?.amount || 0),
          adjustment_note: adjust[l.team_member_id]?.note.trim() || null,
          total: totalFor(l),
        })),
      );
      if (linesError) throw linesError;
      if (paid) {
        const { error: paidError } = await supabase.from("pay_runs").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", run.id);
        if (paidError) throw paidError;
      }
      return run.id;
    },
    onSuccess: (id, paid) => {
      toast.success(paid ? "Pay run marked as paid" : "Pay run saved as draft");
      onDone(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display font-semibold">New pay run</h1>
          <p className="mt-1 text-body text-muted-foreground">Check the figures, add any adjustments, then save.</p>
        </div>
        <button type="button" onClick={() => onDone()} className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}>
          Cancel
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-toolbar p-4">
        <label className="block text-body font-semibold">
          From
          <input type="date" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} className={cn(field, "w-44")} />
        </label>
        <label className="block text-body font-semibold">
          To
          <input type="date" value={period.end} min={period.start} onChange={(e) => setPeriod({ ...period, end: e.target.value })} className={cn(field, "w-44")} />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-[860px]">
          <thead>
            <tr>
              <th className="px-4">Team member</th>
              <th className="px-4 text-right">Hours</th>
              <th className="px-4 text-right">Wages</th>
              <th className="px-4 text-right">Commission</th>
              <th className="px-4 text-right">Tips</th>
              <th className="px-4">Adjustment</th>
              <th className="px-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.isLoading ? (
              <SkeletonRows cols={7} rows={4} avatar label="Adding up pay" />
            ) : (
              lines.map((l) => (
                <tr key={l.team_member_id}>
                  <td className="px-4 font-semibold">{l.member_name}</td>
                  <td className="px-4 text-right tabular-nums">{hoursLabel(l.hours)}</td>
                  <td className="px-4 text-right tabular-nums">{money(l.wages)}</td>
                  <td className="px-4 text-right tabular-nums">{money(l.commission)}</td>
                  <td className="px-4 text-right tabular-nums">{money(l.tips)}</td>
                  <td className="px-4">
                    <span className="flex gap-2">
                      <input
                        inputMode="decimal"
                        placeholder="0"
                        aria-label={`Adjustment for ${l.member_name}`}
                        value={adjust[l.team_member_id]?.amount ?? ""}
                        onChange={(e) => setAdjust({ ...adjust, [l.team_member_id]: { note: adjust[l.team_member_id]?.note ?? "", amount: e.target.value.replace(/[^0-9.-]/g, "") } })}
                        className="h-10 w-24 rounded-[8px] border border-input px-3 text-right text-body tabular-nums"
                      />
                      <input
                        placeholder="Reason"
                        aria-label={`Adjustment reason for ${l.member_name}`}
                        value={adjust[l.team_member_id]?.note ?? ""}
                        maxLength={100}
                        onChange={(e) => setAdjust({ ...adjust, [l.team_member_id]: { amount: adjust[l.team_member_id]?.amount ?? "", note: e.target.value } })}
                        className="h-10 w-36 rounded-[8px] border border-input px-3 text-body"
                      />
                    </span>
                  </td>
                  <td className="px-4 text-right font-semibold tabular-nums">{money(totalFor(l))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-right text-heading font-semibold">Total {money(lines.reduce((s, l) => s + totalFor(l), 0))}</p>
      <div className="flex justify-end gap-2">
        <button type="button" disabled={!lines.length || save.isPending} onClick={() => save.mutate(false)} className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}>
          Save draft
        </button>
        <button type="button" disabled={!lines.length || save.isPending} onClick={() => save.mutate(true)} className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}>
          Mark as paid
        </button>
      </div>
    </div>
  );
}

function PayRunDetail({ runId, onBack }: { runId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const money = useMoney();
  const [confirm, setConfirm] = useState<"paid" | "delete" | null>(null);
  const run = useQuery({
    queryKey: ["pay-run", runId],
    queryFn: async () => {
      const { data, error } = await supabase.from("pay_runs").select("*, pay_run_lines(*)").eq("id", runId).single();
      if (error) throw error;
      return data as unknown as Omit<Run, "pay_run_lines"> & { pay_run_lines: Array<{ member_name: string; hours: number; wages: number; commission: number; tips: number; adjustment: number; adjustment_note: string | null; total: number }> };
    },
  });
  const act = useMutation({
    mutationFn: async () => {
      const { error } =
        confirm === "delete"
          ? await supabase.from("pay_runs").delete().eq("id", runId)
          : await supabase.from("pay_runs").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", runId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(confirm === "delete" ? "Draft deleted" : "Marked as paid");
      const deleted = confirm === "delete";
      setConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["pay-run", runId] });
      if (deleted) onBack();
    },
    onError: (e: Error) => toast.error(/pay_run_locked/.test(e.message) ? "Paid pay runs can't be changed" : e.message),
  });
  const exportCsv = () => {
    if (!run.data) return;
    const rows = [["Team member", "Hours", "Wages", "Commission", "Tips", "Adjustment", "Reason", "Total"], ...run.data.pay_run_lines.map((l) => [l.member_name, String(l.hours), String(l.wages), String(l.commission), String(l.tips), String(l.adjustment), l.adjustment_note ?? "", String(l.total)])];
    const csv = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `pay-run-${run.data.period_start}-to-${run.data.period_end}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  if (!run.data) return <SkeletonTable cols={6} rows={5} label="Loading pay run" />;
  const r = run.data;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button type="button" onClick={onBack} className="mb-3 inline-flex h-10 items-center gap-2 rounded-full border border-input px-4 text-body font-medium hover:bg-secondary">
            <CaretLeft size={16} /> Pay runs
          </button>
          <h1 className="text-display font-semibold">
            {fmtDate(`${r.period_start}T12:00:00`)} – {fmtDate(`${r.period_end}T12:00:00`)}
          </h1>
          <p className="mt-1 text-body text-muted-foreground">{r.status === "paid" ? `Paid ${r.paid_at ? fmtDate(r.paid_at) : ""}. Locked.` : "Draft"}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={exportCsv} className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}>
            Download CSV
          </button>
          {r.status !== "paid" ? (
            <>
              <button type="button" onClick={() => setConfirm("delete")} className={cn(pillButton, "border border-input bg-card text-destructive hover:bg-secondary")}>
                Delete
              </button>
              <button type="button" onClick={() => setConfirm("paid")} className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}>
                Mark as paid
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-[760px]">
          <thead>
            <tr>
              <th className="px-4">Team member</th>
              <th className="px-4 text-right">Hours</th>
              <th className="px-4 text-right">Wages</th>
              <th className="px-4 text-right">Commission</th>
              <th className="px-4 text-right">Tips</th>
              <th className="px-4 text-right">Adjustment</th>
              <th className="px-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {r.pay_run_lines.map((l, i) => (
              <tr key={i}>
                <td className="px-4 font-semibold">{l.member_name}</td>
                <td className="px-4 text-right tabular-nums">{hoursLabel(Number(l.hours))}</td>
                <td className="px-4 text-right tabular-nums">{money(Number(l.wages))}</td>
                <td className="px-4 text-right tabular-nums">{money(Number(l.commission))}</td>
                <td className="px-4 text-right tabular-nums">{money(Number(l.tips))}</td>
                <td className="px-4 text-right tabular-nums">
                  {Number(l.adjustment) ? money(Number(l.adjustment)) : "—"}
                  {l.adjustment_note ? <span className="block text-caption text-muted-foreground">{l.adjustment_note}</span> : null}
                </td>
                <td className="px-4 text-right font-semibold tabular-nums">{money(Number(l.total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-right text-heading font-semibold">Total {money(r.pay_run_lines.reduce((s, l) => s + Number(l.total), 0))}</p>
      <ConfirmDialog
        open={confirm !== null}
        destructive={confirm === "delete"}
        busy={act.isPending}
        title={confirm === "delete" ? "Delete draft pay run" : "Mark as paid"}
        body={confirm === "delete" ? "This draft will be removed." : "Once paid, this pay run is locked and can't be changed."}
        confirmLabel={confirm === "delete" ? "Delete" : "Mark as paid"}
        onConfirm={() => act.mutate()}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
