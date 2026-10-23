// Server only: shared pieces for Bookly's emails (booking emails, receipts, automations).
// Loads an appointment with everything an email needs, decides whether an automation is on,
// and claims each email in email_log so the same event can never be sent twice.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { automationByKey } from "@/lib/automations";
import type { BookingDetails, Salon } from "@/lib/email-templates";
import { formatMoney } from "@/lib/format";

export function appUrl() {
  return (process.env["APP_URL"] ?? "https://bookly-taupe.vercel.app").replace(/\/$/, "");
}

type Location = { address?: string; apt?: string; district?: string; city?: string; state?: string; postcode?: string } | null;

function addressOf(location: Location) {
  if (!location) return "";
  return [location.address, location.apt, location.district, location.city, location.state, location.postcode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

export const fullName = (p: { first_name: string; last_name?: string | null } | null | undefined) =>
  p ? [p.first_name, p.last_name].filter(Boolean).join(" ") : "";

export type BusinessRow = {
  id: string;
  name: string;
  owner_id: string | null;
  booking_slug: string | null;
  timezone: string | null;
  currency: string;
  country: string;
  location: unknown;
  website: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  receipt_footer?: string | null;
  logo_path?: string | null;
};

export function salonOf(b: BusinessRow): Salon {
  return {
    name: b.name,
    address: addressOf(b.location as Location),
    phone: b.contact_phone ?? null,
    email: b.contact_email ?? null,
    website: b.website,
  };
}

/** Where alerts for the salon go: its contact email, or the owner's login email. */
export async function salonInbox(b: BusinessRow): Promise<string | null> {
  if (b.contact_email) return b.contact_email;
  if (!b.owner_id) return null;
  const { data } = await supabaseAdmin.auth.admin.getUserById(b.owner_id);
  return data.user?.email ?? null;
}

export type ClaimRow = {
  business_id: string;
  appointment_id?: string;
  sale_id?: string;
  kind: string;
  dedupe_key: string | null;
  notified_start?: string | null;
};

/** Claims an email event. Returns null if it was already sent (its dedupe key exists). */
export async function claim(row: ClaimRow): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from("email_log").insert(row).select("id").maybeSingle();
  if (error) {
    if (error.code === "23505") return null;
    throw error;
  }
  return data?.id ?? null;
}

export async function release(id: string) {
  await supabaseAdmin.from("email_log").delete().eq("id", id);
}

export async function recordRecipients(id: string, recipients: string[]) {
  await supabaseAdmin.from("email_log").update({ recipients }).eq("id", id);
}

/** Whether a business has an automation switched on (its saved choice, or the default). */
export async function automationsFor(businessIds: string[]) {
  const { data } = businessIds.length
    ? await supabaseAdmin.from("message_automations").select("business_id, key, enabled").in("business_id", businessIds)
    : { data: [] };
  const saved = new Map((data ?? []).map((row) => [`${row.business_id}:${row.key}`, row.enabled]));
  return (businessId: string, key: string) =>
    saved.get(`${businessId}:${key}`) ?? automationByKey(key)?.defaultOn ?? false;
}

export const APPOINTMENT_SELECT =
  "id, status, notes, created_at, updated_at, created_by, is_walk_in, business_id, manage_token, clients(first_name, last_name, email, phone, user_id), appointment_items(start_time, end_time, price, sort_order, services(name), team_members(first_name, last_name)), businesses(*)";

type ItemRow = {
  start_time: string;
  end_time: string;
  price: number | null;
  sort_order: number;
  services: { name: string } | null;
  team_members: { first_name: string; last_name: string | null } | null;
};

export type ClientRow = {
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  user_id: string | null;
};

export type LoadedAppointment = {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  isWalkIn: boolean;
  business: BusinessRow;
  client: ClientRow | null;
  start: Date;
  end: Date;
  details: BookingDetails;
};

/** Shapes an appointment row (selected with APPOINTMENT_SELECT) for emails. Null if it has no services. */
export function toLoaded(row: Record<string, unknown>): LoadedAppointment | null {
  const business = row["businesses"] as BusinessRow;
  const client = (row["clients"] as ClientRow | null) ?? null;
  const items = [...((row["appointment_items"] ?? []) as ItemRow[])].sort((a, b) => a.sort_order - b.sort_order);
  if (!items.length || !business) return null;

  const start = new Date(Math.min(...items.map((i) => new Date(i.start_time).getTime())));
  const end = new Date(Math.max(...items.map((i) => new Date(i.end_time).getTime())));
  const tz = business.timezone ?? "Africa/Lagos";
  const date = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(start);
  const clock = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(d);
  const app = appUrl();

  return {
    id: row["id"] as string,
    status: row["status"] as string,
    createdAt: new Date(row["created_at"] as string),
    updatedAt: new Date(row["updated_at"] as string),
    createdBy: (row["created_by"] as string | null) ?? null,
    isWalkIn: Boolean(row["is_walk_in"]),
    business,
    client,
    start,
    end,
    details: {
      salon: salonOf(business),
      clientFirstName: client?.first_name || "there",
      clientName: fullName(client) || "A client",
      clientEmail: client?.email ?? null,
      clientPhone: client?.phone ?? null,
      when: { date, time: `${clock(start)} – ${clock(end)}` },
      lines: items.map((i) => ({
        service: i.services?.name ?? "Service",
        staff: fullName(i.team_members) || null,
        price: i.price === null ? null : Number(i.price),
      })),
      total: items.reduce((sum, i) => sum + Number(i.price ?? 0), 0),
      money: (n) => formatMoney(n, business.currency, business.country),
      manageUrl: `${app}/book/manage/${row["manage_token"] as string}`,
      bookUrl: business.booking_slug ? `${app}/book/${business.booking_slug}` : null,
      calendarUrl: `${app}/calendar?appointment=${row["id"] as string}`,
      notes: (row["notes"] as string | null) ?? null,
    },
  };
}

/** Clients with a Bookly account who turned off email reminders. */
export async function remindersOff(userIds: string[]) {
  if (!userIds.length) return new Set<string>();
  const { data } = await supabaseAdmin.from("profiles").select("id, email_reminders").in("id", userIds);
  return new Set((data ?? []).filter((p) => p.email_reminders === false).map((p) => p.id));
}

/** The dedupe key for an automation email about an appointment. */
export function automationKey(key: string, appointmentId: string, start: Date) {
  // Reschedules and reminders are tied to a start time, so a moved booking can be told again.
  const timed = key === "appointment_rescheduled" || key.startsWith("reminder_");
  return timed ? `${key}:${appointmentId}:${start.toISOString()}` : `${key}:${appointmentId}`;
}
