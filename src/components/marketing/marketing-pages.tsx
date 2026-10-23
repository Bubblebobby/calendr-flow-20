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
import { AUTOMATIONS, AUTOMATION_GROUPS as GROUPS, type Automation } from "@/lib/automations";
import { getAutomationStatus } from "@/lib/automations.functions";
import { cn } from "@/lib/utils";

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
  const status = useQuery({
    queryKey: ["automation-status"],
    retry: false,
    refetchInterval: 60_000,
    queryFn: () => getAutomationStatus(),
  });

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

      <DeliveryBanner email={status.data?.email ?? null} lastRun={status.data?.lastRun ?? null} />

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
                        {!automation.live ? (
                          <span className="inline-flex h-8 items-center rounded-full bg-secondary px-3 text-caption font-semibold text-muted-foreground">
                            Coming soon
                          </span>
                        ) : (
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
                        )}
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

/** Whether automated emails are actually going out: email connected, and the scheduler running. */
function DeliveryBanner({ email, lastRun }: { email: boolean | null; lastRun: string | null }) {
  if (email === null) return null;
  const minutesAgo = lastRun ? Math.round((Date.now() - new Date(lastRun).getTime()) / 60000) : null;
  const running = minutesAgo !== null && minutesAgo <= 30;
  const title = !email
    ? "Email isn't connected"
    : running
      ? "Automated emails are on"
      : "Reminders aren't scheduled yet";
  const body = !email
    ? "Nothing below is sent until email is connected to Bookly."
    : running
      ? `Reminders and appointment updates you enable below are emailed to clients who have an email address. Last checked ${minutesAgo! < 1 ? "just now" : `${minutesAgo} min ago`}.`
      : "Confirmations, cancellations and changes made from the online booking page are emailed straight away. Reminders and updates made in your calendar start once the scheduler is running.";
  return (
    <div
      className={cn(
        card,
        "flex items-start gap-4 px-6 py-5",
        email && running ? "bg-[#e6f6ea] shadow-none" : "",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          email && running ? "bg-card text-[#1f8a3e]" : "bg-accent text-primary",
        )}
      >
        <EnvelopeSimple size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-heading font-semibold">{title}</p>
        <p className="mt-1 text-body text-muted-foreground">{body}</p>
      </div>
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
                    <dd className="text-muted-foreground">Email (SMS and WhatsApp aren&apos;t available yet)</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Status</dt>
                    <dd className="text-muted-foreground">{!automation.live ? "Coming soon" : enabled ? "Enabled" : "Disabled"}</dd>
                  </div>
                </dl>
              )}
              <div className="mt-8 flex justify-end">
                {!automation.live ? (
                  <p className="text-body text-muted-foreground">This automation is coming in a later update.</p>
                ) : (
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
                )}
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
      comingSoon
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
      comingSoon
    />
  );
}
