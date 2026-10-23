/*
 * Which automated emails are due for an appointment at a given moment. Pure, so it can be tested
 * on its own; the automations runner (automations.server.ts) does the loading and sending.
 */

export type DueInput = { status: string; start: Date; createdAt: Date; updatedAt: Date };

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
/** How far back a change counts as "just happened" (comfortably more than the 10-minute schedule). */
const RECENT = 30 * MINUTE;

/** Lead time before the appointment, and how late in that window a reminder may still go. */
const REMINDERS: { key: string; lead: number; slack: number }[] = [
  { key: "reminder_3_days", lead: 72 * HOUR, slack: 60 * MINUTE },
  { key: "reminder_24_hours", lead: 24 * HOUR, slack: 60 * MINUTE },
  { key: "reminder_1_hour", lead: 1 * HOUR, slack: 25 * MINUTE },
];

const TOLD_ABOUT_TIME = ["appointment_new", "appointment_rescheduled", "booking_confirmed", "booking_rescheduled"];

export type LogRow = { appointment_id: string | null; kind: string; notified_start: string | null; created_at: string };

/** Which automation emails are due for one appointment right now. */
export function dueFor(appt: DueInput, logs: LogRow[], now: number): string[] {
  const startsIn = appt.start.getTime() - now;
  const recent = (date: Date) => now - date.getTime() <= RECENT;
  const active = appt.status === "booked" || appt.status === "confirmed";

  if (active && startsIn > 0) {
    const told = logs
      .filter((l) => TOLD_ABOUT_TIME.includes(l.kind) && l.notified_start)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!told) {
      if (recent(appt.createdAt)) return ["appointment_new"];
    } else if (new Date(told.notified_start!).getTime() !== appt.start.getTime()) {
      return ["appointment_rescheduled"];
    }
    if (recent(appt.createdAt)) return [];
    const reminder = REMINDERS.find((r) => startsIn <= r.lead && startsIn > r.lead - r.slack);
    return reminder ? [reminder.key] : [];
  }
  if (!recent(appt.updatedAt)) return [];
  if (appt.status === "cancelled" && startsIn > 0) return ["appointment_cancelled"];
  if (appt.status === "no_show" && startsIn > -24 * HOUR) return ["appointment_no_show"];
  if (appt.status === "completed" && startsIn > -24 * HOUR) return ["appointment_thank_you"];
  return [];
}

