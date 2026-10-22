import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { formatMoney } from "@/lib/format";
import type { BookingDetails, Salon } from "@/lib/email-templates";

/*
 * Booking and receipt emails through Brevo.
 * - sendBookingEmail: called by the public booking and manage pages with the booking's private
 *   manage token. Emails the client and the salon. Each event is logged with a unique key, so it
 *   can only ever be sent once.
 * - sendReceiptEmail: signed-in staff email a sale's receipt to its client (rate limited).
 * Without Brevo settings on the server, both return { sent: false, reason: "not_configured" }.
 */

type BookingEvent = "confirmed" | "cancelled" | "rescheduled";

const bookingInput = (input: unknown) =>
  z.object({ token: z.string().uuid(), event: z.enum(["confirmed", "cancelled", "rescheduled"]) }).parse(input);
const receiptInput = (input: unknown) => z.object({ sale_id: z.string().uuid() }).parse(input);

/** A booking confirmation can only be sent within this long of the booking being made. */
const CONFIRM_WINDOW_MS = 2 * 60 * 60 * 1000;
const RECEIPTS_PER_HOUR = 3;

function fail(publicMessage: string, cause?: unknown): never {
  if (cause) console.error(`[email] ${publicMessage}`, cause);
  throw new Error(publicMessage);
}

function appUrl() {
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

const fullName = (p: { first_name: string; last_name?: string | null } | null | undefined) =>
  p ? [p.first_name, p.last_name].filter(Boolean).join(" ") : "";

type BusinessRow = {
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
};

function salonOf(b: BusinessRow): Salon {
  return {
    name: b.name,
    address: addressOf(b.location as Location),
    phone: b.contact_phone ?? null,
    email: b.contact_email ?? null,
    website: b.website,
  };
}

/** Where alerts for the salon go: its contact email, or the owner's login email. */
async function salonInbox(b: BusinessRow): Promise<string | null> {
  if (b.contact_email) return b.contact_email;
  if (!b.owner_id) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.admin.getUserById(b.owner_id);
  return data.user?.email ?? null;
}

/** Claims an email event. Returns false if it was already sent (the key exists). */
async function claim(row: { business_id: string; appointment_id?: string; sale_id?: string; kind: string; dedupe_key: string | null }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("email_log").insert(row).select("id").maybeSingle();
  if (error) {
    if (error.code === "23505") return null;
    fail("Could not send the email.", error);
  }
  return data?.id ?? null;
}

async function release(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("email_log").delete().eq("id", id);
}

async function recordRecipients(id: string, recipients: string[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("email_log").update({ recipients }).eq("id", id);
}

export const sendBookingEmail = createServerFn({ method: "POST" })
  .inputValidator(bookingInput)
  .handler(async ({ data }) => {
    const { brevoConfigured, sendEmail } = await import("@/lib/brevo.server");
    if (!brevoConfigured()) return { sent: false as const, reason: "not_configured" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const templates = await import("@/lib/email-templates");

    const { data: appt, error } = await supabaseAdmin
      .from("appointments")
      .select(
        "id, status, notes, created_at, business_id, manage_token, clients(first_name, last_name, email, phone), appointment_items(start_time, end_time, price, sort_order, services(name), team_members(first_name, last_name)), businesses(*)",
      )
      .eq("manage_token", data.token)
      .maybeSingle();
    if (error) fail("Could not load the booking.", error);
    if (!appt) fail("Booking not found.");

    const status = appt.status as string;
    const active = status === "booked" || status === "confirmed";
    // Each event only makes sense in the matching state, so a token can't be used to send
    // misleading emails.
    if (data.event === "cancelled" && status !== "cancelled") fail("This booking isn't cancelled.");
    if (data.event !== "cancelled" && !active) fail("This booking can't be emailed.");
    if (data.event === "confirmed" && Date.now() - new Date(appt.created_at).getTime() > CONFIRM_WINDOW_MS) {
      return { sent: false as const, reason: "too_late" as const };
    }

    const business = appt.businesses as unknown as BusinessRow;
    const client = appt.clients as { first_name: string; last_name: string | null; email: string | null; phone: string | null } | null;
    const items = [...((appt.appointment_items ?? []) as unknown as {
      start_time: string;
      end_time: string;
      price: number | null;
      sort_order: number;
      services: { name: string } | null;
      team_members: { first_name: string; last_name: string | null } | null;
    }[])].sort((a, b) => a.sort_order - b.sort_order);
    if (!items.length) fail("This booking has no services.");

    const start = new Date(Math.min(...items.map((i) => new Date(i.start_time).getTime())));
    const end = new Date(Math.max(...items.map((i) => new Date(i.end_time).getTime())));
    const tz = business.timezone ?? "Africa/Lagos";
    const date = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(start);
    const clock = (d: Date) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(d);

    const kind = `booking_${data.event}`;
    const dedupe = data.event === "rescheduled" ? `${kind}:${appt.id}:${start.toISOString()}` : `${kind}:${appt.id}`;
    const logId = await claim({ business_id: business.id, appointment_id: appt.id, kind, dedupe_key: dedupe });
    if (!logId) return { sent: false as const, reason: "already_sent" as const };

    const app = appUrl();
    const details: BookingDetails = {
      salon: salonOf(business),
      clientFirstName: client?.first_name || "there",
      clientName: fullName(client) || "A client",
      clientEmail: client?.email ?? null,
      clientPhone: client?.phone ?? null,
      when: { date, time: `${clock(start)} – ${clock(end)}` },
      lines: items.map((i) => ({ service: i.services?.name ?? "Service", staff: fullName(i.team_members) || null, price: i.price === null ? null : Number(i.price) })),
      total: items.reduce((sum, i) => sum + Number(i.price ?? 0), 0),
      money: (n) => formatMoney(n, business.currency, business.country),
      manageUrl: `${app}/book/manage/${appt.manage_token}`,
      bookUrl: business.booking_slug ? `${app}/book/${business.booking_slug}` : null,
      calendarUrl: `${app}/calendar?appointment=${appt.id}`,
      notes: appt.notes,
    };

    const salonReply = details.salon.email ? { email: details.salon.email, name: business.name } : undefined;
    const sent: string[] = [];
    try {
      if (client?.email) {
        const content =
          data.event === "confirmed"
            ? templates.clientConfirmed(details)
            : data.event === "cancelled"
              ? templates.clientCancelled(details)
              : templates.clientRescheduled(details);
        await sendEmail({
          to: { email: client.email, name: details.clientName },
          fromName: business.name,
          ...(salonReply ? { replyTo: salonReply } : {}),
          ...content,
          tags: [kind, "client"],
        });
        sent.push(client.email);
      }
      const inbox = await salonInbox(business);
      if (inbox) {
        await sendEmail({
          to: { email: inbox, name: business.name },
          fromName: "Bookly",
          ...(client?.email ? { replyTo: { email: client.email, name: details.clientName } } : {}),
          ...templates.salonAlert(data.event as BookingEvent, details),
          tags: [kind, "salon"],
        });
        sent.push(inbox);
      }
    } catch (cause) {
      // Nothing (or only part) went out: free the key so it can be tried again.
      if (!sent.length) await release(logId);
      fail("Could not send the email.", cause);
    }
    await recordRecipients(logId, sent);
    return { sent: true as const, clientEmailed: Boolean(client?.email) };
  });

const METHOD: Record<string, string> = { cash: "cash", card: "card", other: "other" };

export const sendReceiptEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(receiptInput)
  .handler(async ({ data, context }) => {
    // Seeing the sale with the caller's own permissions proves they work at this business.
    const { data: visible, error: accessError } = await context.supabase
      .from("sales")
      .select("id")
      .eq("id", data.sale_id)
      .maybeSingle();
    if (accessError) fail("Could not load the sale.", accessError);
    if (!visible) fail("Sale not found.");

    const { brevoConfigured, sendEmail } = await import("@/lib/brevo.server");
    if (!brevoConfigured()) return { sent: false as const, reason: "not_configured" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const templates = await import("@/lib/email-templates");

    const { data: sale, error } = await supabaseAdmin
      .from("sales")
      .select("*, clients(first_name, last_name, email), sale_items(*), businesses(*)")
      .eq("id", data.sale_id)
      .single();
    if (error) fail("Could not load the sale.", error);
    if (sale.status === "draft") fail("Finish the sale before emailing a receipt.");
    const client = sale.clients as { first_name: string; last_name: string | null; email: string | null } | null;
    if (!client?.email) fail("This client has no email address. Add one to their profile first.");

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("email_log")
      .select("id", { count: "exact", head: true })
      .eq("sale_id", sale.id)
      .gte("created_at", since);
    if ((count ?? 0) >= RECEIPTS_PER_HOUR) fail("This receipt was emailed a few times already. Try again in an hour.");

    const business = sale.businesses as unknown as BusinessRow;
    const { data: gifts } = await supabaseAdmin.from("gift_card_redemptions").select("amount").eq("sale_id", sale.id);
    const giftPaid = (gifts ?? []).reduce((sum, g) => sum + Number(g.amount), 0);
    const items = [...(sale.sale_items as { description: string; price: number; quantity: number; sort_order: number }[])].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    const tip = Number(sale.tip_amount ?? 0);
    const total = Number(sale.total) + tip;
    const tz = business.timezone ?? "Africa/Lagos";
    const method = METHOD[sale.payment_method] ?? sale.payment_method;

    const logId = await claim({ business_id: business.id, sale_id: sale.id, kind: "receipt", dedupe_key: null });
    if (!logId) fail("Could not send the email.");
    try {
      await sendEmail({
        to: { email: client.email, name: fullName(client) },
        fromName: business.name,
        ...(business.contact_email ? { replyTo: { email: business.contact_email, name: business.name } } : {}),
        ...templates.receipt({
          salon: salonOf(business),
          clientFirstName: client.first_name || "there",
          number: sale.id.slice(0, 8).toUpperCase(),
          date: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(new Date(sale.sale_date)),
          items: items.map((i) => ({ description: i.description, quantity: i.quantity, amount: Number(i.price) * i.quantity })),
          subtotal: items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0),
          discount: Number(sale.discount_amount ?? 0),
          tip,
          tax: Number(sale.tax_amount ?? 0),
          total,
          paidBy: giftPaid > 0.004 ? (giftPaid >= total - 0.004 ? "gift card" : `gift card and ${method}`) : method,
          footer: business.receipt_footer ?? null,
          money: (n) => formatMoney(n, business.currency, business.country),
        }),
        tags: ["receipt"],
      });
    } catch (cause) {
      await release(logId);
      fail("Could not send the email.", cause);
    }
    await recordRecipients(logId, [client.email]);
    return { sent: true as const, to: client.email };
  });
