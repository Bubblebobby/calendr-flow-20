import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const SLOT_MINUTES = 15;
/** px per 15 minutes — 96px per hour, Fresha's default ("medium small") zoom. */
export const SLOT_HEIGHT = 24;
export const HOUR_HEIGHT = SLOT_HEIGHT * (60 / SLOT_MINUTES);

export type CalendarView = "day" | "3day" | "week" | "month";

export const VIEW_LABELS: Record<CalendarView, string> = {
  day: "Day",
  "3day": "3 day",
  week: "Week",
  month: "Month",
};

/** "scheduled" | "all" | "me" | a comma-separated list of team member ids. */
export type TeamSelection = string;

export type TeamMember = {
  id: string;
  first_name: string;
  last_name: string | null;
  avatar_color: string;
  avatar_url: string | null;
  calendar_color: string;
  initials: string | null;
  job_title: string | null;
  user_id: string | null;
};

export type CalendarEvent = {
  id: string;
  appointmentId: string;
  teamMemberId: string;
  start: Date;
  end: Date;
  title: string;
  email: string | null;
  serviceName: string;
  status: string;
  price: number | null;
};

export function memberName(member: Pick<TeamMember, "first_name" | "last_name">) {
  return [member.first_name, member.last_name].filter(Boolean).join(" ");
}

export function deriveInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Monday-first week, like Fresha's default "first day of the week". */
export function startOfWeek(date: Date) {
  const day = startOfDay(date);
  const offset = (day.getDay() + 6) % 7;
  return addDays(day, -offset);
}

export function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

/** The days a view shows, in order. Month returns the full Monday-first grid (5–6 weeks). */
export function viewDays(view: CalendarView, anchor: Date): Date[] {
  const day = startOfDay(anchor);
  if (view === "day") return [day];
  if (view === "3day") return [day, addDays(day, 1), addDays(day, 2)];
  if (view === "week") {
    const start = startOfWeek(day);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }
  const first = new Date(day.getFullYear(), day.getMonth(), 1);
  const last = new Date(day.getFullYear(), day.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(last), 7);
  const days: Date[] = [];
  for (let cursor = start; cursor < end; cursor = addDays(cursor, 1)) days.push(cursor);
  return days;
}

/** How far the ‹ › arrows move for each view. */
export function shiftAnchor(view: CalendarView, anchor: Date, direction: 1 | -1) {
  if (view === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
  const step = view === "day" ? 1 : view === "3day" ? 3 : 7;
  return addDays(anchor, step * direction);
}

export function toDateParam(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromDateParam(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return startOfDay(new Date());
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDateTime(date: Date) {
  return formatTime(minutesOfDay(date));
}

export function useTeamMembers(businessId: string | undefined) {
  return useQuery({
    queryKey: ["calendar-team-members", businessId],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, first_name, last_name, avatar_color, avatar_url, calendar_color, initials, job_title, user_id")
        .eq("business_id", businessId!)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
  });
}

export function useCurrentUserId() {
  return useQuery({
    queryKey: ["current-user-id"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.user.id ?? null;
    },
    staleTime: Infinity,
  });
}

/** Appointment items whose start falls in [from, to). Cancelled appointments are left out. */
export function useCalendarEvents(businessId: string | undefined, from: Date, to: Date) {
  return useQuery({
    queryKey: ["calendar-appointments", businessId, from.toISOString(), to.toISOString()],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<CalendarEvent[]> => {
      const { data, error } = await supabase
        .from("appointment_items")
        .select(
          "id, appointment_id, team_member_id, start_time, end_time, price, services(name), appointments(status, is_walk_in, clients(first_name, last_name, email))",
        )
        .eq("business_id", businessId!)
        .gte("start_time", from.toISOString())
        .lt("start_time", to.toISOString())
        .order("start_time", { ascending: true });
      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).filter((row: any) => row.appointments?.status !== "cancelled").map((row: any) => {
        const client = row.appointments?.clients;
        return {
          id: row.id,
          appointmentId: row.appointment_id,
          teamMemberId: row.team_member_id,
          start: new Date(row.start_time),
          end: new Date(row.end_time),
          title: client ? [client.first_name, client.last_name].filter(Boolean).join(" ") : "Walk-in",
          email: client?.email ?? null,
          serviceName: row.services?.name ?? "Service",
          status: row.appointments?.status ?? "booked",
          price: row.price,
        } satisfies CalendarEvent;
      });
    },
  });
}

/** Resolves the team selector value to the members whose columns/rows are shown. */
export function selectMembers(
  members: TeamMember[],
  selection: TeamSelection,
  currentUserId: string | null | undefined,
): TeamMember[] {
  if (selection === "all" || selection === "scheduled") return members;
  if (selection === "me") {
    const mine = members.filter((member) => member.user_id && member.user_id === currentUserId);
    return mine.length ? mine : members.slice(0, 1);
  }
  const ids = new Set(selection.split(",").filter(Boolean));
  const picked = members.filter((member) => ids.has(member.id));
  return picked.length ? picked : members;
}

/** Label + dot colour for an appointment status. */
export function statusTone(status: string) {
  switch (status) {
    case "booked":
      return { label: "Booked", dot: "bg-primary/60" };
    case "confirmed":
      return { label: "Confirmed", dot: "bg-primary/60" };
    case "arrived":
      return { label: "Arrived", dot: "bg-accent" };
    case "started":
      return { label: "Started", dot: "bg-accent" };
    case "completed":
      return { label: "Completed", dot: "bg-primary" };
    case "no_show":
      return { label: "No-show", dot: "bg-muted-foreground" };
    default:
      return { label: "Cancelled", dot: "bg-destructive" };
  }
}
