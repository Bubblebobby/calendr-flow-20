/** Repeating appointment rules: which dates a series falls on. */
export type RepeatRule = {
  unit: "day" | "week" | "month";
  every: number;
  /** Total number of appointments including the first (2–52). */
  count?: number;
  /** Last allowed date, "YYYY-MM-DD" (inclusive). */
  until?: string;
};

export const MAX_OCCURRENCES = 52;

function addUnits(date: Date, unit: RepeatRule["unit"], amount: number) {
  const next = new Date(date);
  if (unit === "day") next.setDate(next.getDate() + amount);
  else if (unit === "week") next.setDate(next.getDate() + amount * 7);
  else {
    // Keep the day of month; clamp to the month's last day (31 Jan → 28/29 Feb).
    const day = date.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + amount);
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, last));
  }
  return next;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Dates of the repeats after the first appointment (local dates, first excluded). */
export function repeatDates(first: Date, rule: RepeatRule): Date[] {
  const every = Math.max(1, Math.floor(rule.every));
  const limit = Math.min(MAX_OCCURRENCES, rule.count ?? MAX_OCCURRENCES);
  const dates: Date[] = [];
  for (let n = 1; dates.length + 1 < limit; n++) {
    const next = addUnits(first, rule.unit, every * n);
    if (rule.until && iso(next) > rule.until) break;
    if (!rule.count && !rule.until) break;
    dates.push(next);
  }
  return dates;
}

export function describeRule(rule: RepeatRule | null | undefined) {
  if (!rule) return "Doesn't repeat";
  const unit = rule.every === 1 ? rule.unit : `${rule.every} ${rule.unit}s`;
  const base = `Every ${unit}`;
  if (rule.count) return `${base}, ${rule.count} times`;
  if (rule.until) return `${base} until ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${rule.until}T12:00:00`))}`;
  return base;
}
