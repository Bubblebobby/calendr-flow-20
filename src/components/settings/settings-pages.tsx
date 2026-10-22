import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Buildings,
  Info,
  CalendarDots,
  CreditCard,
  FileText,
  Receipt,
  Trash,
  UserCircle,
  UsersThree,
  Wallet,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { isMissingTable } from "@/components/calendar/blocked-time";
import { ConfirmDialog } from "@/components/catalog/catalog-ui";
import { BrandingSettings } from "@/components/settings/branding-settings";
import { BusinessHoursPanel } from "@/components/settings/business-hours-panel";
import { TaxSettings } from "@/components/settings/tax-settings";
import { CLIENT_SOURCES } from "@/components/clients/client-form";
import { pillButton } from "@/components/sales/list-ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { countryByCode } from "@/lib/countries";
import { EMPTY_ADDRESS, type BusinessAddress } from "@/lib/google-maps";
import { TIME_OFF_TYPES, isoDay } from "@/lib/team-shifts";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";
import { SkeletonForm } from "@/components/ui/skeletons";

type PageDef = { key: string; label: string };
type SectionDef = {
  key: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  pages: PageDef[];
};

export const SECTIONS: SectionDef[] = [
  {
    key: "business",
    title: "Business setup",
    description: "Customise business details, branding and your location.",
    icon: <Buildings size={24} />,
    pages: [
      { key: "details", label: "Business details" },
      { key: "branding", label: "Branding" },
      { key: "location", label: "Location" },
      { key: "service-menu", label: "Service menu" },
      { key: "clients-list", label: "Clients list" },
    ],
  },
  {
    key: "scheduling",
    title: "Scheduling",
    description: "Set your opening hours, closed periods and online booking.",
    icon: <CalendarDots size={24} />,
    pages: [
      { key: "hours", label: "Opening hours" },
      { key: "closed", label: "Closed periods" },
      { key: "time-off-types", label: "Time off types" },
      { key: "online-booking", label: "Online booking" },
      { key: "shifts", label: "Scheduled shifts" },
    ],
  },
  {
    key: "sales",
    title: "Sales",
    description: "Payment methods, taxes, receipts, tipping and gift cards.",
    icon: <Receipt size={24} />,
    pages: [
      { key: "payment-methods", label: "Payment methods" },
      { key: "tipping", label: "Tipping" },
      { key: "tax", label: "Tax rates" },
      { key: "receipts", label: "Receipts" },
    ],
  },
  {
    key: "clients",
    title: "Clients",
    description: "Manage client sources and client tags.",
    icon: <UserCircle size={24} />,
    pages: [
      { key: "tags", label: "Client tags" },
      { key: "sources", label: "Client sources" },
    ],
  },
  {
    key: "billing",
    title: "Billing",
    description: "Your Bookly plan, invoices and message credits.",
    icon: <Wallet size={24} />,
    pages: [{ key: "plan", label: "Plan and invoices" }],
  },
  {
    key: "team",
    title: "Team",
    description: "Manage permission roles and time off.",
    icon: <UsersThree size={24} />,
    pages: [
      { key: "roles", label: "Permission roles" },
      { key: "time-off-types", label: "Time off types" },
    ],
  },
  {
    key: "forms",
    title: "Forms",
    description: "Templates for consultation and intake forms.",
    icon: <FileText size={24} />,
    pages: [{ key: "templates", label: "Form templates" }],
  },
  {
    key: "payments",
    title: "Payments",
    description: "Payment policy, card payments and terminals.",
    icon: <CreditCard size={24} />,
    pages: [{ key: "policy", label: "Payment policy" }],
  },
];

const card = "rounded-xl bg-card shadow-[inset_0_0_0_1px_var(--color-border)]";
const field = "mt-2 h-12 w-full rounded-[8px] border border-input bg-card px-4 text-body font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

// ─── Home ───────────────────────────────────────────────────────────────────

const HOME_TABS = ["settings", "online", "marketing", "other"] as const;

export function SettingsHome() {
  const { data: business } = useBusiness();
  const [tab, setTab] = useState<(typeof HOME_TABS)[number]>("settings");
  const links: Record<Exclude<(typeof HOME_TABS)[number], "settings">, Array<{ title: string; body: string; to: string; search?: Record<string, string> }>> = {
    online: [
      { title: "Booking profile", body: "Publish your booking page so clients can book online.", to: "/online-booking", search: { tab: "profile" } },
      { title: "Link builder", body: "Create shareable booking links and QR codes.", to: "/online-booking", search: { tab: "links" } },
      { title: "Reserve with Google", body: "Get bookings from Google Search and Maps.", to: "/online-booking", search: { tab: "google" } },
      { title: "Facebook and Instagram", body: "Get bookings from your social pages.", to: "/online-booking", search: { tab: "social" } },
    ],
    marketing: [
      { title: "Automations", body: "Choose which automatic messages clients get.", to: "/marketing", search: { tab: "automations" } },
      { title: "Blast campaigns", body: "Share offers and news by email and text.", to: "/marketing", search: { tab: "campaigns" } },
      { title: "Deals", body: "Discount codes, flash sales and last-minute offers.", to: "/marketing", search: { tab: "deals" } },
      { title: "Reviews", body: "Star ratings and reviews from clients.", to: "/clients", search: { tab: "reviews" } },
    ],
    other: [
      { title: "Add-ons", body: "Extend Bookly with add-ons.", to: "/add-ons" },
      { title: "Integrations", body: "Connect Bookly to other apps.", to: "/add-ons", search: { tab: "integrations" } },
    ],
  };
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display font-semibold">Workspace settings</h1>
        <p className="mt-1 text-body text-muted-foreground">Manage settings for {business?.name ?? "your business"}.</p>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {HOME_TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "h-9 shrink-0 rounded-full px-4 text-body font-medium",
              tab === key ? "bg-ink text-ink-foreground" : "border border-input bg-card hover:bg-secondary",
            )}
          >
            {{ settings: "Settings", online: "Online presence", marketing: "Marketing", other: "Other" }[key]}
          </button>
        ))}
      </div>
      {tab === "settings" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((section) => (
            <Link
              key={section.key}
              to="/settings"
              search={{ section: section.key, page: section.pages[0]!.key }}
              className={cn(card, "flex flex-col p-6 transition-colors hover:bg-secondary")}
            >
              <span className="text-primary">{section.icon}</span>
              <span className="mt-4 text-heading font-semibold">{section.title}</span>
              <span className="mt-1 text-body text-muted-foreground">{section.description}</span>
            </Link>
          ))}
        </div>
      ) : (
        <ul className={cn(card, "divide-y divide-border")}>
          {links[tab].map((link) => (
            <li key={link.title} className="flex items-center gap-4 px-6 py-5">
              <span className="min-w-0 flex-1">
                <span className="block text-heading font-semibold">{link.title}</span>
                <span className="block text-body text-muted-foreground">{link.body}</span>
              </span>
              <Link to={link.to} search={(link.search ?? {}) as never} className="text-body font-medium text-primary hover:underline">
                View
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Section layout ─────────────────────────────────────────────────────────

export function SettingsSection({ sectionKey, pageKey }: { sectionKey: string; pageKey?: string | undefined }) {
  const section = SECTIONS.find((s) => s.key === sectionKey);
  const navigate = useNavigate();
  if (!section) return <SettingsHome />;
  const page = section.pages.find((p) => p.key === pageKey) ?? section.pages[0]!;

  // Pages that live elsewhere in Bookly jump straight there.
  const elsewhere: Record<string, { to: string; search?: Record<string, string> }> = {
    "business/service-menu": { to: "/catalog" },
    "business/clients-list": { to: "/clients" },
    "scheduling/online-booking": { to: "/online-booking", search: { tab: "profile" } },
    "scheduling/shifts": { to: "/team", search: { tab: "shifts" } },
  };
  const jump = elsewhere[`${section.key}/${page.key}`];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/settings" className="inline-flex h-10 items-center gap-2 rounded-full border border-input px-4 text-body font-medium hover:bg-secondary">
          <ArrowLeft size={16} /> Back
        </Link>
        <span className="text-body text-muted-foreground">
          Workspace settings · <span className="text-foreground">{section.title}</span>
        </span>
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-[240px_1fr]">
        <nav className="rounded-xl bg-card px-2 py-4 shadow-[inset_0_0_0_1px_var(--color-border)]">
          <p className="px-4 pb-2 text-heading font-semibold">{section.title}</p>
          <ul className="space-y-1">
            {section.pages.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => {
                    const target = elsewhere[`${section.key}/${p.key}`];
                    if (target) navigate({ to: target.to, search: (target.search ?? {}) as never });
                    else navigate({ to: "/settings", search: { section: section.key, page: p.key } });
                  }}
                  className={cn(
                    "flex h-11 w-full items-center rounded-[8px] px-4 text-left text-body font-medium transition-colors",
                    p.key === page.key ? "bg-accent" : "hover:bg-secondary",
                  )}
                >
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          {jump ? (
            <Placeholder title={page.label} body="This lives in its own part of Bookly." action={{ label: `Open ${page.label}`, onClick: () => navigate({ to: jump.to, search: (jump.search ?? {}) as never }) }} />
          ) : (
            <SettingsPage sectionKey={section.key} pageKey={page.key} />
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsPage({ sectionKey, pageKey }: { sectionKey: string; pageKey: string }) {
  switch (`${sectionKey}/${pageKey}`) {
    case "business/details":
      return <BusinessDetails />;
    case "business/branding":
      return <BrandingSettings />;
    case "business/location":
      return <BusinessLocation />;
    case "scheduling/hours":
      return (
        <PageBlock title="Opening hours" subtitle="When your business is open. Team members without shifts follow these hours, and online booking uses them.">
          <BusinessHoursPanel />
        </PageBlock>
      );
    case "scheduling/closed":
      return <ClosedPeriods />;
    case "scheduling/time-off-types":
    case "team/time-off-types":
      return (
        <PageBlock title="Time off types" subtitle="The reasons team members can take time off.">
          <ul className={cn(card, "divide-y divide-border")}>
            {Object.values(TIME_OFF_TYPES).map((label) => (
              <li key={label} className="px-5 py-4 text-body font-medium">
                {label}
              </li>
            ))}
          </ul>
        </PageBlock>
      );
    case "sales/tax":
      return <TaxSettings view="tax" />;
    case "sales/receipts":
      return <TaxSettings view="receipts" />;
    case "sales/payment-methods":
      return (
        <PageBlock title="Payment methods" subtitle="How clients can pay at checkout.">
          <ul className={cn(card, "divide-y divide-border")}>
            {["Cash", "Card", "Other"].map((label) => (
              <li key={label} className="flex items-center justify-between px-5 py-4 text-body font-medium">
                {label}
                <span className="rounded-full bg-success-soft px-2 py-0.5 text-caption font-semibold text-success">Active</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-caption text-muted-foreground">Custom payment methods are coming in a later update.</p>
        </PageBlock>
      );
    case "sales/tipping":
      return (
        <PageBlock title="Tipping" subtitle="At checkout clients can tip 10%, 18% or 25%, or a custom amount. Tips appear in the Tips summary report." />
      );
    case "clients/tags":
      return <ClientTags />;
    case "clients/sources":
      return (
        <PageBlock title="Client sources" subtitle="How clients found you. Online bookings are tagged automatically.">
          <ul className={cn(card, "divide-y divide-border")}>
            {CLIENT_SOURCES.map((label) => (
              <li key={label} className="px-5 py-4 text-body font-medium">
                {label}
              </li>
            ))}
          </ul>
        </PageBlock>
      );
    case "team/roles":
      return <TeamRoles />;
    default:
      return <Placeholder title={SECTIONS.find((s) => s.key === sectionKey)?.pages.find((p) => p.key === pageKey)?.label ?? "Settings"} body="This setting is coming in a later update." />;
  }
}

function PageBlock({ title, subtitle, children, action }: { title: string; subtitle: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-display font-semibold leading-9 text-foreground">{title}</h2>
          <p className="mt-1 max-w-2xl text-body text-muted-foreground">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Placeholder({ title, body, action }: { title: string; body: string; action?: { label: string; onClick: () => void } }) {
  return (
    <PageBlock title={title} subtitle={body}>
      {action ? (
        <button type="button" onClick={action.onClick} className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}>
          {action.label}
        </button>
      ) : null}
    </PageBlock>
  );
}

// ─── Business details ───────────────────────────────────────────────────────

function useBusinessRow() {
  const { data: business } = useBusiness();
  return useQuery({
    queryKey: ["business-row", business?.id],
    enabled: Boolean(business?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, website, timezone, country, currency, location")
        .eq("id", business!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

const TIME_ZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
  } catch {
    return ["Africa/Lagos", "Europe/London", "America/New_York"];
  }
})();

/*
 * Business details laid out like Square's settings table (a label column, a hatched value column
 * and an "Edit" link per field), drawn with Bookly's own card, colours and type sizes. Edit turns
 * that one row into an input with Save and Cancel.
 */
type DetailKey = "name" | "timezone" | "website" | "contact_phone" | "contact_email";

/** Contact phone and email; null until the contact database update has been run. */
function useBusinessContactRow(businessId: string | undefined) {
  return useQuery({
    queryKey: ["business-contact-row", businessId],
    enabled: Boolean(businessId),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("businesses").select("contact_phone, contact_email").eq("id", businessId!).single();
      if (error) return null;
      return data;
    },
  });
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Why a draft can't be saved, or null if it can. */
function detailProblem(key: DetailKey, value: string) {
  const v = value.trim();
  if (key === "name" && !v) return "Add a business name.";
  if (key === "contact_phone" && v && (v.length < 5 || v.length > 30)) return "Check the phone number.";
  if (key === "contact_email" && v && !EMAIL.test(v)) return "Check the email address.";
  return null;
}

function BusinessDetails() {
  const row = useBusinessRow();
  const contactRow = useBusinessContactRow(row.data?.id);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<DetailKey | null>(null);
  const [draft, setDraft] = useState("");

  const save = useMutation({
    mutationFn: async ({ key, value }: { key: DetailKey; value: string }) => {
      const trimmed = value.trim();
      const update =
        key === "name"
          ? { name: trimmed }
          : key === "timezone"
            ? { timezone: trimmed }
            : key === "contact_phone"
              ? { contact_phone: trimmed || null }
              : key === "contact_email"
                ? { contact_email: trimmed || null }
                : {
                    website: trimmed
                      ? /^https?:\/\//.test(trimmed)
                        ? trimmed
                        : `https://${trimmed}`
                      : null,
                  };
      const { error } = await supabase.from("businesses").update(update).eq("id", row.data!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["business-row"] });
      queryClient.invalidateQueries({ queryKey: ["business-contact-row"] });
      queryClient.invalidateQueries({ queryKey: ["current-business"] });
      queryClient.invalidateQueries({ queryKey: ["top-bar-profile"] });
      toast.success("Business details saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!row.data) return <SkeletonForm fields={4} label="Loading settings" />;
  const data = row.data;
  const country = countryByCode(data.country);

  function startEdit(key: DetailKey, value: string) {
    setDraft(value);
    setEditing(key);
  }

  const editor = (key: DetailKey) => {
    const problem = detailProblem(key, draft);
    const invalid = problem !== null;
    return (
      <form
        className="flex w-full flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid) save.mutate({ key, value: draft });
        }}
      >
        {key === "timezone" ? (
          <select
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className={cn(field, "mt-0 h-10 min-w-0 flex-1")}
          >
            {TIME_ZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        ) : (
          <input
            autoFocus
            type={key === "contact_phone" ? "tel" : key === "contact_email" ? "email" : "text"}
            value={draft}
            maxLength={key === "name" ? 100 : key === "contact_phone" ? 30 : key === "contact_email" ? 254 : 200}
            placeholder={
              key === "website"
                ? "www.yoursalon.com"
                : key === "contact_phone"
                  ? "0801 234 5678"
                  : key === "contact_email"
                    ? "hello@yoursalon.com"
                    : undefined
            }
            aria-invalid={invalid && draft.trim() !== "" ? true : undefined}
            onChange={(event) => setDraft(event.target.value)}
            className={cn(field, "mt-0 h-10 min-w-0 flex-1")}
          />
        )}
        <button
          type="submit"
          disabled={invalid || save.isPending}
          className={cn(pillButton, "h-10 bg-ink text-ink-foreground hover:bg-ink/90")}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className={cn(pillButton, "h-10 hover:bg-secondary")}
        >
          Cancel
        </button>
        {problem && draft.trim() ? (
          <p role="alert" className="w-full text-caption text-destructive">
            {problem}
          </p>
        ) : null}
      </form>
    );
  };

  return (
    <PageBlock title="Business details" subtitle="Your business name, location settings and how clients can reach you.">
      <TooltipProvider delayDuration={150}>
        <dl className={cn(card, "overflow-hidden")}>
          <DetailRow
            label="Display business name"
            editing={editing === "name"}
            editor={editor("name")}
            onEdit={() => startEdit("name", data.name)}
          >
            {data.name}
          </DetailRow>
          <DetailRow
            label="Country"
            info="Set when your business was created. It decides your currency, so it can't be changed here."
          >
            {country?.name ?? data.country}
          </DetailRow>
          <DetailRow label="Currency" info="Prices, sales and reports all use this currency.">
            {data.currency}
          </DetailRow>
          <DetailRow
            label="Time zone"
            info="Online booking and reminders show times in this time zone."
            editing={editing === "timezone"}
            editor={editor("timezone")}
            onEdit={() => startEdit("timezone", data.timezone ?? "Africa/Lagos")}
          >
            {(data.timezone ?? "Africa/Lagos").replaceAll("_", " ")}
          </DetailRow>
          <DetailRow
            label="Website"
            placeholder="Website"
            editing={editing === "website"}
            editor={editor("website")}
            onEdit={() => startEdit("website", data.website ?? "")}
          >
            {data.website}
          </DetailRow>
          {contactRow.data ? (
            <>
              <DetailRow
                label="Contact phone"
                info="Clients see this on their booking confirmation and booking link."
                placeholder="Phone number"
                editing={editing === "contact_phone"}
                editor={editor("contact_phone")}
                onEdit={() => startEdit("contact_phone", contactRow.data?.contact_phone ?? "")}
              >
                {contactRow.data.contact_phone}
              </DetailRow>
              <DetailRow
                label="Contact email"
                info="Clients see this on their booking confirmation and booking link."
                placeholder="Email address"
                editing={editing === "contact_email"}
                editor={editor("contact_email")}
                onEdit={() => startEdit("contact_email", contactRow.data?.contact_email ?? "")}
              >
                {contactRow.data.contact_email}
              </DetailRow>
            </>
          ) : null}
        </dl>
      </TooltipProvider>
    </PageBlock>
  );
}

// Read-only value cell: fine diagonal hatching in the border colour.
const hatched =
  "bg-[repeating-linear-gradient(-45deg,var(--color-border)_0_1px,transparent_1px_9px)]";

function DetailRow({
  label,
  info,
  placeholder,
  editing,
  editor,
  onEdit,
  children,
}: {
  label: string;
  info?: string;
  placeholder?: string;
  editing?: boolean;
  editor?: React.ReactNode;
  onEdit?: () => void;
  children?: React.ReactNode;
}) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className="grid border-b border-border last:border-b-0 sm:grid-cols-[minmax(180px,1fr)_2fr]">
      <dt className="flex items-center justify-between gap-3 bg-muted px-6 py-4 text-body font-semibold text-foreground">
        {label}
        {info ? (
          <Tooltip>
            <TooltipTrigger
              type="button"
              aria-label={`About ${label.toLowerCase()}`}
              className="shrink-0 rounded-full text-muted-foreground transition-colors hover:text-foreground"
            >
              <Info size={18} />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] text-caption">
              {info}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </dt>
      <dd
        className={cn(
          "flex min-h-16 items-center justify-between gap-4 px-6 py-3 text-body",
          editing ? "bg-card" : hatched,
        )}
      >
        {editing ? (
          editor
        ) : (
          <>
            <span className={cn("min-w-0 break-words", empty && "text-placeholder")}>
              {empty ? (placeholder ?? "—") : children}
            </span>
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${label.toLowerCase()}`}
                className="shrink-0 text-body font-semibold underline decoration-1 underline-offset-4 transition-opacity hover:opacity-70"
              >
                Edit
              </button>
            ) : null}
          </>
        )}
      </dd>
    </div>
  );
}

function BusinessLocation() {
  const row = useBusinessRow();
  const queryClient = useQueryClient();
  const [address, setAddress] = useState<BusinessAddress>(EMPTY_ADDRESS);
  useEffect(() => {
    if (row.data) setAddress({ ...EMPTY_ADDRESS, ...((row.data.location as Partial<BusinessAddress> | null) ?? {}) });
  }, [row.data]);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("businesses").update({ location: address }).eq("id", row.data!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-row"] });
      toast.success("Location saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (!row.data) return <SkeletonForm fields={4} label="Loading settings" />;
  const input = (key: keyof BusinessAddress, label: string, required = false) => (
    <label className="block text-body font-semibold">
      {label}
      {required ? <span className="text-destructive"> *</span> : null}
      <input value={address[key]} maxLength={key === "directions" ? 200 : 100} onChange={(e) => setAddress({ ...address, [key]: e.target.value })} className={field} />
    </label>
  );
  return (
    <PageBlock
      title="Location"
      subtitle="Where clients find you. It's shown on your booking page."
      action={
        <button
          type="button"
          disabled={!address.address.trim() || !address.city.trim() || save.isPending}
          onClick={() => save.mutate()}
          className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
        >
          Save
        </button>
      }
    >
      {/^test address/i.test(address.address) ? (
        <p className="rounded-xl bg-warning-soft px-5 py-4 text-body text-warning">This is a placeholder address. Replace it with your real one.</p>
      ) : null}
      <div className={cn(card, "grid gap-4 p-6 sm:grid-cols-2 sm:p-8")}>
        {input("address", "Address", true)}
        {input("apt", "Apt./Suite etc")}
        {input("district", "District")}
        {input("city", "City", true)}
        {input("state", "State")}
        {input("postcode", "Postcode")}
        <div className="sm:col-span-2">{input("directions", "Directions for clients")}</div>
      </div>
    </PageBlock>
  );
}

// ─── Closed periods ─────────────────────────────────────────────────────────

function ClosedPeriods() {
  const { data: business } = useBusiness();
  const queryClient = useQueryClient();
  const today = isoDay(new Date());
  const [form, setForm] = useState({ start: today, end: today, description: "" });
  const [remove, setRemove] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["closed-periods", business?.id],
    enabled: Boolean(business?.id),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_closed_periods")
        .select("id, start_date, end_date, description")
        .eq("business_id", business!.id)
        .gte("end_date", today)
        .order("start_date");
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["closed-periods"] });
    queryClient.invalidateQueries({ queryKey: ["team-shifts"] });
  };
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("business_closed_periods").insert({
        business_id: business!.id,
        start_date: form.start,
        end_date: form.end,
        description: form.description.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      setForm({ start: today, end: today, description: "" });
      toast.success("Closed period added");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("business_closed_periods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      setRemove(null);
      toast.success("Closed period deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const fmt = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${d}T12:00:00`));
  if (isMissingTable(list.error as { code?: string; message?: string } | null)) {
    return <Placeholder title="Closed periods" body="This needs the shifts database update (notes/supabase-update-2026-10-18.sql)." />;
  }
  return (
    <PageBlock title="Closed periods" subtitle="Days your business is closed, like public holidays. No one is scheduled and clients can't book online.">
      <div className={cn(card, "grid items-end gap-3 p-6 sm:grid-cols-[1fr_1fr_2fr_auto]")}>
        <label className="block text-body font-semibold">
          Start date
          <input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value, end: form.end < e.target.value ? e.target.value : form.end })} className={field} />
        </label>
        <label className="block text-body font-semibold">
          End date
          <input type="date" value={form.end} min={form.start} onChange={(e) => setForm({ ...form, end: e.target.value })} className={field} />
        </label>
        <label className="block text-body font-semibold">
          Description
          <input value={form.description} maxLength={100} placeholder="e.g. Independence Day" onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
        </label>
        <button type="button" disabled={!form.start || form.end < form.start || add.isPending} onClick={() => add.mutate()} className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}>
          Add
        </button>
      </div>
      <ul className={cn(card, "divide-y divide-border")}>
        {(list.data ?? []).map((p) => (
          <li key={p.id} className="flex items-center gap-4 px-5 py-4">
            <span className="min-w-0 flex-1">
              <span className="block text-body font-semibold">{p.description || "Closed"}</span>
              <span className="block text-caption text-muted-foreground">
                {fmt(p.start_date)}
                {p.end_date !== p.start_date ? ` – ${fmt(p.end_date)}` : ""}
              </span>
            </span>
            <button type="button" aria-label="Delete closed period" onClick={() => setRemove(p.id)} className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary">
              <Trash size={18} />
            </button>
          </li>
        ))}
        {list.data && list.data.length === 0 ? <li className="px-5 py-8 text-center text-body text-muted-foreground">No upcoming closed periods.</li> : null}
      </ul>
      <ConfirmDialog
        open={remove !== null}
        destructive
        busy={del.isPending}
        title="Delete closed period"
        body="Team members will be scheduled again on these days, and clients can book online."
        confirmLabel="Delete"
        onConfirm={() => remove && del.mutate(remove)}
        onClose={() => setRemove(null)}
      />
    </PageBlock>
  );
}

// ─── Client tags ────────────────────────────────────────────────────────────

function ClientTags() {
  const { data: business } = useBusiness();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [remove, setRemove] = useState<{ id: string; name: string } | null>(null);
  const tags = useQuery({
    queryKey: ["client-tags-settings", business?.id],
    enabled: Boolean(business?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("client_tags").select("id, name").eq("business_id", business!.id).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = () => queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes("tag") });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("client_tags").insert({ business_id: business!.id, name: name.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      refresh();
      toast.success("Tag added");
    },
    onError: (error: { code?: string; message: string }) => toast.error(error.code === "23505" ? "That tag already exists" : error.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setRemove(null);
      refresh();
      toast.success("Tag deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <PageBlock title="Client tags" subtitle="Labels you can add to clients, like VIP or Allergies, to filter and segment them.">
      <form
        className={cn(card, "flex flex-wrap items-end gap-3 p-6")}
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate();
        }}
      >
        <label className="block min-w-60 flex-1 text-body font-semibold">
          New tag
          <input value={name} maxLength={40} placeholder="e.g. VIP" onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <button type="submit" disabled={!name.trim() || add.isPending} className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}>
          Add
        </button>
      </form>
      <ul className={cn(card, "divide-y divide-border")}>
        {(tags.data ?? []).map((tag) => (
          <li key={tag.id} className="flex items-center gap-4 px-5 py-3">
            <span className="flex-1 text-body font-medium">{tag.name}</span>
            <button type="button" aria-label={`Delete ${tag.name}`} onClick={() => setRemove(tag)} className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary">
              <Trash size={18} />
            </button>
          </li>
        ))}
        {tags.data && tags.data.length === 0 ? <li className="px-5 py-8 text-center text-body text-muted-foreground">No tags yet.</li> : null}
      </ul>
      <ConfirmDialog
        open={remove !== null}
        destructive
        busy={del.isPending}
        title="Delete tag"
        body={`Remove "${remove?.name ?? ""}" from all clients? The clients themselves aren't affected.`}
        confirmLabel="Delete"
        onConfirm={() => remove && del.mutate(remove.id)}
        onClose={() => setRemove(null)}
      />
    </PageBlock>
  );
}

// ─── Team roles ─────────────────────────────────────────────────────────────

function TeamRoles() {
  const { data: business } = useBusiness();
  const roles = useQuery({
    queryKey: ["team-roles-settings", business?.id],
    enabled: Boolean(business?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("team_roles").select("id, name").eq("business_id", business!.id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <PageBlock title="Permission roles" subtitle="Roles decide what team members can see and do when they sign in. The workspace owner can do everything.">
      <ul className={cn(card, "divide-y divide-border")}>
        <li className="flex items-center justify-between px-5 py-4">
          <span className="text-body font-semibold">Workspace owner</span>
          <span className="text-caption text-muted-foreground">Full access</span>
        </li>
        {(roles.data ?? []).map((role) => (
          <li key={role.id} className="px-5 py-4 text-body font-medium">
            {role.name}
          </li>
        ))}
      </ul>
      <p className="text-caption text-muted-foreground">Assign roles when inviting team members. Editing role permissions is coming in a later update.</p>
    </PageBlock>
  );
}
