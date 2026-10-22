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
  /** Public URL of the salon's logo, if it uploaded one. */
  logoUrl: string | null;
  bookUrl: string | null;
  clientFirstName: string;
  clientName: string;
  servedBy: string | null;
  number: string;
  date: string;
  time: string;
  items: { description: string; quantity: number; amount: number }[];
  subtotal: number;
  discount: number;
  tip: number;
  tax: number;
  total: number;
  payments: { label: string; amount: number }[];
  refunded: boolean;
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

/*
 * The receipt has its own layout: a grey header with the date and a large thank-you, a big total,
 * line items, payments, additional information, a "Need help?" panel and a dark footer. Plain
 * system fonts, with a dark-mode stylesheet for mail apps that support it.
 */
export function receipt(r: ReceiptDetails): Rendered {
  const GREY = "#e8e8e8";
  const RULE = "#f3f3f3";
  const SOFT = "#4b4b4b";
  const font = `font-family:${FONT}`;
  const divider = (top = 0, bottom = 0) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:${top}px 0 ${bottom}px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="rule" style="font-size:1px;line-height:1px;background-color:${RULE}">&nbsp;</td></tr></table></td></tr></table>`;
  const line = (label: string, value: string, opts: { muted?: boolean; green?: boolean } = {}) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td class="${opts.muted || opts.green ? "soft" : ""}" style="${font};font-weight:500;font-size:16px;line-height:20px;padding:15px 12px 15px 0;${opts.muted || opts.green ? `color:${SOFT};` : ""}">${label}</td>
<td align="right" class="${opts.green ? "" : opts.muted ? "soft" : ""}" style="${font};font-weight:500;font-size:16px;line-height:20px;padding:15px 0;text-align:right;white-space:nowrap;${opts.green ? "color:#18773a;" : opts.muted ? `color:${SOFT};` : ""}">${value}</td>
</tr></table>`;
  const info = (label: string, value: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="width:40%;${font};font-weight:500;font-size:16px;line-height:20px;padding-right:16px">${label}</td>
<td style="width:60%;${font};font-weight:500;font-size:16px;line-height:20px;text-align:right">${value}</td>
</tr></table>${divider(16, 16)}`;
  const panelTitle = (text: string, bottom: number) =>
    `<p style="margin:0;padding:16px 0 ${bottom}px;${font};font-weight:700;font-size:24px;line-height:32px">${text}</p>`;

  const items = r.items
    .map((i) => line(`${esc(i.description)}${i.quantity > 1 ? ` <span class="soft" style="color:${SOFT}">× ${i.quantity}</span>` : ""}`, esc(r.money(i.amount))))
    .join("");
  const adjustments = [
    r.discount || r.tip ? line("Subtotal", esc(r.money(r.subtotal)), { muted: true }) : "",
    r.discount ? line("Discount", `-${esc(r.money(r.discount))}`, { green: true }) : "",
    r.tip ? line("Tip", esc(r.money(r.tip)), { muted: true }) : "",
    r.tax ? line("Includes tax", esc(r.money(r.tax)), { muted: true }) : "",
  ].join("");
  const payments = r.payments
    .map(
      (p) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:12px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="text-align:left;${font};font-weight:500;font-size:16px;line-height:20px">${esc(p.label)}</td>
<td align="right" style="text-align:right;${font};font-weight:500;font-size:16px;line-height:20px;white-space:nowrap">${esc(r.money(p.amount))}</td>
</tr><tr>
<td class="soft" colspan="2" style="padding-top:2px;${font};font-size:14px;line-height:20px;color:${SOFT}">${esc(r.date)} ${esc(r.time)}</td>
</tr></table></td></tr></table>`,
    )
    .join("");
  const contactHref = r.salon.email ? `mailto:${r.salon.email}` : r.salon.phone ? `tel:${r.salon.phone.replace(/[^\d+]/g, "")}` : null;
  const help = contactHref
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="panel" style="margin-top:16px;border-collapse:separate;border:2px solid ${RULE};border-radius:16px"><tr><td style="padding:16px">
<p style="margin:0;padding-bottom:16px;${font};font-weight:700;font-size:20px;line-height:28px">Need help?</p>
<p style="margin:0;padding-bottom:24px;${font};font-size:14px;line-height:20px">Questions about this visit? ${esc(r.salon.name)} is happy to help.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="panel-button" align="center" style="background-color:${RULE};border-radius:8px"><a href="${esc(contactHref)}" style="display:block;padding:12px 16px;${font};font-weight:500;font-size:14px;line-height:16px;color:${INK};text-decoration:none">Contact ${esc(r.salon.name)}</a></td></tr></table>
</td></tr></table>`
    : "";
  const brand = r.logoUrl
    ? `<img src="${esc(r.logoUrl)}" alt="${esc(r.salon.name)}" height="44" style="display:block;height:44px;width:auto;max-width:180px;border:0;border-radius:8px">`
    : `<span style="${font};font-weight:700;font-size:24px;line-height:44px;letter-spacing:-0.02em">${esc(r.salon.name)}</span>`;
  const footerLinks = [
    r.bookUrl ? `<a href="${esc(r.bookUrl)}" style="color:#ffffff;text-decoration:underline">Book again</a>` : "",
    r.salon.website ? `<a href="${esc(r.salon.website)}" style="color:#ffffff;text-decoration:underline">Website</a>` : "",
  ]
    .filter(Boolean)
    .map((link, i) => `<p style="margin:${i ? 16 : 0}px 0 0;${font};font-weight:500;font-size:14px;line-height:20px">${link}</p>`)
    .join("");
  const headline = r.refunded ? `Your refund from ${r.salon.name}` : `Thanks for visiting, ${r.clientFirstName}`;
  const sub = r.refunded ? "Here are the details of your refund." : `Here's your receipt from ${r.salon.name}.`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${esc(headline)}</title>
<style>
body{margin:0;padding:0;-webkit-text-size-adjust:100%}
table,td{border-collapse:collapse}
@media (prefers-color-scheme:dark){
 .header{background-color:#292929!important;color:#ffffff!important}
 .header .soft{color:#dddddd!important}
 .body-root{background-color:#161616!important;color:#ffffff!important}
 .soft{color:#ababab!important}
 .rule{background-color:#292929!important}
 .panel{border-color:#292929!important}
 .panel-button{background-color:#383838!important}
 .panel-button a{color:#dedede!important}
}
@media only screen and (max-width:599px){
 .pad{padding-left:24px!important;padding-right:24px!important}
 .headline{font-size:32px!important;line-height:40px!important}
 .desktop{display:none!important}
}
</style></head>
<body style="margin:0;padding:0;background-color:#d6d6d5">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(`${r.money(r.total)} at ${r.salon.name}, ${r.date}`)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#d6d6d5"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px">
<tr><td class="header" style="background-color:${GREY};color:${INK}">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td class="pad" style="padding:32px 0 8px 48px;vertical-align:middle">${brand}</td>
  <td class="pad soft" align="right" style="padding:32px 48px 8px 0;vertical-align:top;${font};font-weight:500;font-size:12px;line-height:16px;color:${SOFT};white-space:nowrap">${esc(r.date)}<br>${esc(r.time)}</td>
 </tr></table>
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td class="pad" style="padding:24px 16px 32px 48px">
   <p class="headline" style="margin:0;${font};font-weight:700;font-size:40px;line-height:48px;letter-spacing:-0.02em">${esc(headline)}</p>
   <p style="margin:16px 0 0;${font};font-size:18px;line-height:28px">${esc(sub)}</p>
  </td>
  <td class="desktop" align="right" style="padding:0 48px 32px 0;font-size:96px;line-height:1;vertical-align:bottom">${r.refunded ? "" : "&#127881;"}</td>
 </tr></table>
</td></tr>
<tr><td class="body-root pad" style="background-color:#ffffff;color:${INK};padding:32px 48px">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td style="${font};font-weight:700;font-size:32px;line-height:40px">Total</td>
  <td align="right" style="${font};font-weight:700;font-size:32px;line-height:40px;white-space:nowrap">${esc(r.money(r.total))}</td>
 </tr></table>
 ${divider(24, 0)}
 ${items}
 ${adjustments ? divider(0, 0) + adjustments : ""}
 ${divider(0, 16)}
 ${panelTitle("Payments", 8)}
 ${payments}
 ${divider(0, 8)}
 ${panelTitle("Additional information", 24)}
 ${info("Receipt", `#${esc(r.number)}`)}
 ${info("Client", esc(r.clientName))}
 ${r.servedBy ? info("Served by", esc(r.servedBy)) : ""}
 ${r.footer ? `<p class="soft" style="margin:8px 0 0;${font};font-size:14px;line-height:20px;color:${SOFT};white-space:pre-line">${esc(r.footer)}</p>` : ""}
 ${help}
</td></tr>
<tr><td class="pad" style="background-color:#000000;padding:32px 48px">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td valign="top" style="${font};font-size:14px;line-height:20px;color:#a6a6a6">${esc(r.salon.name)}${r.salon.address ? `<br>${esc(r.salon.address)}` : ""}${r.salon.phone ? `<br>${esc(r.salon.phone)}` : ""}<br><br>Sent with Bookly</td>
  <td valign="top" align="right" style="text-align:right;white-space:nowrap">${footerLinks}</td>
 </tr></table>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  return {
    subject: r.refunded ? `Your refund from ${r.salon.name}` : `Your receipt from ${r.salon.name}`,
    html,
    text: [
      headline,
      `${r.date} ${r.time}`,
      "",
      `Total: ${r.money(r.total)}`,
      "",
      ...r.items.map((i) => `${i.description}${i.quantity > 1 ? ` x ${i.quantity}` : ""}: ${r.money(i.amount)}`),
      r.discount ? `Discount: -${r.money(r.discount)}` : "",
      r.tip ? `Tip: ${r.money(r.tip)}` : "",
      r.tax ? `Includes tax: ${r.money(r.tax)}` : "",
      "",
      "Payments",
      ...r.payments.map((p) => `${p.label}: ${r.money(p.amount)}`),
      "",
      `Receipt #${r.number}`,
      `Client: ${r.clientName}`,
      r.servedBy ? `Served by: ${r.servedBy}` : "",
      r.footer ? `\n${r.footer}` : "",
      "",
      [r.salon.name, r.salon.address, r.salon.phone, r.salon.email].filter(Boolean).join("\n"),
    ]
      .filter((l, i, all) => l !== "" || all[i - 1] !== "")
      .join("\n"),
  };
}
