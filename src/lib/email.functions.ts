import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BusinessRow } from "@/lib/email-core.server";
import { formatMoney } from "@/lib/format";

/*
 * Booking and receipt emails through Brevo.
 * - sendBookingEmail: called by the public booking and manage pages with the booking's private
 *   manage token, right after a client books, cancels or reschedules online. The client's email
 *   follows the matching automation (New / Cancelled / Rescheduled appointment) and can be
 *   switched off in Marketing → Automations; the salon's alert always goes. The automations
 *   runner uses the same keys, so it never sends the same update a second time.
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

const AUTOMATION_FOR: Record<BookingEvent, string> = {
  confirmed: "appointment_new",
  cancelled: "appointment_cancelled",
  rescheduled: "appointment_rescheduled",
};

function fail(publicMessage: string, cause?: unknown): never {
  if (cause) console.error(`[email] ${publicMessage}`, cause);
  throw new Error(publicMessage);
}

export const sendBookingEmail = createServerFn({ method: "POST" })
  .inputValidator(bookingInput)
  .handler(async ({ data }) => {
    const { brevoConfigured, sendEmail } = await import("@/lib/brevo.server");
    if (!brevoConfigured()) return { sent: false as const, reason: "not_configured" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const templates = await import("@/lib/email-templates");
    const { automationByKey } = await import("@/lib/automations");
    const core = await import("@/lib/email-core.server");

    const { data: row, error } = await supabaseAdmin
      .from("appointments")
      .select(core.APPOINTMENT_SELECT)
      .eq("manage_token", data.token)
      .maybeSingle();
    if (error) fail("Could not load the booking.", error);
    if (!row) fail("Booking not found.");
    const appt = core.toLoaded(row as unknown as Record<string, unknown>);
    if (!appt) fail("This booking has no services.");

    const active = appt.status === "booked" || appt.status === "confirmed";
    // Each event only makes sense in the matching state, so a token can't be used to send
    // misleading emails.
    if (data.event === "cancelled" && appt.status !== "cancelled") fail("This booking isn't cancelled.");
    if (data.event !== "cancelled" && !active) fail("This booking can't be emailed.");
    if (data.event === "confirmed" && Date.now() - appt.createdAt.getTime() > CONFIRM_WINDOW_MS) {
      return { sent: false as const, reason: "too_late" as const };
    }

    const key = AUTOMATION_FOR[data.event];
    const logId = await core
      .claim({
        business_id: appt.business.id,
        appointment_id: appt.id,
        kind: key,
        dedupe_key: core.automationKey(key, appt.id, appt.start),
        notified_start: data.event === "cancelled" ? null : appt.start.toISOString(),
      })
      .catch((cause) => fail("Could not send the email.", cause));
    if (!logId) return { sent: false as const, reason: "already_sent" as const };

    const enabled = await core.automationsFor([appt.business.id]);
    const text = automationByKey(key)!;
    const client = appt.client;
    const sent: string[] = [];
    try {
      if (client?.email && enabled(appt.business.id, key)) {
        await sendEmail({
          to: { email: client.email, name: appt.details.clientName },
          fromName: appt.business.name,
          ...(appt.details.salon.email ? { replyTo: { email: appt.details.salon.email, name: appt.business.name } } : {}),
          ...templates.clientAutomation(key, text, appt.details, { reviewUrl: null }),
          tags: [key, "client"],
        });
        sent.push(client.email);
      }
      const inbox = await core.salonInbox(appt.business);
      if (inbox) {
        await sendEmail({
          to: { email: inbox, name: appt.business.name },
          fromName: "Bookly",
          ...(client?.email ? { replyTo: { email: client.email, name: appt.details.clientName } } : {}),
          ...templates.salonAlert(data.event, appt.details),
          tags: [key, "salon"],
        });
        sent.push(inbox);
      }
    } catch (cause) {
      // Nothing (or only part) went out: free the key so it can be tried again.
      if (!sent.length) await core.release(logId);
      fail("Could not send the email.", cause);
    }
    await core.recordRecipients(logId, sent);
    return { sent: true as const, clientEmailed: Boolean(client?.email && sent.includes(client.email)) };
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
    const { appUrl, claim, fullName, recordRecipients, release, salonOf } = await import("@/lib/email-core.server");

    const { data: sale, error } = await supabaseAdmin
      .from("sales")
      .select("*, clients(first_name, last_name, email), team_members(first_name, last_name), sale_items(*), businesses(*)")
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
    const { data: gifts } = await supabaseAdmin
      .from("gift_card_redemptions")
      .select("amount, gift_cards(code)")
      .eq("sale_id", sale.id);
    const giftPaid = (gifts ?? []).reduce((sum, g) => sum + Number(g.amount), 0);
    const items = [...(sale.sale_items as { description: string; price: number; quantity: number; sort_order: number }[])].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    const tip = Number(sale.tip_amount ?? 0);
    const total = Number(sale.total) + tip;
    const tz = business.timezone ?? "Africa/Lagos";
    const method = METHOD[sale.payment_method] ?? sale.payment_method;
    const payments = [
      ...(gifts ?? []).map((g) => ({
        label: `Gift card ${(g.gift_cards as unknown as { code: string } | null)?.code ?? ""}`.trim(),
        amount: Number(g.amount),
      })),
      ...(total - giftPaid > 0.004 ? [{ label: method[0]!.toUpperCase() + method.slice(1), amount: total - giftPaid }] : []),
    ];
    const date = new Date(sale.sale_date);
    const logoPath = business.logo_path;
    const app = appUrl();

    const logId = await claim({ business_id: business.id, sale_id: sale.id, kind: "receipt", dedupe_key: null }).catch((cause) =>
      fail("Could not send the email.", cause),
    );
    if (!logId) fail("Could not send the email.");
    try {
      await sendEmail({
        to: { email: client.email, name: fullName(client) },
        fromName: business.name,
        ...(business.contact_email ? { replyTo: { email: business.contact_email, name: business.name } } : {}),
        ...templates.receipt({
          salon: salonOf(business),
          logoUrl: logoPath && process.env["SUPABASE_URL"] ? `${process.env["SUPABASE_URL"]}/storage/v1/object/public/business-logos/${logoPath}` : null,
          bookUrl: business.booking_slug ? `${app}/book/${business.booking_slug}` : null,
          clientFirstName: client.first_name || "there",
          clientName: fullName(client),
          servedBy: fullName(sale.team_members as { first_name: string; last_name: string | null } | null) || null,
          number: sale.id.slice(0, 8).toUpperCase(),
          date: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: tz }).format(date),
          time: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(date),
          items: items.map((i) => ({ description: i.description, quantity: i.quantity, amount: Number(i.price) * i.quantity })),
          subtotal: items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0),
          discount: Number(sale.discount_amount ?? 0),
          tip,
          tax: Number(sale.tax_amount ?? 0),
          total,
          payments,
          refunded: sale.status === "refunded",
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
