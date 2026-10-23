// Server only: the automations runner. The scheduler calls it every 10 minutes (POST
// /api/cron/automations). Each run looks at appointments that changed recently or start soon,
// works out which automated emails are due, and sends each one once through Brevo.
//
// What it sends (when the business has the automation on and the client has an email):
// - New appointment: booked in the last 30 minutes and not already confirmed by email.
// - Rescheduled appointment: an upcoming booking whose start differs from the time the client
//   was last told about.
// - Cancelled / Did not show up / Thank you for visiting: status changed in the last 30 minutes.
// - Reminders 3 days, 24 hours and 1 hour before: once each, within a short window before the
//   lead time. Skipped for bookings made in the last 30 minutes, and for clients whose Bookly
//   account has email reminders turned off.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { brevoConfigured, sendEmail } from "@/lib/brevo.server";
import { automationByKey } from "@/lib/automations";
import { clientAutomation } from "@/lib/email-templates";
import {
  APPOINTMENT_SELECT,
  appUrl,
  automationKey,
  automationsFor,
  claim,
  recordRecipients,
  release,
  remindersOff,
  toLoaded,
  type LoadedAppointment,
} from "@/lib/email-core.server";
import { dueFor, type LogRow } from "@/lib/automation-schedule";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
/** How far back a change counts as "just happened" (comfortably more than the 10-minute schedule). */
const RECENT = 30 * MINUTE;
/** Most emails one run sends, so a backlog can't run past the function's time limit. */
const MAX_SENDS = 150;

const chunk = <T,>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

export async function runAutomations(at = new Date()) {
  const now = at.getTime();
  if (!brevoConfigured()) {
    await supabaseAdmin.from("automation_runs").insert({ sent: 0, failed: 0 });
    return { sent: 0, failed: 0, skipped: "email_not_configured" as const };
  }
  const since = new Date(now - RECENT).toISOString();

  // Appointments that changed recently, had a service moved recently, or start within 3 days.
  const [changed, movedItems, soon] = await Promise.all([
    supabaseAdmin.from("appointments").select("id").gte("updated_at", since).limit(1000),
    supabaseAdmin.from("appointment_items").select("appointment_id").gte("updated_at", since).limit(1000),
    supabaseAdmin
      .from("appointment_items")
      .select("appointment_id")
      .gte("start_time", new Date(now).toISOString())
      .lte("start_time", new Date(now + 72 * HOUR + MINUTE).toISOString())
      .limit(2000),
  ]);
  const ids = [
    ...new Set([
      ...(changed.data ?? []).map((r) => r.id),
      ...(movedItems.data ?? []).map((r) => r.appointment_id),
      ...(soon.data ?? []).map((r) => r.appointment_id),
    ]),
  ];

  const appointments: LoadedAppointment[] = [];
  const logs = new Map<string, LogRow[]>();
  for (const part of chunk(ids, 100)) {
    const [rows, logRows] = await Promise.all([
      supabaseAdmin.from("appointments").select(APPOINTMENT_SELECT).in("id", part),
      supabaseAdmin
        .from("email_log")
        .select("appointment_id, kind, notified_start, created_at")
        .in("appointment_id", part),
    ]);
    for (const row of rows.data ?? []) {
      const loaded = toLoaded(row as unknown as Record<string, unknown>);
      if (loaded && !loaded.isWalkIn && loaded.client?.email) appointments.push(loaded);
    }
    for (const log of logRows.data ?? []) {
      const list = logs.get(log.appointment_id!) ?? [];
      list.push(log);
      logs.set(log.appointment_id!, list);
    }
  }

  const enabled = await automationsFor([...new Set(appointments.map((a) => a.business.id))]);
  const noReminders = await remindersOff(
    [...new Set(appointments.map((a) => a.client?.user_id).filter((id): id is string => Boolean(id)))],
  );

  let sent = 0;
  let failed = 0;
  for (const appt of appointments) {
    if (sent >= MAX_SENDS) break;
    for (const key of dueFor(appt, logs.get(appt.id) ?? [], now)) {
      if (!enabled(appt.business.id, key)) continue;
      if (key.startsWith("reminder_") && appt.client?.user_id && noReminders.has(appt.client.user_id)) continue;
      const text = automationByKey(key);
      if (!text) continue;

      const logId = await claim({
        business_id: appt.business.id,
        appointment_id: appt.id,
        kind: key,
        dedupe_key: automationKey(key, appt.id, appt.start),
        notified_start: key === "appointment_new" || key === "appointment_rescheduled" ? appt.start.toISOString() : null,
      }).catch((error) => {
        console.error("[automations] could not log", key, appt.id, error);
        return null;
      });
      if (!logId) continue;
      try {
        await sendEmail({
          to: { email: appt.client!.email!, name: appt.details.clientName },
          fromName: appt.business.name,
          ...(appt.details.salon.email ? { replyTo: { email: appt.details.salon.email, name: appt.business.name } } : {}),
          ...clientAutomation(key, text, appt.details, { reviewUrl: `${appUrl()}/account/appointments` }),
          tags: [key, "automation"],
        });
        await recordRecipients(logId, [appt.client!.email!]);
        sent += 1;
      } catch (error) {
        console.error("[automations] send failed", key, appt.id, error);
        await release(logId);
        failed += 1;
      }
    }
  }

  await supabaseAdmin.from("automation_runs").insert({ sent, failed });
  await supabaseAdmin.from("automation_runs").delete().lt("ran_at", new Date(now - 7 * 24 * HOUR).toISOString());
  return { sent, failed, checked: appointments.length };
}

/** When the scheduler last ran, for the Automations page. */
export async function lastAutomationRun() {
  const { data } = await supabaseAdmin
    .from("automation_runs")
    .select("ran_at")
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.ran_at ?? null;
}
