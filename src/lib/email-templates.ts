/*
 * Transactional email content: booking confirmations, cancellations, reschedules, alerts to the
 * salon, and receipts. Each template returns a subject, an HTML body (inline styles and tables so
 * it renders in Gmail, Outlook and Apple Mail) and a plain-text body.
 * Everything that came from a person (names, notes, service names) is escaped.
 */

export type Salon = {
  name: string;
  address: string;
  phone: string | null;
  email: string | null;
  website: string | null;
};

export type BookingLine = { service: string; staff: string | null; price: number | null };

export type BookingDetails = {
  salon: Salon;
  clientFirstName: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  when: { date: string; time: string };
  lines: BookingLine[];
  total: number;
  money: (amount: number) => string;
  manageUrl: string;
  bookUrl: string | null;
  calendarUrl: string;
  notes: string | null;
};

export type ReceiptDetails = {
  salon: Salon;
  clientFirstName: string;
  number: string;
  date: string;
  items: { description: string; quantity: number; amount: number }[];
  subtotal: number;
  discount: number;
  tip: number;
  tax: number;
  total: number;
  paidBy: string;
  footer: string | null;
  money: (amount: number) => string;
};

type Rendered = { subject: string; html: string; text: string };

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const INK = "#101010";
const MUTED = "#666666";
const LINE = "#e5e5e5";

function layout({ preheader, heading, intro, body, salon }: { preheader: string; heading: string; intro: string; body: string; salon: Salon }) {
  // The salon's address and contact details sit in the body (salonBlock), not repeated here.
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:${FONT};color:${INK}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid ${LINE}">
<tr><td style="padding:32px 32px 8px">
<p style="margin:0 0 20px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED}">${esc(salon.name)}</p>
<h1 style="margin:0;font-size:26px;line-height:32px;font-weight:700;letter-spacing:-0.02em">${esc(heading)}</h1>
<p style="margin:10px 0 0;font-size:15px;line-height:22px;color:${MUTED}">${intro}</p>
</td></tr>
<tr><td style="padding:16px 32px 32px">${body}</td></tr>
</table>
<p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:18px;color:${MUTED};text-align:center">Sent with Bookly</p>
</td></tr></table>
</body></html>`;
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td style="border-radius:999px;background:${INK}"><a href="${esc(href)}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${esc(label)}</a></td></tr></table>`;
}

function row(label: string, value: string, strong = false) {
  const weight = strong ? "font-weight:700;font-size:16px" : "font-size:15px";
  return `<tr><td style="padding:6px 0;${weight}">${label}</td><td align="right" style="padding:6px 0;${weight};white-space:nowrap">${value}</td></tr>`;
}

function bookingCard(b: BookingDetails, struck = false) {
  const deco = struck ? "text-decoration:line-through;color:" + MUTED + ";" : "";
  const lines = b.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 0;font-size:15px;line-height:20px;${deco}">${esc(l.service)}${l.staff ? `<br><span style="font-size:13px;color:${MUTED}">with ${esc(l.staff)}</span>` : ""}</td><td align="right" valign="top" style="padding:8px 0;font-size:15px;white-space:nowrap;${deco}">${l.price ? esc(b.money(l.price)) : ""}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:12px">
<tr><td style="padding:18px 20px">
<p style="margin:0;font-size:17px;font-weight:700;${deco}">${esc(b.when.date)}</p>
<p style="margin:2px 0 0;font-size:15px;color:${MUTED};${deco}">${esc(b.when.time)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-top:1px solid ${LINE}">${lines}
${b.total > 0 ? `<tr><td style="padding:10px 0 0;border-top:1px solid ${LINE};font-size:15px;font-weight:700;${deco}">Total</td><td align="right" style="padding:10px 0 0;border-top:1px solid ${LINE};font-size:15px;font-weight:700;${deco}">${esc(b.money(b.total))}</td></tr>` : ""}
</table>
</td></tr></table>`;
}

function salonBlock(salon: Salon) {
  const parts = [
    salon.address ? `<p style="margin:0 0 4px">${esc(salon.address)}</p>` : "",
    salon.phone ? `<p style="margin:0 0 4px">${esc(salon.phone)}</p>` : "",
    salon.email ? `<p style="margin:0">${esc(salon.email)}</p>` : "",
  ].join("");
  return parts ? `<div style="margin-top:20px;font-size:14px;line-height:20px;color:${MUTED}"><p style="margin:0 0 6px;font-weight:600;color:${INK}">${esc(salon.name)}</p>${parts}</div>` : "";
}

function bookingText(b: BookingDetails) {
  const lines = b.lines.map((l) => `- ${l.service}${l.staff ? ` with ${l.staff}` : ""}${l.price ? `: ${b.money(l.price)}` : ""}`);
  return [
    `${b.when.date}, ${b.when.time}`,
    ...lines,
    b.total > 0 ? `Total: ${b.money(b.total)}` : "",
    "",
    b.salon.name,
    b.salon.address,
    b.salon.phone ?? "",
    b.salon.email ?? "",
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n");
}

export function clientConfirmed(b: BookingDetails): Rendered {
  const intro = `Thanks, ${esc(b.clientFirstName)}. Here are your booking details.`;
  return {
    subject: `Booking confirmed: ${b.when.date} at ${b.when.time.split(" ")[0]}, ${b.salon.name}`,
    html: layout({
      preheader: `${b.when.date}, ${b.when.time} at ${b.salon.name}`,
      heading: "Your booking is confirmed",
      intro,
      salon: b.salon,
      body: `${bookingCard(b)}<p style="margin:16px 0 0;font-size:14px;color:${MUTED}">Pay at the salon.</p>${button(b.manageUrl, "View or change booking")}${salonBlock(b.salon)}`,
    }),
    text: `Your booking at ${b.salon.name} is confirmed.\n\n${bookingText(b)}\n\nView or change your booking: ${b.manageUrl}`,
  };
}

export function clientCancelled(b: BookingDetails): Rendered {
  return {
    subject: `Booking cancelled: ${b.when.date}, ${b.salon.name}`,
    html: layout({
      preheader: `Your booking on ${b.when.date} has been cancelled`,
      heading: "Your booking is cancelled",
      intro: `Hi ${esc(b.clientFirstName)}, this booking has been cancelled. Nothing more to do.`,
      salon: b.salon,
      body: `${bookingCard(b, true)}${b.bookUrl ? button(b.bookUrl, "Book again") : ""}${salonBlock(b.salon)}`,
    }),
    text: `Your booking at ${b.salon.name} has been cancelled.\n\n${bookingText(b)}${b.bookUrl ? `\n\nBook again: ${b.bookUrl}` : ""}`,
  };
}

export function clientRescheduled(b: BookingDetails): Rendered {
  return {
    subject: `Booking moved: ${b.when.date} at ${b.when.time.split(" ")[0]}, ${b.salon.name}`,
    html: layout({
      preheader: `Your booking is now ${b.when.date}, ${b.when.time}`,
      heading: "Your booking has moved",
      intro: `Hi ${esc(b.clientFirstName)}, here's your new time.`,
      salon: b.salon,
      body: `${bookingCard(b)}${button(b.manageUrl, "View or change booking")}${salonBlock(b.salon)}`,
    }),
    text: `Your booking at ${b.salon.name} has moved.\n\n${bookingText(b)}\n\nView or change your booking: ${b.manageUrl}`,
  };
}

export function salonAlert(event: "confirmed" | "cancelled" | "rescheduled", b: BookingDetails): Rendered {
  const heading = { confirmed: "New online booking", cancelled: "Booking cancelled", rescheduled: "Booking rescheduled" }[event];
  const contact = [b.clientEmail, b.clientPhone].filter(Boolean).map((v) => esc(v!)).join(" · ");
  const notes = b.notes ? `<p style="margin:16px 0 0;font-size:14px;line-height:20px"><strong>Notes:</strong> ${esc(b.notes)}</p>` : "";
  return {
    subject: `${heading}: ${b.clientName}, ${b.when.date} at ${b.when.time.split(" ")[0]}`,
    html: layout({
      preheader: `${b.clientName}, ${b.when.date} ${b.when.time}`,
      heading,
      intro: `<strong style="color:${INK}">${esc(b.clientName)}</strong>${contact ? `<br>${contact}` : ""}`,
      salon: b.salon,
      body: `${bookingCard(b, event === "cancelled")}${notes}${button(b.calendarUrl, "Open in calendar")}`,
    }),
    text: `${heading}\n\n${b.clientName}${contact ? `\n${[b.clientEmail, b.clientPhone].filter(Boolean).join(" · ")}` : ""}\n\n${bookingText(b)}${b.notes ? `\n\nNotes: ${b.notes}` : ""}\n\nOpen in calendar: ${b.calendarUrl}`,
  };
}

export function receipt(r: ReceiptDetails): Rendered {
  const items = r.items
    .map((i) => row(`${esc(i.description)}${i.quantity > 1 ? ` <span style="color:${MUTED}">× ${i.quantity}</span>` : ""}`, esc(r.money(i.amount))))
    .join("");
  const totals = [
    r.discount || r.tip ? row(`<span style="color:${MUTED}">Subtotal</span>`, `<span style="color:${MUTED}">${esc(r.money(r.subtotal))}</span>`) : "",
    r.discount ? row(`<span style="color:${MUTED}">Discount</span>`, `<span style="color:${MUTED}">-${esc(r.money(r.discount))}</span>`) : "",
    r.tip ? row(`<span style="color:${MUTED}">Tip</span>`, `<span style="color:${MUTED}">${esc(r.money(r.tip))}</span>`) : "",
    row("Total", esc(r.money(r.total)), true),
    r.tax ? row(`<span style="color:${MUTED};font-size:13px">Includes tax</span>`, `<span style="color:${MUTED};font-size:13px">${esc(r.money(r.tax))}</span>`) : "",
  ].join("");
  const mono = "font-family:'SFMono-Regular',Menlo,Consolas,monospace";
  return {
    subject: `Your receipt from ${r.salon.name}`,
    html: layout({
      preheader: `${r.money(r.total)} paid at ${r.salon.name}`,
      heading: "Thank you!",
      intro: `Hi ${esc(r.clientFirstName)}, here's your receipt.`,
      salon: r.salon,
      body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:12px"><tr><td style="padding:18px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="${mono};font-size:12px;letter-spacing:0.06em;color:${MUTED}">RECEIPT ID<br><span style="font-size:15px;letter-spacing:0;color:${INK}">#${esc(r.number)}</span></td>
<td align="right" style="${mono};font-size:12px;letter-spacing:0.06em;color:${MUTED}">DATE<br><span style="font-size:15px;letter-spacing:0;color:${INK}">${esc(r.date)}</span></td>
</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-top:1px solid ${LINE}">${items}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-top:1px solid ${LINE}">${totals}</table>
<p style="margin:12px 0 0;font-size:14px;color:${MUTED}">Paid by ${esc(r.paidBy)}</p>
</td></tr></table>${r.footer ? `<p style="margin:20px 0 0;font-size:14px;line-height:20px;color:${MUTED};white-space:pre-line">${esc(r.footer)}</p>` : ""}${salonBlock(r.salon)}`,
    }),
    text: [
      `Receipt #${r.number} from ${r.salon.name}`,
      r.date,
      "",
      ...r.items.map((i) => `${i.description}${i.quantity > 1 ? ` x ${i.quantity}` : ""}: ${r.money(i.amount)}`),
      "",
      r.discount ? `Discount: -${r.money(r.discount)}` : "",
      r.tip ? `Tip: ${r.money(r.tip)}` : "",
      `Total: ${r.money(r.total)}`,
      r.tax ? `Includes tax: ${r.money(r.tax)}` : "",
      `Paid by ${r.paidBy}`,
      r.footer ? `\n${r.footer}` : "",
    ]
      .filter((l) => l !== "")
      .join("\n"),
  };
}
