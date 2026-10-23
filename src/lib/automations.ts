/*
 * Automated client messages (Marketing → Automations). Each business turns them on or off; the
 * choice is saved in message_automations, and defaultOn applies until it's changed. The ones marked
 * live are sent by the automations runner (src/lib/automations.server.ts) by email through Brevo.
 * Placeholders: {client}, {business}, {date}, {time}.
 */

export type Automation = {
  key: string;
  group: string;
  title: string;
  description: string;
  defaultOn: boolean;
  trigger: string;
  subject: string;
  body: string;
  /** Sends today (once email is connected). The rest are saved choices, shown as coming soon. */
  live?: boolean;
};

export const AUTOMATION_GROUPS = [
  "Reminders",
  "Appointment updates",
  "Waitlist updates",
  "Increase bookings",
  "Celebrate milestones",
  "Client loyalty",
] as const;

export const AUTOMATIONS: Automation[] = [
  { key: "reminder_3_days", live: true, group: "Reminders", title: "3 days upcoming appointment reminder", description: "Reminds clients of their appointment three days before.", defaultOn: true, trigger: "3 days before an upcoming appointment", subject: "See you on {date}", body: "Hi {client}, just a reminder about your appointment at {business} on {date} at {time}." },
  { key: "reminder_24_hours", live: true, group: "Reminders", title: "24 hours upcoming appointment reminder", description: "Reminds clients of their appointment the day before.", defaultOn: true, trigger: "24 hours before an upcoming appointment", subject: "Reminder about your appointment on {date} at {time}", body: "Hi {client}, just a reminder about your appointment at {business} tomorrow at {time}." },
  { key: "reminder_1_hour", live: true, group: "Reminders", title: "1 hour upcoming appointment reminder", description: "Reminds clients an hour before their appointment.", defaultOn: true, trigger: "1 hour before an upcoming appointment", subject: "See you soon", body: "Hi {client}, your appointment at {business} starts at {time}." },
  { key: "appointment_new", live: true, group: "Appointment updates", title: "New appointment", description: "Lets clients know when an appointment is booked for them.", defaultOn: true, trigger: "When an appointment is booked", subject: "Your appointment is booked", body: "Hi {client}, you're booked in at {business} on {date} at {time}." },
  { key: "appointment_rescheduled", live: true, group: "Appointment updates", title: "Rescheduled appointment", description: "Sent when an appointment's start time changes.", defaultOn: true, trigger: "When an appointment's start time changes", subject: "Your appointment has moved", body: "Hi {client}, your appointment at {business} is now on {date} at {time}." },
  { key: "appointment_cancelled", live: true, group: "Appointment updates", title: "Cancelled appointment", description: "Sent when an appointment is cancelled.", defaultOn: true, trigger: "When an appointment is cancelled", subject: "Your appointment was cancelled", body: "Hi {client}, your appointment at {business} on {date} has been cancelled." },
  { key: "appointment_no_show", live: true, group: "Appointment updates", title: "Did not show up", description: "Sent when an appointment is marked as a no-show.", defaultOn: true, trigger: "When an appointment is marked as a no-show", subject: "We missed you today", body: "Hi {client}, we missed you at {business} today. Book again whenever suits you." },
  { key: "appointment_thank_you", live: true, group: "Appointment updates", title: "Thank you for visiting", description: "Sent after checkout, with a link to leave a review.", defaultOn: true, trigger: "When an appointment is checked out", subject: "Thanks for visiting {business}", body: "Hi {client}, thank you for visiting. We'd love to hear how it went." },
  { key: "waitlist_joined", group: "Waitlist updates", title: "Joined the waitlist", description: "Sent when a client joins the waitlist.", defaultOn: true, trigger: "When a client joins the waitlist", subject: "You're on the waitlist", body: "Hi {client}, you're on the waitlist at {business}. We'll let you know when a time opens up." },
  { key: "waitlist_slot_available", group: "Waitlist updates", title: "Time slot available", description: "Sent when a time the client wants becomes free.", defaultOn: true, trigger: "When a matching time becomes free", subject: "A time just opened up", body: "Hi {client}, a time you wanted at {business} is now free. Book it before it goes." },
  { key: "rebook_reminder", group: "Increase bookings", title: "Reminder to rebook", description: "Reminds clients to rebook a few weeks after their last visit.", defaultOn: true, trigger: "Weeks after a client's last appointment (set per service)", subject: "Time for your next visit?", body: "Hi {client}, it's been a while. Book your next appointment at {business}." },
  { key: "birthday", group: "Increase bookings", title: "Celebrate birthdays", description: "Surprise clients on their birthday.", defaultOn: false, trigger: "On a client's birthday", subject: "Happy birthday from {business}", body: "Happy birthday, {client}! Treat yourself to something special." },
  { key: "win_back", group: "Increase bookings", title: "Win back lapsed clients", description: "Reach clients you haven't seen in a while.", defaultOn: false, trigger: "When a client hasn't visited for 8 weeks", subject: "We miss you", body: "Hi {client}, we haven't seen you for a while. Come back and see us at {business}." },
  { key: "reward_loyal", group: "Increase bookings", title: "Reward loyal clients", description: "Message your top spenders with a special offer.", defaultOn: false, trigger: "When a client becomes a top spender", subject: "A thank you from {business}", body: "Hi {client}, thank you for being one of our best clients." },
  { key: "welcome_new", group: "Celebrate milestones", title: "Welcome new clients", description: "Welcome new clients after their first visit.", defaultOn: false, trigger: "After a client's first appointment", subject: "Welcome to {business}", body: "Hi {client}, welcome! We're glad you found us." },
  { key: "loyalty_points", group: "Client loyalty", title: "Earned points summary", description: "Send clients a summary of points earned.", defaultOn: false, trigger: "After points are earned", subject: "You earned points", body: "Hi {client}, here's what you've earned at {business}." },
  { key: "loyalty_tier", group: "Client loyalty", title: "Achieved loyalty tier", description: "Tell clients when they reach a new tier.", defaultOn: false, trigger: "When a client reaches a new tier", subject: "You've reached a new tier", body: "Congratulations {client}, you've reached a new loyalty tier at {business}." },
];

export const LIVE_AUTOMATION_KEYS = AUTOMATIONS.filter((a) => a.live).map((a) => a.key);

export function automationByKey(key: string) {
  return AUTOMATIONS.find((a) => a.key === key);
}
