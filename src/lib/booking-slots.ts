/** Time-slot maths for the public booking page. All "local" values are in the business's time zone. */

export type OpeningHours = { day: number; open: boolean; from: string | null; to: string | null };
export type Busy = { team_member_id: string; start_time: string; end_time: string };
/** Working shifts per team member for one day ("HH:MM" strings), from get_booking_availability. */
export type MemberShifts = Record<string, Array<{ start: string; end: string }>>;

const SLOT_STEP_MINUTES = 15;
const MIN_NOTICE_MINUTES = 15;

/** Offset (minutes east of UTC) of `tz` at the given instant. */
function tzOffsetMinutes(instant: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** "2026-10-19" + 600 minutes in `tz` -> the UTC instant. */
export function zonedToUtc(day: string, minutes: number, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const guess = new Date(Date.UTC(y, m - 1, d, 0, minutes));
  const offset = tzOffsetMinutes(guess, tz);
  const result = new Date(guess.getTime() - offset * 60000);
  // Re-check once in case the guess crossed a DST change.
  const offset2 = tzOffsetMinutes(result, tz);
  return offset2 === offset ? result : new Date(guess.getTime() - offset2 * 60000);
}

/** Today's date ("YYYY-MM-DD") in `tz`, plus `addDays`. */
export function localDay(tz: string, addDays = 0, from = new Date()): string {
  const shifted = new Date(from.getTime() + addDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

export function weekday(day: string) {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function toMinutes(value: string | null) {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Opening window for a day; falls back to Mon–Sat 09:00–18:00 like the rest of Bookly. */
export function openWindow(
  hours: OpeningHours[],
  day: string,
): { from: number; to: number } | null {
  return openWindowForWeekday(hours, weekday(day));
}

/** Same as openWindow, for a weekday number (0 = Sunday). */
export function openWindowForWeekday(
  hours: OpeningHours[],
  dow: number,
): { from: number; to: number } | null {
  const row = hours.find((h) => h.day === dow);
  if (!row) return dow === 0 ? null : { from: 9 * 60, to: 18 * 60 };
  if (!row.open) return null;
  const from = toMinutes(row.from) ?? 9 * 60;
  const to = toMinutes(row.to) ?? 18 * 60;
  return to > from ? { from, to } : null;
}

/**
 * Start times (minutes after local midnight) when `duration` minutes fit inside opening hours and
 * at least one of `memberIds` is free for the whole span.
 */
export function freeSlots({
  day,
  tz,
  hours,
  busy,
  memberIds,
  duration,
  shifts,
  now = new Date(),
}: {
  day: string;
  tz: string;
  hours: OpeningHours[];
  busy: Busy[];
  memberIds: string[];
  duration: number;
  /** When given, each member is only bookable inside their own shifts (otherwise opening hours). */
  shifts?: MemberShifts;
  now?: Date;
}): Array<{ minutes: number; memberIds: string[] }> {
  if (duration <= 0 || memberIds.length === 0) return [];
  const opening = openWindow(hours, day);
  const windowsFor = (id: string): Array<{ from: number; to: number }> =>
    shifts
      ? (shifts[id] ?? []).map((s) => ({
          from: toMinutes(s.start) ?? 0,
          to: s.end === "24:00" ? 1440 : (toMinutes(s.end) ?? 0),
        }))
      : opening
        ? [opening]
        : [];
  const memberWindows = new Map(memberIds.map((id) => [id, windowsFor(id)]));
  const all = [...memberWindows.values()].flat();
  if (all.length === 0) return [];
  const window = {
    from: Math.min(...all.map((w) => w.from)),
    to: Math.max(...all.map((w) => w.to)),
  };
  const earliest = now.getTime() + MIN_NOTICE_MINUTES * 60000;
  const intervals = busy.map((b) => ({
    member: b.team_member_id,
    start: new Date(b.start_time).getTime(),
    end: new Date(b.end_time).getTime(),
  }));
  const slots: Array<{ minutes: number; memberIds: string[] }> = [];
  for (let minutes = window.from; minutes + duration <= window.to; minutes += SLOT_STEP_MINUTES) {
    const start = zonedToUtc(day, minutes, tz).getTime();
    if (start < earliest) continue;
    const end = start + duration * 60000;
    const free = memberIds.filter(
      (id) =>
        (memberWindows.get(id) ?? []).some(
          (w) => minutes >= w.from && minutes + duration <= w.to,
        ) && !intervals.some((i) => i.member === id && i.start < end && i.end > start),
    );
    if (free.length) slots.push({ minutes, memberIds: free });
  }
  return slots;
}

export function formatClock(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
