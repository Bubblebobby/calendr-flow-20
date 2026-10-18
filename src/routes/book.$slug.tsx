import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, CheckCircle, Plus, UserCircle, X } from "@phosphor-icons/react";

import { pillButton } from "@/components/sales/list-ui";
import { supabase } from "@/integrations/supabase/client";
import {
  formatClock,
  freeSlots,
  localDay,
  zonedToUtc,
  type Busy,
  type OpeningHours,
} from "@/lib/booking-slots";
import { formatDuration, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type Search = { services?: string; team?: string };

export const Route = createFileRoute("/book/$slug")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(typeof search["services"] === "string" ? { services: search["services"] } : {}),
    ...(typeof search["team"] === "string" ? { team: search["team"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Book an appointment" },
      { name: "description", content: "Choose a service and book a time online." },
    ],
  }),
  component: BookingPage,
});

type Page = {
  business: {
    id: string;
    name: string;
    currency: string;
    country: string;
    timezone: string;
    description: string | null;
    location: { address?: string; city?: string } | null;
  };
  hours: OpeningHours[];
  categories: { id: string; name: string; color: string }[];
  services: {
    id: string;
    name: string;
    description: string | null;
    category_id: string | null;
    pricing_type: string;
    price: number | null;
    duration: number;
    team: string[];
  }[];
  team: { id: string; first_name: string; last_name: string | null; initials: string | null; color: string; job_title: string | null }[];
};

type Step = "services" | "professional" | "time" | "details" | "done";
const STEPS: { key: Exclude<Step, "done">; label: string }[] = [
  { key: "services", label: "Services" },
  { key: "professional", label: "Professional" },
  { key: "time", label: "Time" },
  { key: "details", label: "Confirm" },
];

const ERRORS: Record<string, string> = {
  slot_taken: "Sorry, that time was just taken. Please pick another time.",
  outside_hours: "That time is outside opening hours. Please pick another time.",
  invalid_time: "That time is no longer available. Please pick another time.",
  contact_required: "Please add an email address or phone number.",
  invalid_email: "Please check your email address.",
  booking_unavailable: "Online booking isn't available for this business right now.",
};

function BookingPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();

  const page = useQuery({
    queryKey: ["booking-page", slug],
    retry: false,
    queryFn: async (): Promise<Page | null> => {
      const { data, error } = await supabase.rpc("get_booking_page", { p_slug: slug });
      if (error) throw error;
      return (data as unknown as Page | null) ?? null;
    },
  });

  if (page.isLoading) {
    return <Centered>Loading…</Centered>;
  }
  if (page.isError || !page.data) {
    return (
      <Centered>
        <p className="text-title font-semibold">This booking page isn&apos;t available</p>
        <p className="mt-2 text-body text-muted-foreground">Check the link, or contact the business directly.</p>
      </Centered>
    );
  }
  return <BookingFlow slug={slug} page={page.data} preselect={search} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center text-body text-muted-foreground">
      {children}
    </div>
  );
}

function BookingFlow({ slug, page, preselect }: { slug: string; page: Page; preselect: Search }) {
  const { business } = page;
  const tz = business.timezone;
  const money = (amount: number) => formatMoney(amount, business.currency, business.country);

  const [step, setStep] = useState<Step>("services");
  const [selected, setSelected] = useState<string[]>(() =>
    (preselect.services ?? "").split(",").filter((id) => page.services.some((s) => s.id === id)),
  );
  const [memberId, setMemberId] = useState<string | null>(() =>
    preselect.team && page.team.some((t) => t.id === preselect.team) ? preselect.team : null,
  );
  const [day, setDay] = useState(() => localDay(tz));
  const [slot, setSlot] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

  const chosen = page.services.filter((s) => selected.includes(s.id));
  const duration = chosen.reduce((sum, s) => sum + s.duration, 0);
  const total = chosen.reduce((sum, s) => sum + (s.pricing_type === "free" ? 0 : Number(s.price ?? 0)), 0);
  const hasFrom = chosen.some((s) => s.pricing_type === "from" || s.pricing_type === "free-form");

  // Team members who can do every chosen service (no assignment = everyone can).
  const eligible = useMemo(
    () =>
      page.team.filter((member) =>
        chosen.every((service) => service.team.length === 0 || service.team.includes(member.id)),
      ),
    [page.team, chosen],
  );
  const member = page.team.find((t) => t.id === memberId) ?? null;

  useEffect(() => {
    if (memberId && !eligible.some((m) => m.id === memberId)) setMemberId(null);
  }, [eligible, memberId]);

  const busy = useQuery({
    queryKey: ["booking-busy", slug, day],
    enabled: step === "time",
    queryFn: async (): Promise<Busy[]> => {
      const from = zonedToUtc(day, 0, tz).toISOString();
      const to = zonedToUtc(day, 24 * 60, tz).toISOString();
      const { data, error: rpcError } = await supabase.rpc("get_booking_busy", { p_slug: slug, p_from: from, p_to: to });
      if (rpcError) throw rpcError;
      return data ?? [];
    },
  });

  const slots = useMemo(
    () =>
      freeSlots({
        day,
        tz,
        hours: page.hours,
        busy: busy.data ?? [],
        memberIds: memberId ? [memberId] : eligible.map((m) => m.id),
        duration,
      }),
    [day, tz, page.hours, busy.data, memberId, eligible, duration],
  );

  const book = useMutation({
    mutationFn: async () => {
      const start = zonedToUtc(day, slot!, tz).toISOString();
      const { data, error: rpcError } = await supabase.rpc("create_booking", {
        p_slug: slug,
        p_items: chosen.map((service) => ({ service_id: service.id, team_member_id: memberId })),
        p_start: start,
        p_client: {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone,
        },
        p_notes: form.notes || null,
      });
      if (rpcError) throw rpcError;
      return data;
    },
    onSuccess: () => {
      setError(null);
      setStep("done");
    },
    onError: (rpcError: Error) => {
      const code = Object.keys(ERRORS).find((key) => rpcError.message.includes(key));
      setError(code ? ERRORS[code]! : "Something went wrong. Please try again.");
      if (code === "slot_taken" || code === "outside_hours" || code === "invalid_time") {
        setSlot(null);
        setStep("time");
        void busy.refetch();
      }
    },
  });

  const days = Array.from({ length: 21 }, (_, i) => localDay(tz, i));
  const dayLabel = (value: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));

  const canContinue =
    step === "services"
      ? chosen.length > 0
      : step === "professional"
        ? eligible.length > 0
        : step === "time"
          ? slot !== null
          : form.first_name.trim().length > 0 && (form.email.trim() || form.phone.trim()).length > 0;

  const next = () => {
    setError(null);
    if (step === "services") setStep("professional");
    else if (step === "professional") setStep("time");
    else if (step === "time") setStep("details");
    else if (step === "details") book.mutate();
  };
  const back = () => {
    setError(null);
    if (step === "professional") setStep("services");
    else if (step === "time") setStep("professional");
    else if (step === "details") setStep("time");
  };

  if (step === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-6">
        <div className="w-full max-w-md rounded-2xl bg-card p-8 text-center shadow-[inset_0_0_0_1px_var(--color-border)]">
          <CheckCircle size={56} weight="fill" className="mx-auto text-[#1f8a3e]" />
          <h1 className="mt-4 text-display font-semibold">Booking confirmed</h1>
          <p className="mt-2 text-body text-muted-foreground">
            {dayLabel(day, { weekday: "long", day: "numeric", month: "long" })} at {formatClock(slot ?? 0)} with{" "}
            {member ? member.first_name : "the first available professional"} at {business.name}.
          </p>
          <ul className="mt-6 space-y-2 text-left">
            {chosen.map((service) => (
              <li key={service.id} className="flex justify-between text-body">
                <span>{service.name}</span>
                <span className="text-muted-foreground">{formatDuration(service.duration)}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setSelected([]);
              setSlot(null);
              setStep("services");
            }}
            className={cn(pillButton, "mt-8 w-full border border-input bg-card hover:bg-secondary")}
          >
            Book another appointment
          </button>
        </div>
      </div>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const categories = page.categories.filter((c) => page.services.some((s) => s.category_id === c.id));
  const uncategorised = page.services.filter((s) => !s.category_id || !categories.some((c) => c.id === s.category_id));

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-border bg-white/95 px-4 backdrop-blur sm:px-8">
        {stepIndex > 0 ? (
          <button type="button" aria-label="Back" onClick={back} className="flex size-10 items-center justify-center rounded-full hover:bg-secondary">
            <ArrowLeft size={20} />
          </button>
        ) : null}
        <nav aria-label="Booking steps" className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto text-body">
          {STEPS.map((s, index) => (
            <span key={s.key} className="flex shrink-0 items-center gap-2">
              {index > 0 ? <span className="text-placeholder">›</span> : null}
              <span className={cn(index === stepIndex ? "font-semibold text-foreground" : "text-muted-foreground")}>{s.label}</span>
            </span>
          ))}
        </nav>
      </header>

      <div className="mx-auto grid w-full max-w-[1120px] gap-8 px-4 pb-32 pt-8 sm:px-8 lg:grid-cols-[1fr_380px] lg:pb-16">
        <main className="min-w-0">
          {step === "services" ? (
            <>
              <h1 className="text-[2rem] font-bold leading-10">Select services</h1>
              {categories.length > 1 ? (
                <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
                  <CategoryPill label="All" active={activeCategory === null} onClick={() => setActiveCategory(null)} />
                  {categories.map((c) => (
                    <CategoryPill key={c.id} label={c.name} active={activeCategory === c.id} onClick={() => setActiveCategory(c.id)} />
                  ))}
                </div>
              ) : null}
              <div className="mt-6 space-y-8">
                {[...categories.map((c) => ({ id: c.id, name: c.name })), ...(uncategorised.length ? [{ id: "", name: "Other services" }] : [])]
                  .filter((group) => activeCategory === null || group.id === activeCategory)
                  .map((group) => {
                    const services = group.id ? page.services.filter((s) => s.category_id === group.id) : uncategorised;
                    return (
                      <section key={group.id || "other"}>
                        <h2 className="text-title font-semibold">{group.name}</h2>
                        <ul className="mt-3 space-y-3">
                          {services.map((service) => {
                            const on = selected.includes(service.id);
                            return (
                              <li key={service.id}>
                                <button
                                  type="button"
                                  onClick={() => setSelected((ids) => (on ? ids.filter((id) => id !== service.id) : [...ids, service.id]))}
                                  className={cn(
                                    "flex w-full items-center gap-4 rounded-xl p-5 text-left transition-colors",
                                    on ? "bg-accent shadow-[inset_0_0_0_2px_var(--color-primary)]" : "shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-secondary",
                                  )}
                                >
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-heading font-medium">{service.name}</span>
                                    <span className="block text-body text-muted-foreground">{formatDuration(service.duration)}</span>
                                    {service.description ? (
                                      <span className="mt-1 block line-clamp-2 text-body text-muted-foreground">{service.description}</span>
                                    ) : null}
                                    <span className="mt-2 block text-body font-medium">{priceText(service, money)}</span>
                                  </span>
                                  <span
                                    className={cn(
                                      "flex size-9 shrink-0 items-center justify-center rounded-full",
                                      on ? "bg-primary text-primary-foreground" : "bg-secondary",
                                    )}
                                  >
                                    {on ? <Check size={18} weight="bold" /> : <Plus size={18} weight="bold" />}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    );
                  })}
                {page.services.length === 0 ? (
                  <p className="text-body text-muted-foreground">No services are available to book online yet.</p>
                ) : null}
              </div>
            </>
          ) : step === "professional" ? (
            <>
              <h1 className="text-[2rem] font-bold leading-10">Select professional</h1>
              {eligible.length === 0 ? (
                <p className="mt-6 text-body text-muted-foreground">
                  No single professional offers all of these services. Remove a service to continue.
                </p>
              ) : (
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <ProfessionalCard
                    active={memberId === null}
                    onClick={() => setMemberId(null)}
                    avatar={<UserCircle size={36} className="text-primary" />}
                    name="Any professional"
                    detail="For maximum availability"
                  />
                  {eligible.map((m) => (
                    <ProfessionalCard
                      key={m.id}
                      active={memberId === m.id}
                      onClick={() => setMemberId(m.id)}
                      avatar={
                        <span className="flex size-14 items-center justify-center rounded-full text-title font-semibold" style={{ backgroundColor: m.color }}>
                          {m.initials || m.first_name[0]}
                        </span>
                      }
                      name={[m.first_name, m.last_name].filter(Boolean).join(" ")}
                      detail={m.job_title ?? ""}
                    />
                  ))}
                </div>
              )}
            </>
          ) : step === "time" ? (
            <>
              <h1 className="text-[2rem] font-bold leading-10">Select time</h1>
              <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
                {days.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setDay(value);
                      setSlot(null);
                    }}
                    className={cn(
                      "flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl py-3 transition-colors",
                      value === day ? "bg-primary text-primary-foreground" : "shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-secondary",
                    )}
                  >
                    <span className="text-caption">{dayLabel(value, { weekday: "short" })}</span>
                    <span className="text-title font-semibold">{dayLabel(value, { day: "numeric" })}</span>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-heading font-semibold">{dayLabel(day, { weekday: "long", day: "numeric", month: "long" })}</p>
              {busy.isLoading ? (
                <p className="mt-4 text-body text-muted-foreground">Checking availability…</p>
              ) : slots.length === 0 ? (
                <div className="mt-4 rounded-xl p-6 text-center shadow-[inset_0_0_0_1px_var(--color-border)]">
                  <p className="text-heading font-semibold">No times available</p>
                  <p className="mt-1 text-body text-muted-foreground">Try another day{memberId ? " or choose Any professional" : ""}.</p>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((s) => (
                    <button
                      key={s.minutes}
                      type="button"
                      onClick={() => setSlot(s.minutes)}
                      className={cn(
                        "h-12 rounded-xl text-body font-medium transition-colors",
                        slot === s.minutes ? "bg-primary text-primary-foreground" : "shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-secondary",
                      )}
                    >
                      {formatClock(s.minutes)}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <h1 className="text-[2rem] font-bold leading-10">Your details</h1>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <TextField label="First name" required value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} autoComplete="given-name" />
                <TextField label="Last name" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} autoComplete="family-name" />
                <TextField label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} autoComplete="email" />
                <TextField label="Phone" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} autoComplete="tel" />
              </div>
              <p className="mt-2 text-caption text-muted-foreground">Add an email or phone number so the business can reach you.</p>
              <label className="mt-4 block text-body font-semibold">
                Booking notes <span className="font-normal text-muted-foreground">(optional)</span>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  className="mt-2 w-full resize-none rounded-[8px] border border-input p-4 text-body font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
            </>
          )}
          {error ? (
            <p role="alert" className="mt-6 rounded-xl bg-[#fdecef] px-4 py-3 text-body text-destructive">
              {error}
            </p>
          ) : null}
        </main>

        {/* Summary */}
        <aside className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white p-4 lg:sticky lg:top-24 lg:h-fit lg:rounded-xl lg:border-0 lg:p-6 lg:shadow-[inset_0_0_0_1px_var(--color-border)]">
          <div className="hidden lg:block">
            <p className="text-heading font-semibold">{business.name}</p>
            {business.location?.address ? (
              <p className="text-caption text-muted-foreground">
                {[business.location.address, business.location.city].filter(Boolean).join(", ")}
              </p>
            ) : null}
            {slot !== null && step !== "services" ? (
              <p className="mt-4 text-body">
                {dayLabel(day, { weekday: "long", day: "numeric", month: "long" })}, {formatClock(slot)}–{formatClock(slot + duration)}
              </p>
            ) : null}
            {step !== "services" ? (
              <p className="mt-1 text-body text-muted-foreground">{member ? `With ${member.first_name}` : "Any professional"}</p>
            ) : null}
            <ul className="mt-4 space-y-3 border-t border-border pt-4">
              {chosen.map((service) => (
                <li key={service.id} className="flex items-start gap-3 text-body">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{service.name}</span>
                    <span className="block text-muted-foreground">{formatDuration(service.duration)}</span>
                  </span>
                  <span>{priceText(service, money)}</span>
                  {step === "services" ? (
                    <button
                      type="button"
                      aria-label={`Remove ${service.name}`}
                      onClick={() => setSelected((ids) => ids.filter((id) => id !== service.id))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </li>
              ))}
              {chosen.length === 0 ? <li className="text-body text-muted-foreground">No services selected</li> : null}
            </ul>
          </div>
          <div className="flex items-center gap-4 lg:mt-4 lg:block lg:border-t lg:border-border lg:pt-4">
            <div className="min-w-0 flex-1 lg:mb-4 lg:flex lg:justify-between">
              <span className="block text-heading font-semibold">Total</span>
              <span className="block text-body lg:text-heading lg:font-semibold">
                {chosen.length ? `${hasFrom ? "from " : ""}${money(total)}` : "Free"}
              </span>
            </div>
            <button
              type="button"
              disabled={!canContinue || book.isPending}
              onClick={next}
              className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90 lg:w-full")}
            >
              {step === "details" ? (book.isPending ? "Booking…" : "Confirm booking") : "Continue"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function priceText(service: Page["services"][number], money: (n: number) => string) {
  if (service.pricing_type === "free") return "Free";
  if (service.pricing_type === "free-form") return "Price varies";
  if (service.pricing_type === "from") return `from ${money(Number(service.price ?? 0))}`;
  return money(Number(service.price ?? 0));
}

function CategoryPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 shrink-0 rounded-full px-4 text-body font-medium transition-colors",
        active ? "bg-ink text-ink-foreground" : "border border-input bg-card hover:bg-secondary",
      )}
    >
      {label}
    </button>
  );
}

function ProfessionalCard({
  active,
  onClick,
  avatar,
  name,
  detail,
}: {
  active: boolean;
  onClick: () => void;
  avatar: React.ReactNode;
  name: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl p-5 text-center transition-colors",
        active ? "bg-accent shadow-[inset_0_0_0_2px_var(--color-primary)]" : "shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-secondary",
      )}
    >
      <span className="flex size-14 items-center justify-center">{avatar}</span>
      <span className="text-heading font-medium">{name}</span>
      {detail ? <span className="text-caption text-muted-foreground">{detail}</span> : null}
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block text-body font-semibold">
      {label}
      {required ? <span className="text-destructive"> *</span> : null}
      <input
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        maxLength={type === "email" ? 254 : 100}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-[8px] border border-input px-4 text-body font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  );
}
