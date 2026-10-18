import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, Storefront } from "@phosphor-icons/react";
import { toast } from "sonner";

import { isMissingTable } from "@/components/calendar/blocked-time";
import { memberName, useTeamMembers } from "@/components/catalog/service-team-members";
import { pillButton } from "@/components/sales/list-ui";
import { ShiftRows, shiftsValid } from "@/components/team/scheduled-shifts";
import { supabase } from "@/integrations/supabase/client";
import { requireOnboardedUser } from "@/lib/auth-guard";
import {
  addDays,
  formatHours,
  hoursShifts,
  isoDay,
  parseDay,
  scheduleFor,
  shiftMinutes,
  weekStart,
  type Shift,
  useShiftData,
} from "@/lib/team-shifts";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/team/shifts/$memberId")({
  ssr: false,
  beforeLoad: requireOnboardedUser,
  validateSearch: (search: Record<string, unknown>): { from?: string } =>
    typeof search["from"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search["from"]) ? { from: search["from"] } : {},
  head: () => ({ meta: [{ title: "Set repeating shifts — Bookly" }] }),
  component: RepeatingShiftsPage,
});

// Monday-first display order; values are Date#getDay() numbers.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function RepeatingShiftsPage() {
  const { memberId } = Route.useParams();
  const { from } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const businessId = business?.id;
  const member = (useTeamMembers(businessId).data ?? []).find((m) => m.id === memberId);
  const today = isoDay(new Date());
  const shiftData = useShiftData(businessId, today, today);

  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const [startDate, setStartDate] = useState(() => weekStart(from ?? today));
  const [ends, setEnds] = useState<"never" | "date">("never");
  const [endDate, setEndDate] = useState("");
  const [weeks, setWeeks] = useState<Shift[][][] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  // Start from the member's current schedule, or opening hours if they don't have one.
  useEffect(() => {
    if (weeks || !shiftData.data) return;
    const current = scheduleFor(shiftData.data, memberId, today);
    if (current) {
      setRepeatWeeks(current.repeat_weeks);
      setWeeks(current.weeks.map((week) => week.map((day) => day.map((s) => ({ ...s })))));
      if (current.end_date) {
        setEnds("date");
        setEndDate(current.end_date);
      }
    } else {
      setWeeks([Array.from({ length: 7 }, (_, dow) => hoursShifts(shiftData.data!.hours, dow))]);
    }
  }, [shiftData.data, memberId, today, weeks]);

  const changeRepeat = (value: number) => {
    setRepeatWeeks(value);
    setWeeks((current) => {
      const base = current ?? [[[], [], [], [], [], [], []]];
      return Array.from({ length: value }, (_, i) => base[i] ?? base[0]!.map((day) => day.map((s) => ({ ...s }))));
    });
  };

  const valid =
    weeks !== null &&
    weeks.every((week) => week.every(shiftsValid)) &&
    Boolean(startDate) &&
    (ends === "never" || (endDate && endDate >= startDate));

  const save = useMutation({
    mutationFn: async () => {
      const start = weekStart(startDate);
      // Close the schedule that's running now, drop any that start later, then add the new one.
      const close = await supabase
        .from("team_schedules")
        .update({ end_date: addDays(start, -1) })
        .eq("team_member_id", memberId)
        .lt("start_date", start)
        .or(`end_date.is.null,end_date.gte.${start}`);
      if (close.error) throw close.error;
      const drop = await supabase.from("team_schedules").delete().eq("team_member_id", memberId).gte("start_date", start);
      if (drop.error) throw drop.error;
      const { error } = await supabase.from("team_schedules").insert({
        business_id: businessId!,
        team_member_id: memberId,
        repeat_weeks: repeatWeeks,
        start_date: start,
        end_date: ends === "date" ? endDate : null,
        weeks: weeks!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-shifts", businessId] });
      toast.success("Repeating shifts saved");
      navigate({ to: "/team", search: { tab: "shifts" } });
    },
    onError: (error: { code?: string; message: string }) =>
      toast.error(
        isMissingTable(error)
          ? "Shifts need a database update first: run notes/supabase-update-2026-10-18.sql in Supabase"
          : error.message,
      ),
  });

  const total = (weeks ?? []).reduce((sum, week) => sum + week.reduce((s, day) => s + shiftMinutes(day), 0), 0);
  const field = "mt-2 h-12 w-full rounded-[8px] border border-input bg-card px-4 text-body font-normal";
  const location = business ? [business.name] : [];

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-end gap-2 bg-white/95 px-8 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate({ to: "/team", search: { tab: "shifts" } })}
          className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}
        >
          Close
        </button>
        <button type="button" disabled={!valid || save.isPending} onClick={() => save.mutate()} className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}>
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </header>

      <main className="mx-auto w-full max-w-[720px] px-6 pb-16 pt-4">
        <h1 className="text-[2.5rem] font-bold leading-[2.75rem]">
          Set {member ? `${member.first_name}'s` : ""} repeating shifts
        </h1>
        <p className="mt-3 text-body text-muted-foreground">
          Set weekly, every-other-week or custom shifts. Saved changes apply to all shifts from the start date.
        </p>

        <div className="mt-8 flex items-center gap-4 rounded-xl px-5 py-4 shadow-[inset_0_0_0_1px_var(--color-border)]">
          <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
            <Storefront size={22} />
          </span>
          <span className="text-body font-semibold">{location.join(", ")}</span>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block text-body font-semibold">
            Schedule type
            <select value={repeatWeeks} onChange={(e) => changeRepeat(Number(e.target.value))} className={field}>
              <option value={1}>Every week</option>
              <option value={2}>Every 2 weeks</option>
              <option value={3}>Every 3 weeks</option>
              <option value={4}>Every 4 weeks</option>
            </select>
          </label>
          <label className="block text-body font-semibold">
            Start date
            <input type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} className={field} />
            <span className="mt-1 block text-caption font-normal text-muted-foreground">
              Shifts start on the Monday of this week ({new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(parseDay(weekStart(startDate)))}).
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-body font-semibold">
              Ends
              <select value={ends} onChange={(e) => setEnds(e.target.value as "never" | "date")} className={field}>
                <option value="never">Never</option>
                <option value="date">Specific date</option>
              </select>
            </label>
            {ends === "date" ? (
              <label className="block text-body font-semibold">
                End date
                <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={field} />
              </label>
            ) : null}
          </div>
        </div>

        <p className="mt-6 flex items-start gap-2 rounded-xl bg-secondary px-4 py-3 text-body text-muted-foreground">
          <Info size={20} className="mt-0.5 shrink-0" />
          Team members aren&apos;t scheduled during business closed periods or their time off.
        </p>

        <p className="mt-8 text-body text-muted-foreground">{formatHours(total)} total{repeatWeeks > 1 ? ` over ${repeatWeeks} weeks` : " per week"}</p>
        {(weeks ?? []).map((week, weekIndex) => (
          <section key={weekIndex} className="mt-4">
            <h2 className="text-title font-semibold">{repeatWeeks > 1 ? `Week ${weekIndex + 1}` : "Weekly"}</h2>
            <p className="text-caption text-muted-foreground">{formatHours(week.reduce((s, day) => s + shiftMinutes(day), 0))} total</p>
            <ul className="mt-3 divide-y divide-border rounded-xl shadow-[inset_0_0_0_1px_var(--color-border)]">
              {DAY_ORDER.map((dow) => {
                const id = `${weekIndex}-${dow}`;
                const shifts = week[dow] ?? [];
                const open = editing === id;
                return (
                  <li key={dow} className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <span className="w-32 shrink-0">
                        <span className="block text-body font-semibold">{DAY_NAMES[dow]}</span>
                        <span className="block text-caption text-muted-foreground">{shifts.length ? formatHours(shiftMinutes(shifts)) : ""}</span>
                      </span>
                      <span className={cn("min-w-0 flex-1 text-body", !shifts.length && "text-muted-foreground")}>
                        {shifts.length ? shifts.map((s) => `${s.start} - ${s.end}`).join(", ") : "Not working"}
                      </span>
                      <button type="button" onClick={() => setEditing(open ? null : id)} className="text-body font-medium text-primary hover:underline">
                        {open ? "Done" : "Edit"}
                      </button>
                    </div>
                    {open && weeks ? (
                      <div className="mt-4">
                        <ShiftRows
                          shifts={shifts}
                          onChange={(next) =>
                            setWeeks(weeks.map((w, wi) => (wi === weekIndex ? w.map((d, di) => (di === dow ? next : d)) : w)))
                          }
                        />
                        {!shiftsValid(shifts) ? (
                          <p className="mt-2 text-caption text-destructive">Shifts must end after they start and can&apos;t overlap.</p>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {!weeks ? <p className="mt-6 text-body text-muted-foreground">Loading {member ? memberName(member) : ""}&apos;s schedule…</p> : null}
      </main>
    </div>
  );
}
