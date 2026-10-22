import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CaretDown, CaretLeft, CaretRight, Info, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/catalog/catalog-ui";
import { deriveInitials, memberName, useTeamMembers, type TeamMember } from "@/components/catalog/service-team-members";
import { isMissingTable } from "@/components/calendar/blocked-time";
import { pillButton } from "@/components/sales/list-ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import {
  TIME_OFF_TYPES,
  TIME_OPTIONS,
  addDays,
  formatHours,
  isoDay,
  parseDay,
  resolveDay,
  shiftMinutes,
  weekStart,
  type DayShifts,
  type Shift,
  useShiftData,
} from "@/lib/team-shifts";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";
import { SkeletonRows } from "@/components/ui/skeletons";

const NEEDS_DB = "Shifts need a database update first: run notes/supabase-update-2026-10-18.sql in Supabase";
const menuItem = "h-10 rounded-[8px] px-3 text-body font-medium";

const fmtDay = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", options).format(parseDay(day));

type CellTarget = { member: TeamMember; day: string; state: DayShifts };

export function ScheduledShifts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const businessId = business?.id;
  const [anchor, setAnchor] = useState(() => weekStart(isoDay(new Date())));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(anchor, i)), [anchor]);
  const team = useTeamMembers(businessId);
  const members = team.data ?? [];
  const shiftData = useShiftData(businessId, days[0]!, days[6]!);
  const data = shiftData.data;

  const [editDay, setEditDay] = useState<CellTarget | null>(null);
  const [timeOff, setTimeOff] = useState<{ memberId: string; day: string } | null>(null);
  const [closedOpen, setClosedOpen] = useState(false);
  const [confirm, setConfirm] = useState<
    | { kind: "delete-shift"; target: CellTarget }
    | { kind: "delete-all"; member: TeamMember }
    | { kind: "delete-time-off"; id: string }
    | { kind: "delete-closed"; id: string }
    | null
  >(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["team-shifts", businessId] });
  const fail = (error: { code?: string; message: string }) => toast.error(isMissingTable(error) ? NEEDS_DB : error.message);

  const saveOverride = useMutation({
    mutationFn: async ({ memberId, day, shifts }: { memberId: string; day: string; shifts: Shift[] }) => {
      const { error } = await supabase
        .from("team_shift_overrides")
        .upsert({ business_id: businessId!, team_member_id: memberId, date: day, shifts }, { onConflict: "team_member_id,date" });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      setEditDay(null);
      setConfirm(null);
      toast.success("Shifts updated");
    },
    onError: fail,
  });

  const runConfirm = useMutation({
    mutationFn: async () => {
      if (!confirm) return;
      if (confirm.kind === "delete-shift") {
        const { error } = await supabase.from("team_shift_overrides").upsert(
          { business_id: businessId!, team_member_id: confirm.target.member.id, date: confirm.target.day, shifts: [] },
          { onConflict: "team_member_id,date" },
        );
        if (error) throw error;
      } else if (confirm.kind === "delete-all") {
        // End any current schedule and start an empty one from this week: the member stops being scheduled.
        const start = weekStart(isoDay(new Date()));
        await supabase
          .from("team_schedules")
          .update({ end_date: addDays(start, -1) })
          .eq("team_member_id", confirm.member.id)
          .is("end_date", null)
          .lt("start_date", start);
        await supabase.from("team_schedules").delete().eq("team_member_id", confirm.member.id).gte("start_date", start);
        const { error } = await supabase.from("team_schedules").insert({
          business_id: businessId!,
          team_member_id: confirm.member.id,
          repeat_weeks: 1,
          start_date: start,
          weeks: [[[], [], [], [], [], [], []]],
        });
        if (error) throw error;
      } else if (confirm.kind === "delete-time-off") {
        const { error } = await supabase.from("team_time_off").delete().eq("id", confirm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("business_closed_periods").delete().eq("id", confirm.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refresh();
      setConfirm(null);
      toast.success("Schedule updated");
    },
    onError: fail,
  });

  const dayTotal = (day: string) =>
    data ? members.reduce((sum, m) => sum + shiftMinutes(resolveDay(data, m.id, day).shifts), 0) : 0;
  const memberTotal = (memberId: string) =>
    data ? days.reduce((sum, day) => sum + shiftMinutes(resolveDay(data, memberId, day).shifts), 0) : 0;

  const repeating = (memberId: string) =>
    navigate({ to: "/team/shifts/$memberId", params: { memberId }, search: { from: anchor } });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-display font-semibold">Scheduled shifts</h1>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}>
              Options <CaretDown size={16} weight="bold" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-xl p-2">
              <DropdownMenuItem className={menuItem} onSelect={() => navigate({ to: "/settings" })}>
                Opening hours
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}>
              Add <CaretDown size={16} weight="bold" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-xl p-2">
              <DropdownMenuItem
                className={menuItem}
                disabled={!members.length}
                onSelect={() => setTimeOff({ memberId: members[0]?.id ?? "", day: isoDay(new Date()) })}
              >
                Time off
              </DropdownMenuItem>
              <DropdownMenuItem className={menuItem} onSelect={() => navigate({ to: "/team/new" })}>
                New team member
              </DropdownMenuItem>
              <DropdownMenuItem className={menuItem} onSelect={() => setClosedOpen(true)}>
                Business closed period
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {data && !data.available ? (
        <p className="flex items-start gap-2 rounded-xl bg-[#fff7e6] px-5 py-4 text-body text-[#7a4b00]">
          <Info size={20} className="mt-0.5 shrink-0" />
          Showing opening hours for everyone. {NEEDS_DB}.
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 rounded-xl bg-toolbar p-4">
        <button
          type="button"
          onClick={() => setAnchor(weekStart(isoDay(new Date())))}
          className="h-9 rounded-full border border-input bg-card px-4 text-body font-medium hover:bg-secondary"
        >
          This week
        </button>
        <div className="flex h-9 items-center overflow-hidden rounded-full border border-input bg-card">
          <button type="button" aria-label="Previous week" onClick={() => setAnchor(addDays(anchor, -7))} className="flex h-full w-10 items-center justify-center hover:bg-secondary">
            <CaretLeft size={16} />
          </button>
          <span className="border-x border-input px-4 text-body font-medium">
            {fmtDay(days[0]!, { day: "numeric", month: "short" })} – {fmtDay(days[6]!, { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <button type="button" aria-label="Next week" onClick={() => setAnchor(addDays(anchor, 7))} className="flex h-full w-10 items-center justify-center hover:bg-secondary">
            <CaretRight size={16} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl shadow-[inset_0_0_0_1px_var(--color-border)]">
        <table className="w-full min-w-[1040px] border-collapse">
          <thead>
            <tr>
              <th className="w-60 border-b border-border px-4 py-3 text-left text-body font-semibold">Team member</th>
              {days.map((day) => (
                <th key={day} className="border-b border-l border-border px-2 py-3 text-center">
                  <span className="block text-body font-semibold">{fmtDay(day, { weekday: "short", day: "numeric", month: "short" })}</span>
                  <span className="block text-caption font-normal text-muted-foreground">{formatHours(dayTotal(day))}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {team.isLoading ? (
              <SkeletonRows cols={8} avatar rows={5} label="Loading shifts" />
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-body text-muted-foreground">
                  Add team members to schedule their shifts.
                </td>
              </tr>
            ) : null}
            {members.map((member) => (
              <tr key={member.id}>
                <td className="border-b border-border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full text-body font-semibold" style={{ backgroundColor: member.avatar_color }}>
                      {member.initials || deriveInitials(memberName(member))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-semibold">{memberName(member)}</span>
                      <span className="block text-caption text-muted-foreground">{formatHours(memberTotal(member.id))}</span>
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger aria-label={`Edit ${memberName(member)}'s schedule`} className="flex size-9 items-center justify-center rounded-full hover:bg-secondary data-[state=open]:bg-secondary">
                        <PencilSimple size={18} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-60 rounded-xl p-2">
                        <DropdownMenuLabel className="px-3 text-heading font-semibold">Schedule</DropdownMenuLabel>
                        <DropdownMenuItem className={menuItem} onSelect={() => repeating(member.id)}>
                          Set repeating shifts
                        </DropdownMenuItem>
                        <DropdownMenuItem className={cn(menuItem, "text-destructive focus:text-destructive")} onSelect={() => setConfirm({ kind: "delete-all", member })}>
                          Delete all shifts
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-2" />
                        <DropdownMenuLabel className="px-3 text-heading font-semibold">Team member</DropdownMenuLabel>
                        <DropdownMenuItem className={menuItem} onSelect={() => navigate({ to: "/team", search: { tab: "members" } })}>
                          View team member
                        </DropdownMenuItem>
                        <DropdownMenuItem className={menuItem} onSelect={() => setTimeOff({ memberId: member.id, day: isoDay(new Date()) })}>
                          Add time off
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
                {days.map((day) => {
                  const state = data ? resolveDay(data, member.id, day) : null;
                  return (
                    <td key={day} className="border-b border-l border-border p-1.5 align-top">
                      {state ? (
                        <ShiftCell
                          state={state}
                          onEditDay={() => setEditDay({ member, day, state })}
                          onRepeating={() => repeating(member.id)}
                          onTimeOff={() => setTimeOff({ memberId: member.id, day })}
                          onDeleteShift={() => setConfirm({ kind: "delete-shift", target: { member, day, state } })}
                          onDeleteTimeOff={(id) => setConfirm({ kind: "delete-time-off", id })}
                          onDeleteClosed={() => {
                            const period = data!.closed.find((c) => c.start_date <= day && c.end_date >= day);
                            if (period) setConfirm({ kind: "delete-closed", id: period.id });
                          }}
                        />
                      ) : (
                        <span className="block h-11 animate-pulse rounded-[8px] bg-secondary" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="flex items-start gap-2 rounded-xl px-4 py-3 text-body text-muted-foreground shadow-[inset_0_0_0_1px_var(--color-border)]">
        <Info size={20} className="mt-0.5 shrink-0" />
        <span>
          Shifts set when team members can be booked. Anyone without shifts follows your opening hours, which you can change in{" "}
          <button type="button" onClick={() => navigate({ to: "/settings" })} className="font-medium text-primary hover:underline">
            Settings
          </button>
          .
        </span>
      </p>

      <EditDayDialog
        target={editDay}
        saving={saveOverride.isPending}
        onSave={(shifts) => editDay && saveOverride.mutate({ memberId: editDay.member.id, day: editDay.day, shifts })}
        onClose={() => setEditDay(null)}
      />
      <TimeOffDialog
        initial={timeOff}
        members={members}
        businessId={businessId}
        onClose={() => setTimeOff(null)}
        onSaved={refresh}
      />
      <ClosedPeriodDialog open={closedOpen} businessId={businessId} onClose={() => setClosedOpen(false)} onSaved={refresh} />
      <ConfirmDialog
        open={confirm !== null}
        destructive
        busy={runConfirm.isPending}
        title={
          confirm?.kind === "delete-all"
            ? "Delete all shifts"
            : confirm?.kind === "delete-time-off"
              ? "Delete time off"
              : confirm?.kind === "delete-closed"
                ? "Delete closed period"
                : "Delete this shift"
        }
        body={
          confirm?.kind === "delete-all"
            ? `${memberName(confirm.member)} won't be scheduled from this week onwards. You can set new repeating shifts at any time.`
            : confirm?.kind === "delete-shift"
              ? `${memberName(confirm.target.member)} won't work on ${fmtDay(confirm.target.day, { weekday: "long", day: "numeric", month: "long" })}.`
              : "Are you sure? This can't be undone."
        }
        confirmLabel="Delete"
        onConfirm={() => runConfirm.mutate()}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function ShiftCell({
  state,
  onEditDay,
  onRepeating,
  onTimeOff,
  onDeleteShift,
  onDeleteTimeOff,
  onDeleteClosed,
}: {
  state: DayShifts;
  onEditDay: () => void;
  onRepeating: () => void;
  onTimeOff: () => void;
  onDeleteShift: () => void;
  onDeleteTimeOff: (id: string) => void;
  onDeleteClosed: () => void;
}) {
  const working = state.shifts.length > 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex min-h-11 w-full flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-[8px] px-1 py-2 text-[0.875rem] leading-5 transition-colors",
          state.kind === "closed"
            ? "bg-[repeating-linear-gradient(135deg,var(--color-secondary)_0_6px,transparent_6px_12px)] text-muted-foreground"
            : state.kind === "time_off"
              ? "bg-[#fff1e6] text-[#9a4b00] hover:bg-[#ffe6d1]"
              : working
                ? "bg-[#e9e6fe] font-medium text-foreground hover:bg-[#ddd8fd]"
                : "text-muted-foreground hover:bg-secondary",
        )}
      >
        {state.kind === "closed" || state.kind === "time_off"
          ? state.label
          : working
            ? state.shifts.map((s) => (
                <span key={`${s.start}-${s.end}`}>
                  {s.start} - {s.end}
                </span>
              ))
            : "Not working"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 rounded-xl p-2">
        {state.kind === "closed" ? (
          <DropdownMenuItem className={cn(menuItem, "text-destructive focus:text-destructive")} onSelect={onDeleteClosed}>
            Delete closed period
          </DropdownMenuItem>
        ) : state.kind === "time_off" ? (
          <DropdownMenuItem className={cn(menuItem, "text-destructive focus:text-destructive")} onSelect={() => onDeleteTimeOff(state.timeOff.id)}>
            Delete time off
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem className={menuItem} onSelect={onEditDay}>
              Edit this day
            </DropdownMenuItem>
            <DropdownMenuItem className={menuItem} onSelect={onRepeating}>
              Set repeating shifts
            </DropdownMenuItem>
            <DropdownMenuItem className={menuItem} onSelect={onTimeOff}>
              Add time off
            </DropdownMenuItem>
            {working ? (
              <DropdownMenuItem className={cn(menuItem, "text-destructive focus:text-destructive")} onSelect={onDeleteShift}>
                Delete this shift
              </DropdownMenuItem>
            ) : null}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ShiftRows({ shifts, onChange }: { shifts: Shift[]; onChange: (shifts: Shift[]) => void }) {
  const update = (index: number, patch: Partial<Shift>) =>
    onChange(shifts.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-2">
      {shifts.map((shift, index) => (
        <div key={index} className="flex items-center gap-2">
          <TimeSelect value={shift.start} onChange={(start) => update(index, { start })} label="Start" />
          <span className="text-muted-foreground">–</span>
          <TimeSelect value={shift.end} onChange={(end) => update(index, { end })} label="End" />
          <button
            type="button"
            aria-label="Remove shift"
            onClick={() => onChange(shifts.filter((_, i) => i !== index))}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
          >
            <Trash size={18} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          const last = shifts[shifts.length - 1];
          onChange([...shifts, last ? { start: last.end, end: TIME_OPTIONS[Math.min(TIME_OPTIONS.indexOf(last.end) + 8, 96)]! } : { start: "09:00", end: "18:00" }]);
        }}
        className="inline-flex items-center gap-1 text-body font-medium text-primary hover:underline"
      >
        <Plus size={16} weight="bold" /> {shifts.length ? "Add another shift" : "Add a shift"}
      </button>
    </div>
  );
}

function TimeSelect({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 flex-1 rounded-[8px] border border-input bg-card px-3 text-body"
    >
      {TIME_OPTIONS.map((time) => (
        <option key={time} value={time}>
          {time}
        </option>
      ))}
    </select>
  );
}

export function shiftsValid(shifts: Shift[]) {
  const sorted = [...shifts].sort((a, b) => a.start.localeCompare(b.start));
  return sorted.every((s, i) => s.end > s.start && (i === 0 || s.start >= sorted[i - 1]!.end));
}

function ModalShell({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[32rem] gap-0 overflow-y-auto rounded-2xl border-0 p-0 [&>button]:hidden">
        <div className="flex items-start justify-between gap-4 px-8 pt-6">
          <DialogTitle className="pt-3 text-title font-semibold">{title}</DialogTitle>
          <button type="button" aria-label="Close" onClick={onClose} className="flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-secondary">
            <X size={20} />
          </button>
        </div>
        <DialogDescription className={cn("px-8 text-body text-muted-foreground", !description && "sr-only")}>
          {description ?? title}
        </DialogDescription>
        <div className="px-8 pt-5">{children}</div>
        <div className="flex justify-end gap-2 px-8 pb-8 pt-8">{footer}</div>
      </DialogContent>
    </Dialog>
  );
}

function EditDayDialog({
  target,
  saving,
  onSave,
  onClose,
}: {
  target: CellTarget | null;
  saving: boolean;
  onSave: (shifts: Shift[]) => void;
  onClose: () => void;
}) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [key, setKey] = useState("");
  const currentKey = target ? `${target.member.id}-${target.day}` : "";
  if (currentKey !== key) {
    setKey(currentKey);
    setShifts(target ? target.state.shifts.map((s) => ({ ...s })) : []);
  }
  const valid = shiftsValid(shifts);
  return (
    <ModalShell
      open={target !== null}
      title={target ? `${target.member.first_name}'s shifts` : ""}
      description={target ? `${fmtDay(target.day, { weekday: "long", day: "numeric", month: "long" })}. Changes apply to this day only.` : ""}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}>
            Cancel
          </button>
          <button type="button" disabled={!valid || saving} onClick={() => onSave(shifts)} className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}>
            Save
          </button>
        </>
      }
    >
      {shifts.length === 0 ? <p className="mb-3 text-body text-muted-foreground">Not working this day.</p> : null}
      <ShiftRows shifts={shifts} onChange={setShifts} />
      <p className={cn("mt-3 text-caption", valid ? "text-muted-foreground" : "text-destructive")}>
        {valid ? `${formatHours(shiftMinutes(shifts))} total` : "Shifts must end after they start and can't overlap."}
      </p>
    </ModalShell>
  );
}

function TimeOffDialog({
  initial,
  members,
  businessId,
  onClose,
  onSaved,
}: {
  initial: { memberId: string; day: string } | null;
  members: TeamMember[];
  businessId: string | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ memberId: "", type: "annual_leave", start: "", end: "", notes: "" });
  const [key, setKey] = useState("");
  const currentKey = initial ? `${initial.memberId}-${initial.day}` : "";
  if (currentKey !== key) {
    setKey(currentKey);
    if (initial) setForm({ memberId: initial.memberId, type: "annual_leave", start: initial.day, end: initial.day, notes: "" });
  }
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_time_off").insert({
        business_id: businessId!,
        team_member_id: form.memberId,
        type: form.type,
        start_date: form.start,
        end_date: form.end,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      onSaved();
      onClose();
      toast.success("Time off added");
    },
    onError: (error: { code?: string; message: string }) => toast.error(isMissingTable(error) ? NEEDS_DB : error.message),
  });
  const valid = Boolean(form.memberId && form.start && form.end && form.end >= form.start);
  const field = "mt-2 h-12 w-full rounded-[8px] border border-input bg-card px-4 text-body font-normal";
  return (
    <ModalShell
      open={initial !== null}
      title="Add time off"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}>
            Cancel
          </button>
          <button type="button" disabled={!valid || save.isPending} onClick={() => save.mutate()} className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}>
            Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
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
        <label className="block text-body font-semibold">
          Type
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={field}>
            {Object.entries(TIME_OFF_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-body font-semibold">
            Start date
            <input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value, end: form.end < e.target.value ? e.target.value : form.end })} className={field} />
          </label>
          <label className="block text-body font-semibold">
            End date
            <input type="date" value={form.end} min={form.start} onChange={(e) => setForm({ ...form, end: e.target.value })} className={field} />
          </label>
        </div>
        <label className="block text-body font-semibold">
          Notes <span className="font-normal text-muted-foreground">(optional)</span>
          <textarea rows={2} maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-2 w-full resize-none rounded-[8px] border border-input p-4 text-body font-normal" />
        </label>
      </div>
    </ModalShell>
  );
}

function ClosedPeriodDialog({
  open,
  businessId,
  onClose,
  onSaved,
}: {
  open: boolean;
  businessId: string | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = isoDay(new Date());
  const [form, setForm] = useState({ start: today, end: today, description: "" });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("business_closed_periods").insert({
        business_id: businessId!,
        start_date: form.start,
        end_date: form.end,
        description: form.description.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      onSaved();
      onClose();
      setForm({ start: today, end: today, description: "" });
      toast.success("Closed period added");
    },
    onError: (error: { code?: string; message: string }) => toast.error(isMissingTable(error) ? NEEDS_DB : error.message),
  });
  const field = "mt-2 h-12 w-full rounded-[8px] border border-input bg-card px-4 text-body font-normal";
  return (
    <ModalShell
      open={open}
      title="Business closed period"
      description="No one is scheduled, and clients can't book online, while you're closed."
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!form.start || form.end < form.start || save.isPending}
            onClick={() => save.mutate()}
            className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-body font-semibold">
            Start date
            <input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value, end: form.end < e.target.value ? e.target.value : form.end })} className={field} />
          </label>
          <label className="block text-body font-semibold">
            End date
            <input type="date" value={form.end} min={form.start} onChange={(e) => setForm({ ...form, end: e.target.value })} className={field} />
          </label>
        </div>
        <label className="block text-body font-semibold">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
          <input value={form.description} maxLength={100} placeholder="e.g. Public holiday" onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
        </label>
      </div>
    </ModalShell>
  );
}
