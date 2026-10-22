// Server only: sends transactional email through Brevo's API (https://developers.brevo.com).
// Needs BREVO_API_KEY and BREVO_SENDER_EMAIL (a sender verified in Brevo) in the server
// environment. Import this from inside server function handlers, never from browser code.

export type Recipient = { email: string; name?: string };

export type Email = {
  to: Recipient;
  /** Shown as the sender's name; the address is always BREVO_SENDER_EMAIL. */
  fromName: string;
  replyTo?: Recipient;
  subject: string;
  html: string;
  text: string;
  tags?: string[];
};

export function brevoConfigured() {
  return Boolean(process.env["BREVO_API_KEY"] && process.env["BREVO_SENDER_EMAIL"]);
}

export async function sendEmail(email: Email): Promise<void> {
  const apiKey = process.env["BREVO_API_KEY"];
  const sender = process.env["BREVO_SENDER_EMAIL"];
  if (!apiKey || !sender) throw new Error("Brevo is not configured");

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: sender, name: email.fromName.slice(0, 70) },
      to: [email.to.name ? { email: email.to.email, name: email.to.name } : { email: email.to.email }],
      ...(email.replyTo ? { replyTo: email.replyTo } : {}),
      subject: email.subject,
      htmlContent: email.html,
      textContent: email.text,
      ...(email.tags?.length ? { tags: email.tags } : {}),
    }),
  });
  if (!response.ok) {
    // The body can contain account details: log it here, never send it to the browser.
    console.error(`[brevo] send failed (${response.status})`, await response.text().catch(() => ""));
    throw new Error(`Brevo returned ${response.status}`);
  }
}
