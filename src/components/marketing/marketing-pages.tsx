import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { EnvelopeSimple, Info, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { isMissingTable } from "@/components/calendar/blocked-time";
import { FeatureIntro, PageHeader } from "@/components/sales/list-ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

type Automation = {
  key: string;
  group: string;
  title: string;
  description: string;
  defaultOn: boolean;
  trigger: string;
  subject: string;
  body: string;
};

const GROUPS = [
  "Reminders",
  "Appointment updates",
  "Waitlist updates",
  "Increase bookings",
  "Celebrate milestones",
  "Client loyalty",
] as const;

export const AUTOMATIONS: Automation[] = [
  { key: "reminder_3_days", group: "Reminders", title: "3 days upcoming appointment reminder", description: "Reminds clients of their appointment three days before.", defaultOn: true, trigger: "3 days before an upcoming appointment", subject: "See you on {date}", body: "Hi {client}, just a reminder about your appointment at {business} on {date} at {time}." },
  { key: "reminder_24_hours", group: "Reminders", title: "24 hours upcoming appointment reminder", description: "Reminds clients of their appointment the day before.", defaultOn: true, trigger: "24 hours before an upcoming appointment", subject: "Reminder about your appointment on {date} at {time}", body: "Hi {client}, just a reminder about your appointment at {business} tomorrow at {time}." },
  { key: "reminder_1_hour", group: "Reminders", title: "1 hour upcoming appointment reminder", description: "Reminds clients an hour before their appointment.", defaultOn: true, trigger: "1 hour before an upcoming appointment", subject: "See you soon", body: "Hi {client}, your appointment at {business} starts at {time}." },
  { key: "appointment_new", group: "Appointment updates", title: "New appointment", description: "Lets clients know when an appointment is booked for them.", defaultOn: true, trigger: "When an appointment is booked", subject: "Your appointment is booked", body: "Hi {client}, you're booked in at {business} on {date} at {time}." },
  { key: "appointment_rescheduled", group: "Appointment updates", title: "Rescheduled appointment", description: "Sent when an appointment's start time changes.", defaultOn: true, trigger: "When an appointment's start time changes", subject: "Your appointment has moved", body: "Hi {client}, your appointment at {business} is now on {date} at {time}." },
  { key: "appointment_cancelled", group: "Appointment updates", title: "Cancelled appointment", description: "Sent when an appointment is cancelled.", defaultOn: true, trigger: "When an appointment is cancelled", subject: "Your appointment was cancelled", body: "Hi {client}, your appointment at {business} on {date} has been cancelled." },
  { key: "appointment_no_show", group: "Appointment updates", title: "Did not show up", description: "Sent when an appointment is marked as a no-show.", defaultOn: true, trigger: "When an appointment is marked as a no-show", subject: "We missed you today", body: "Hi {client}, we missed you at {business} today. Book again whenever suits you." },
  { key: "appointment_thank_you", group: "Appointment updates", title: "Thank you for visiting", description: "Sent after checkout, with a link to leave a review.", defaultOn: true, trigger: "When an appointment is checked out", subject: "Thanks for visiting {business}", body: "Hi {client}, thank you for visiting. We'd love to hear how it went." },
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

type SavedRow = { key: string; enabled: boolean; channels: string[] };

const card = "rounded-xl bg-card shadow-[inset_0_0_0_1px_var(--color-border)]";

function fill(template: string, businessName: string) {
  return template
    .replaceAll("{client}", "Ada")
    .replaceAll("{business}", businessName)
    .replaceAll("{date}", "Wed, 21 Oct")
    .replaceAll("{time}", "11:00");
}

export function AutomationsPage() {
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const businessId = business?.id;
  const [open, setOpen] = useState<Automation | null>(null);

  const saved = useQuery({
    queryKey: ["message-automations", businessId],
    enabled: Boolean(businessId),
    retry: false,
    queryFn: async (): Promise<SavedRow[]> => {
      const { data, error } = await supabase
        .from("message_automations")
        .select("key, enabled, channels")
        .eq("business_id", businessId!);
      if (error) throw error;
      return data ?? [];
    },
  });
  const missingTable = isMissingTable(saved.error as { code?: string; message?: string } | null);

  const state = useMemo(() => {
    const map = new Map((saved.data ?? []).map((row) => [row.key, row]));
    return (key: string) => {
      const row = map.get(key);
      const def = AUTOMATIONS.find((a) => a.key === key)!;
      return { enabled: row ? row.enabled : def.defaultOn, channels: row?.channels ?? ["email"] };
    };
  }, [saved.data]);

  const toggle = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("message_automations")
        .upsert({ business_id: businessId!, key, enabled, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["message-automations", businessId] });
      toast.success(vars.enabled ? "Automation enabled" : "Automation disabled");
    },
    onError: (error: { code?: string; message: string }) =>
      toast.error(
        isMissingTable(error)
          ? "This needs a database update first: run notes/supabase-update-2026-10-18.sql in Supabase"
          : error.message,
      ),
  });

  return (
    <div className="space-y-8">
      <PageHeader title="Automations" subtitle="View and manage all automated messages sent to your clients." learnMore />

      <div className={cn(card, "flex items-start gap-4 px-6 py-5")}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
          <EnvelopeSimple size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-heading font-semibold">Message delivery isn&apos;t connected yet</p>
          <p className="mt-1 text-body text-muted-foreground">
            Choose which messages you want here. Nothing is sent to clients until an email, SMS or WhatsApp provider is
            connected to Bookly.
          </p>
        </div>
      </div>

      {missingTable ? (
        <p className="flex items-start gap-2 rounded-xl bg-[#fff7e6] px-5 py-4 text-body text-[#7a4b00]">
          <Info size={20} className="mt-0.5 shrink-0" />
          Saving your choices needs a database update: run notes/supabase-update-2026-10-18.sql in Supabase.
        </p>
      ) : null}

      <div className="grid items-start gap-8 lg:grid-cols-[208px_1fr]">
        <nav className="hidden lg:sticky lg:top-4 lg:block">
          <ul>
            {GROUPS.map((group) => (
              <li key={group}>
                <a
                  href={`#automations-${group.replaceAll(" ", "-").toLowerCase()}`}
                  className="flex h-11 items-center rounded-[8px] px-4 text-body font-medium hover:bg-secondary"
                >
                  {group}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-10">
          {GROUPS.map((group) => (
            <section key={group} id={`automations-${group.replaceAll(" ", "-").toLowerCase()}`} className="scroll-mt-4">
              <h2 className="text-title font-semibold">{group}</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {AUTOMATIONS.filter((a) => a.group === group).map((automation) => {
                  const { enabled } = state(automation.key);
                  return (
                    <div key={automation.key} className={cn(card, "flex flex-col p-5")}>
                      <button type="button" onClick={() => setOpen(automation)} className="text-left">
                        <p className="text-heading font-semibold hover:underline">{automation.title}</p>
                        <p className="mt-1 text-body text-muted-foreground">{automation.description}</p>
                      </button>
                      <div className="mt-4 flex items-center justify-between">
                        <button
                          type="button"
                          disabled={toggle.isPending}
                          onClick={() => toggle.mutate({ key: automation.key, enabled: !enabled })}
                          className={cn(
                            "inline-flex h-8 items-center rounded-full px-3 text-caption font-semibold transition-colors",
                            enabled
                              ? "bg-[#e6f6ea] text-[#1f8a3e] hover:bg-[#d4efdb]"
                              : "border border-input bg-card text-foreground hover:bg-secondary",
                          )}
                        >
                          {enabled ? "Enabled" : "Enable"}
                        </button>
                        <button type="button" onClick={() => setOpen(automation)} className="text-body font-medium text-primary hover:underline">
                          Preview
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <AutomationDialog
        automation={open}
        enabled={open ? state(open.key).enabled : false}
        businessName={business?.name ?? "Your business"}
        onToggle={(enabled) => open && toggle.mutate({ key: open.key, enabled })}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}

function AutomationDialog({
  automation,
  enabled,
  businessName,
  onToggle,
  onClose,
}: {
  automation: Automation | null;
  enabled: boolean;
  businessName: string;
  onToggle: (enabled: boolean) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"preview" | "details">("preview");
  return (
    <Dialog open={automation !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[40rem] gap-0 overflow-y-auto rounded-2xl border-0 p-0 [&>button]:hidden">
        {automation ? (
          <>
            <div className="flex items-start justify-between gap-4 px-8 pt-6">
              <div className="pt-2">
                <p className="text-caption text-muted-foreground">Automations · {automation.group}</p>
                <DialogTitle className="mt-1 text-title font-semibold">{automation.title}</DialogTitle>
              </div>
              <button type="button" aria-label="Close" onClick={onClose} className="flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-secondary">
                <X size={20} />
              </button>
            </div>
            <DialogDescription className="px-8 text-body text-muted-foreground">{automation.description}</DialogDescription>
            <div className="mt-5 flex gap-2 px-8">
              {(["preview", "details"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "h-9 rounded-full px-4 text-body font-medium capitalize",
                    tab === key ? "bg-ink text-ink-foreground" : "hover:bg-secondary",
                  )}
                >
                  {key}
                </button>
              ))}
            </div>
            <div className="px-8 pb-8 pt-5">
              {tab === "preview" ? (
                <div className="mx-auto max-w-sm rounded-[2rem] bg-secondary p-3">
                  <div className="rounded-[1.5rem] bg-card p-5">
                    <p className="text-heading font-semibold">{fill(automation.subject, businessName)}</p>
                    <p className="mt-1 text-caption text-muted-foreground">{businessName} · to inbox</p>
                    <p className="mt-5 text-body">{fill(automation.body, businessName)}</p>
                  </div>
                </div>
              ) : (
                <dl className="space-y-4 text-body">
                  <div>
                    <dt className="font-semibold">Send to clients</dt>
                    <dd className="text-muted-foreground">{automation.trigger}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Channels</dt>
                    <dd className="text-muted-foreground">Email (SMS and WhatsApp once connected)</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Status</dt>
                    <dd className="text-muted-foreground">{enabled ? "Enabled" : "Disabled"}</dd>
                  </div>
                </dl>
              )}
              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={() => onToggle(!enabled)}
                  className={cn(
                    "inline-flex h-12 items-center rounded-full px-5 text-heading font-semibold",
                    enabled ? "border border-input bg-card hover:bg-secondary" : "bg-ink text-ink-foreground hover:bg-ink/90",
                  )}
                >
                  {enabled ? "Disable" : "Enable"}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const later = (feature: string) => () => toast(`${feature} is coming in a later update`);

export function BlastCampaigns() {
  return (
    <FeatureIntro
      title="Promote your business with blast campaigns"
      body="Share special offers and important news with your clients by email and text message."
      bullets={[
        "Make every message match your style",
        "Send to everyone, a client segment or chosen clients",
        "See how each campaign performs in real time",
      ]}
      onStart={later("Blast campaigns")}
    />
  );
}

export function MessagesHistory() {
  const navigate = useNavigate();
  return (
    <FeatureIntro
      title="Keep clients up to date automatically"
      body="Every reminder, update and campaign you send appears here once message delivery is connected."
      bullets={[
        "Cut no-shows with reminders and updates",
        "Win more reviews with thank-you messages after each visit",
        "Reach clients by email, text and WhatsApp",
      ]}
      cta="Set up automations"
      onStart={() => navigate({ to: "/marketing", search: { tab: "automations" } })}
    />
  );
}

export function Deals() {
  return (
    <FeatureIntro
      title="Reward and keep clients with deals"
      body="Discount codes, flash sales and last-minute offers bring clients in and fill quiet times."
      bullets={[
        "Create and share discount codes",
        "Run a flash sale to get more bookings",
        "Fill gaps in your calendar with last-minute offers",
        "Track how every deal performs",
      ]}
      onStart={later("Deals")}
    />
  );
}

export function SmartPricing() {
  return (
    <FeatureIntro
      title="Earn more with peak and off-peak pricing"
      body="Adjust prices automatically for busier and quieter hours."
      bullets={[
        "Offer off-peak discounts to fill quiet hours",
        "Raise prices at peak times",
        "See the effect on bookings and sales",
      ]}
      onStart={later("Smart pricing")}
    />
  );
}
