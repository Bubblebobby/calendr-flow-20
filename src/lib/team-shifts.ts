import { useQuery } from "@tanstack/react-query";

import { isMissingTable } from "@/components/calendar/blocked-time";
import { supabase } from "@/integrations/supabase/client";

export type Shift = { start: string; end: string };
export type Schedule = {
  id: string;
  team_member_id: string;
  repeat_weeks: number;
  start_date: string;
  end_date: string | null;
  weeks: Shift[][][];
};
export type Override = { id: string; team_member_id: string; date: string; shifts: Shift[] };
export type TimeOff = { id: string; team_member_id: string; start_date: string; end_date: string; type: string; notes: string | null };
export type ClosedPeriod = { id: string; start_date: string; end_date: string; description: string | null };
export type Hours = { day_of_week: number; is_open: boolean; open_time: string | null; close_time: string | null };

export type ShiftData = {
  schedules: Schedule[];
  overrides: Override[];
  timeOff: TimeOff[];
  closed: ClosedPeriod[];
  hours: Hours[];
  /** False until the team shifts migration has been run; everything then falls back to opening hours. */
  available: boolean;
};

export type DayShifts =
  | { kind: "closed"; shifts: []; label: string }
  | { kind: "time_off"; shifts: []; label: string; timeOff: TimeOff }
  | { kind: "override" | "schedule" | "default"; shifts: Shift[] };

export const TIME_OFF_TYPES: Record<string, string> = {
  annual_leave: "Annual leave",
  sick: "Sick leave",
  personal: "Personal",
  training: "Training",
  other: "Other",
};

/** "YYYY-MM-DD" for a local Date. */
export function isoDay(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDay(day: string) {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function addDays(day: string, amount: number) {
  const date = parseDay(day);
  date.setDate(date.getDate() + amount);
  return isoDay(date);
}

/** Monday of the week containing `day`. */
export function weekStart(day: string) {
  const date = parseDay(day);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return isoDay(date);
}

function daysBetween(from: string, to: string) {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86400000);
}

export function toMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function shiftMinutes(shifts: Shift[]) {
  return shifts.reduce((sum, s) => sum + Math.max(0, toMinutes(s.end) - toMinutes(s.start)), 0);
}

export function formatHours(minutes: number) {
  if (minutes === 0) return "0 min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} hr` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

/** Opening hours as a shift list; Mon–Sat 09:00–18:00 until the owner saves their own. */
export function hoursShifts(hours: Hours[], dow: number): Shift[] {
  const row = hours.find((h) => h.day_of_week === dow);
  if (!row) return dow === 0 ? [] : [{ start: "09:00", end: "18:00" }];
  if (!row.is_open || !row.open_time || !row.close_time) return [];
  return [{ start: row.open_time.slice(0, 5), end: row.close_time.slice(0, 5) }];
}

export function scheduleFor(data: ShiftData, memberId: string, day: string) {
  return data.schedules
    .filter((s) => s.team_member_id === memberId && s.start_date <= day && (!s.end_date || s.end_date >= day))
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
}

export function resolveDay(data: ShiftData, memberId: string, day: string): DayShifts {
  const closed = data.closed.find((c) => c.start_date <= day && c.end_date >= day);
  if (closed) return { kind: "closed", shifts: [], label: closed.description || "Closed" };
  const off = data.timeOff.find((t) => t.team_member_id === memberId && t.start_date <= day && t.end_date >= day);
  if (off) return { kind: "time_off", shifts: [], label: TIME_OFF_TYPES[off.type] ?? "Time off", timeOff: off };
  const override = data.overrides.find((o) => o.team_member_id === memberId && o.date === day);
  if (override) return { kind: "override", shifts: override.shifts };
  const dow = parseDay(day).getDay();
  const schedule = scheduleFor(data, memberId, day);
  if (schedule) {
    const weekIndex = Math.floor(daysBetween(weekStart(schedule.start_date), day) / 7) % schedule.repeat_weeks;
    return { kind: "schedule", shifts: schedule.weeks[weekIndex]?.[dow] ?? [] };
  }
  return { kind: "default", shifts: hoursShifts(data.hours, dow) };
}

export function useShiftData(businessId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ["team-shifts", businessId, from, to],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<ShiftData> => {
      const id = businessId!;
      const [hours, schedules, overrides, timeOff, closed] = await Promise.all([
        supabase.from("business_hours").select("day_of_week, is_open, open_time, close_time").eq("business_id", id),
        supabase
          .from("team_schedules")
          .select("id, team_member_id, repeat_weeks, start_date, end_date, weeks")
          .eq("business_id", id)
          .lte("start_date", to)
          .or(`end_date.is.null,end_date.gte.${from}`),
        supabase
          .from("team_shift_overrides")
          .select("id, team_member_id, date, shifts")
          .eq("business_id", id)
          .gte("date", from)
          .lte("date", to),
        supabase
          .from("team_time_off")
          .select("id, team_member_id, start_date, end_date, type, notes")
          .eq("business_id", id)
          .lte("start_date", to)
          .gte("end_date", from),
        supabase
          .from("business_closed_periods")
          .select("id, start_date, end_date, description")
          .eq("business_id", id)
          .lte("start_date", to)
          .gte("end_date", from),
      ]);
      if (hours.error) throw hours.error;
      const missing = [schedules.error, overrides.error, timeOff.error, closed.error].some((e) => isMissingTable(e));
      if (!missing) {
        const error = schedules.error ?? overrides.error ?? timeOff.error ?? closed.error;
        if (error) throw error;
      }
      return {
        hours: hours.data ?? [],
        schedules: missing ? [] : ((schedules.data ?? []) as unknown as Schedule[]),
        overrides: missing ? [] : ((overrides.data ?? []) as unknown as Override[]),
        timeOff: missing ? [] : (timeOff.data ?? []),
        closed: missing ? [] : (closed.data ?? []),
        available: !missing,
      };
    },
  });
}

/** 00:00 … 24:00 in 15-minute steps, for shift pickers. */
export const TIME_OPTIONS = Array.from({ length: 97 }, (_, i) => {
  const minutes = i * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
