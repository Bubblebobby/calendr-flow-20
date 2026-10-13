import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarBlank,
  CaretDown,
  CaretRight,
  ClockCountdown,
  DotsThreeVertical,
  IdentificationCard,
  MagnifyingGlass,
  Plus,
  Tag,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { isMissingTable, MISSING_TABLE_MESSAGE } from "./blocked-time";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function DrawerShell({
  title,
  onClose,
  headerAction,
  footer,
  children,
}: {
  title: React.ReactNode;
  onClose: () => void;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-y-0 right-0 z-50 flex animate-in slide-in-from-right-8 duration-200">
      <div className="pr-4 pt-4">
        <button
          type="button"
          aria-label="Close drawer"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-secondary"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex h-full w-[30rem] max-w-[calc(100vw-4rem)] flex-col border-l border-border bg-card shadow-[-12px_0_32px_-12px_rgb(0_0_0/0.2)]">
        <div className="flex items-center justify-between gap-3 px-6 pb-3 pt-6">
          <h2 className="text-[1.75rem] font-bold tracking-tight">{title}</h2>
          {headerAction}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="border-t border-border px-6 py-5">{footer}</div> : null}
      </div>
    </div>
  );
}

const pill =
  "inline-flex h-12 items-center justify-center rounded-full px-6 text-[0.9375rem] font-semibold transition-colors disabled:opacity-50";

// ─── Visibility filters ────────────────────────────────────────────────────

export type CalendarFilters = { statuses: string[]; types: string[]; serviceIds: string[] };
export const EMPTY_FILTERS: CalendarFilters = { statuses: [], types: [], serviceIds: [] };

export function filtersActive(filters: CalendarFilters) {
  return filters.statuses.length + filters.types.length + filters.serviceIds.length > 0;
}

const FILTER_STATUSES = [
  ["booked", "Booked"],
  ["confirmed", "Confirmed"],
  ["arrived", "Arrived"],
  ["started", "Started"],
  ["completed", "Completed"],
  ["no_show", "No-show"],
] as const;

const FILTER_TYPES = [
  ["appointment", "Appointments"],
  ["blocked", "Blocked time"],
] as const;

function Section({
  icon,
  title,
  count,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/70">
      <button
        type="button"
        onClick={onToggle}
        className={cn("flex w-full items-center gap-3 px-6 py-4 text-left text-[0.9375rem]", open && "bg-secondary/60")}
      >
        {icon}
        <span className="flex-1 font-medium">{title}</span>
        {count ? <span className="rounded-full bg-primary px-2 text-[0.75rem] font-semibold text-primary-foreground">{count}</span> : null}
        <CaretDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="space-y-1 px-6 pb-4 pt-1">{children}</div> : null}
    </div>
  );
}

function CheckRow({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-2 text-[0.9375rem] hover:bg-secondary/60">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-5 accent-[var(--color-primary)]" />
      {label}
    </label>
  );
}

export function FiltersDrawer({
  open,
  value,
  services,
  onApply,
  onClose,
}: {
  open: boolean;
  value: CalendarFilters;
  services: Array<{ id: string; name: string }>;
  onApply: (filters: CalendarFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [section, setSection] = useState<string | null>("status");
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);
  if (!open) return null;

  const toggle = (key: keyof CalendarFilters, item: string) =>
    setDraft((current) => ({
      ...current,
      [key]: current[key].includes(item) ? current[key].filter((entry) => entry !== item) : [...current[key], item],
    }));

  return (
    <DrawerShell
      title="All filters"
      onClose={onClose}
      headerAction={
        <button
          type="button"
          onClick={() => toast("Saved filters arrive with the next database update")}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-[0.875rem] font-medium hover:bg-secondary"
        >
          Saved filters <CaretDown size={12} weight="bold" />
        </button>
      }
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            aria-label="More options"
            onClick={() => toast("Saving a filter set arrives with the next database update")}
            className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border hover:bg-secondary"
          >
            <DotsThreeVertical size={20} weight="bold" />
          </button>
          <button type="button" onClick={() => setDraft(EMPTY_FILTERS)} className={cn(pill, "flex-1 border border-border hover:bg-secondary")}>
            Clear filters
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className={cn(pill, "flex-1 bg-ink text-ink-foreground hover:bg-ink/90")}
          >
            Apply
          </button>
        </div>
      }
    >
      <Section
        icon={<CalendarBlank size={20} />}
        title="Appointment status"
        count={draft.statuses.length}
        open={section === "status"}
        onToggle={() => setSection(section === "status" ? null : "status")}
      >
        {FILTER_STATUSES.map(([key, label]) => (
          <CheckRow key={key} checked={draft.statuses.includes(key)} label={label} onChange={() => toggle("statuses", key)} />
        ))}
      </Section>
      <Section
        icon={<IdentificationCard size={20} />}
        title="Type"
        count={draft.types.length}
        open={section === "type"}
        onToggle={() => setSection(section === "type" ? null : "type")}
      >
        {FILTER_TYPES.map(([key, label]) => (
          <CheckRow key={key} checked={draft.types.includes(key)} label={label} onChange={() => toggle("types", key)} />
        ))}
      </Section>
      <Section
        icon={<Tag size={20} />}
        title="Services"
        count={draft.serviceIds.length}
        open={section === "services"}
        onToggle={() => setSection(section === "services" ? null : "services")}
      >
        {services.length ? (
          services.map((service) => (
            <CheckRow
              key={service.id}
              checked={draft.serviceIds.includes(service.id)}
              label={service.name}
              onChange={() => toggle("serviceIds", service.id)}
            />
          ))
        ) : (
          <p className="py-2 text-sm text-muted-foreground">No services yet.</p>
        )}
      </Section>
      {["Channel", "Payment status", "Appointment creation date", "Requested team member", "Client segments"].map((label) => (
        <button
          key={label}
          type="button"
          onClick={() => toast(`${label} filtering arrives with the tab that records it`)}
          className="flex w-full items-center gap-3 border-b border-border/70 px-6 py-4 text-left text-[0.9375rem] text-muted-foreground"
        >
          <span className="size-5" />
          <span className="flex-1">{label}</span>
          <CaretDown size={14} />
        </button>
      ))}
    </DrawerShell>
  );
}

// ─── Calendar settings ─────────────────────────────────────────────────────

export const ZOOM_LEVELS = [
  { label: "Small", slot: 16 },
  { label: "Medium small", slot: 24 },
  { label: "Medium", slot: 32 },
  { label: "Large", slot: 40 },
] as const;

export type CalendarPrefs = { zoom: number; quickActions: boolean };
export const DEFAULT_PREFS: CalendarPrefs = { zoom: 1, quickActions: true };
const PREFS_KEY = "bookly.calendar.prefs";

export function loadPrefs(): CalendarPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: CalendarPrefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Private mode — preferences just won't persist.
  }
}

export function SettingsDrawer({
  open,
  value,
  onApply,
  onClose,
}: {
  open: boolean;
  value: CalendarPrefs;
  onApply: (prefs: CalendarPrefs) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);
  if (!open) return null;
  return (
    <DrawerShell
      title="Your calendar settings"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={() => {
            onApply(draft);
            onClose();
          }}
          className={cn(pill, "w-full bg-ink text-ink-foreground hover:bg-ink/90")}
        >
          Apply changes
        </button>
      }
    >
      <div className="px-6 py-4">
        <div className="flex items-center justify-between text-[0.9375rem]">
          <span className="font-semibold">Calendar zoom</span>
          <span>{ZOOM_LEVELS[draft.zoom]?.label}</span>
        </div>
        <input
          type="range"
          min={0}
          max={ZOOM_LEVELS.length - 1}
          step={1}
          value={draft.zoom}
          onChange={(event) => setDraft({ ...draft, zoom: Number(event.target.value) })}
          className="mt-4 w-full accent-[var(--color-primary)]"
          aria-label="Calendar zoom"
        />
        <div className="my-6 h-px bg-border" />
        <label className="flex cursor-pointer items-start justify-between gap-6">
          <span>
            <span className="block text-[0.9375rem]">Show quick actions on calendar</span>
            <span className="block text-[0.8125rem] text-muted-foreground">
              Quickly add appointments or blocked time by clicking on a calendar slot
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={draft.quickActions}
            onClick={() => setDraft({ ...draft, quickActions: !draft.quickActions })}
            className={cn(
              "relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors",
              draft.quickActions ? "bg-primary" : "bg-muted-foreground/30",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                draft.quickActions ? "translate-x-[1.375rem]" : "translate-x-0.5",
              )}
            />
          </button>
        </label>
      </div>
    </DrawerShell>
  );
}

// ─── Waitlist ──────────────────────────────────────────────────────────────

type WaitlistEntry = {
  id: string;
  status: string;
  preferred_date: string | null;
  preferred_time: string | null;
  created_at: string;
  clients: { first_name: string; last_name: string | null } | null;
  services: { name: string } | null;
};

type ClientOption = { id: string; first_name: string; last_name: string | null; email: string | null };

export function WaitlistDrawer({
  open,
  businessId,
  services,
  currentUserId,
  onClose,
}: {
  open: boolean;
  businessId: string | undefined;
  services: Array<{ id: string; name: string; duration_minutes: number; price: number | null }>;
  currentUserId: string | null | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"waiting" | "expired" | "booked">("waiting");
  const [step, setStep] = useState<null | "client" | "time" | "service">(null);
  const [clientQuery, setClientQuery] = useState("");
  const [picked, setPicked] = useState<{ client: ClientOption | null; date: string; time: string; serviceId: string }>({
    client: null,
    date: "",
    time: "any",
    serviceId: "",
  });

  useEffect(() => {
    if (!open) setStep(null);
  }, [open]);

  const entries = useQuery({
    queryKey: ["waitlist", businessId],
    enabled: Boolean(open && businessId),
    retry: false,
    queryFn: async (): Promise<{ rows: WaitlistEntry[]; missing: boolean }> => {
      const { data, error } = await db
        .from("waitlist_entries")
        .select("id, status, preferred_date, preferred_time, created_at, clients(first_name, last_name), services(name)")
        .eq("business_id", businessId)
        .order("created_at", { ascending: true });
      if (isMissingTable(error)) return { rows: [], missing: true };
      if (error) throw error;
      return { rows: (data ?? []) as WaitlistEntry[], missing: false };
    },
  });

  const clients = useQuery({
    queryKey: ["booking-clients-lite", businessId],
    enabled: Boolean(step === "client" && businessId),
    queryFn: async (): Promise<ClientOption[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email")
        .eq("business_id", businessId!)
        .order("first_name")
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ClientOption[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("waitlist_entries").insert({
        business_id: businessId,
        client_id: picked.client?.id ?? null,
        service_id: picked.serviceId || null,
        preferred_date: picked.date || null,
        preferred_time: picked.time === "any" ? null : picked.time,
        status: "waiting",
        created_by: currentUserId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist", businessId] });
      toast.success("Added to waitlist");
      setStep(null);
    },
    onError: (error: { code?: string; message?: string }) =>
      toast.error(isMissingTable(error) ? MISSING_TABLE_MESSAGE : (error.message ?? "Could not add to the waitlist")),
  });

  if (!open) return null;

  const rows = entries.data?.rows ?? [];
  const counts = {
    waiting: rows.filter((row) => row.status === "waiting").length,
    expired: rows.filter((row) => row.status === "expired").length,
    booked: rows.filter((row) => row.status === "booked").length,
  };
  const visible = rows.filter((row) => row.status === tab);

  if (step) {
    const steps = [
      ["client", "Client"],
      ["time", "Date and time"],
      ["service", "Service"],
    ] as const;
    const term = clientQuery.trim().toLowerCase();
    return (
      <DrawerShell
        title={step === "client" ? "Select a client" : step === "time" ? "Select date and time" : "Select a service"}
        onClose={() => setStep(null)}
        footer={
          step === "time" ? (
            <button type="button" onClick={() => setStep("service")} className={cn(pill, "w-full bg-ink text-ink-foreground")}>
              Next
            </button>
          ) : step === "service" ? (
            <button
              type="button"
              disabled={!picked.serviceId || add.isPending}
              onClick={() => add.mutate()}
              className={cn(pill, "w-full bg-ink text-ink-foreground")}
            >
              {add.isPending ? "Saving…" : "Add to waitlist"}
            </button>
          ) : undefined
        }
      >
        <div className="flex items-center gap-2 px-6 pb-4 text-[0.875rem]">
          {steps.map(([key, label], index) => (
            <span key={key} className="flex items-center gap-2">
              {index ? <CaretRight size={12} className="text-muted-foreground" /> : null}
              <span className={step === key ? "font-semibold" : "text-muted-foreground"}>{label}</span>
            </span>
          ))}
        </div>
        {step === "client" ? (
          <div className="px-6">
            <label className="flex h-12 items-center gap-3 rounded-lg border-2 border-primary/70 px-4">
              <MagnifyingGlass size={18} />
              <input
                autoFocus
                value={clientQuery}
                onChange={(event) => setClientQuery(event.target.value)}
                placeholder="Search client or leave empty for walk-in"
                className="h-full flex-1 bg-transparent outline-none"
              />
            </label>
            <div className="mt-3 space-y-1">
              <button
                type="button"
                onClick={() => {
                  setPicked({ ...picked, client: null });
                  setStep("time");
                }}
                className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left hover:bg-secondary"
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-[#ebe8ff] text-primary">
                  <Plus size={20} />
                </span>
                <span className="text-[0.9375rem] font-semibold">Walk-In</span>
              </button>
              {(clients.data ?? [])
                .filter((client) => !term || `${client.first_name} ${client.last_name ?? ""} ${client.email ?? ""}`.toLowerCase().includes(term))
                .map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => {
                      setPicked({ ...picked, client });
                      setStep("time");
                    }}
                    className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left hover:bg-secondary"
                  >
                    <span className="flex size-12 items-center justify-center rounded-full bg-[#ebe8ff] font-semibold text-primary">
                      {client.first_name[0]}
                    </span>
                    <span>
                      <span className="block text-[0.9375rem] font-semibold">
                        {client.first_name} {client.last_name}
                      </span>
                      <span className="block text-[0.8125rem] text-muted-foreground">{client.email}</span>
                    </span>
                  </button>
                ))}
            </div>
          </div>
        ) : step === "time" ? (
          <div className="grid grid-cols-2 gap-4 px-6">
            <label>
              <span className="mb-2 block text-[0.9375rem] font-semibold">Date</span>
              <input
                type="date"
                value={picked.date}
                onChange={(event) => setPicked({ ...picked, date: event.target.value })}
                className="h-12 w-full rounded-lg border border-border px-4"
              />
            </label>
            <label>
              <span className="mb-2 block text-[0.9375rem] font-semibold">Start time</span>
              <select
                value={picked.time}
                onChange={(event) => setPicked({ ...picked, time: event.target.value })}
                className="h-12 w-full rounded-lg border border-border bg-card px-4"
              >
                <option value="any">Any time</option>
                {["morning", "afternoon", "evening"].map((part) => (
                  <option key={part} value={part}>
                    {part[0]!.toUpperCase() + part.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className="space-y-2 px-6">
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => setPicked({ ...picked, serviceId: service.id })}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border py-3 pl-4 pr-3 text-left",
                  picked.serviceId === service.id ? "border-primary ring-1 ring-primary" : "border-border hover:bg-secondary",
                )}
              >
                <span className="text-[0.9375rem] font-medium">{service.name}</span>
                <span className="text-[0.8125rem] text-muted-foreground">{service.duration_minutes} min</span>
              </button>
            ))}
          </div>
        )}
      </DrawerShell>
    );
  }

  return (
    <DrawerShell
      title="Waitlist"
      onClose={onClose}
      headerAction={
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="More options"
            onClick={() => toast("Waitlist settings live in Settings → Scheduling")}
            className="flex size-10 items-center justify-center rounded-full border border-border hover:bg-secondary"
          >
            <DotsThreeVertical size={18} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (entries.data?.missing) {
                toast.error(MISSING_TABLE_MESSAGE);
                return;
              }
              setPicked({ client: null, date: "", time: "any", serviceId: "" });
              setStep("client");
            }}
            className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-[0.875rem] font-semibold text-ink-foreground"
          >
            Add
          </button>
        </div>
      }
    >
      <div className="flex items-center justify-between gap-3 px-6 pb-4">
        <button type="button" className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-[0.875rem]">
          All upcoming <CaretDown size={12} />
        </button>
        <button type="button" className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-[0.875rem]">
          Created (oldest first)
        </button>
      </div>
      <div className="flex gap-6 border-b border-border px-6">
        {(["waiting", "expired", "booked"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "-mb-px border-b-2 pb-3 text-[0.9375rem] capitalize",
              tab === key ? "border-foreground font-semibold" : "border-transparent text-muted-foreground",
            )}
          >
            {key} <span className="ml-1 rounded-full bg-muted px-1.5 text-[0.75rem]">{counts[key]}</span>
          </button>
        ))}
      </div>
      {entries.data?.missing ? (
        <div className="m-6 rounded-xl bg-[#fff6e5] p-4 text-[0.875rem] text-[#7a4b00]">{MISSING_TABLE_MESSAGE}</div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-20 text-center">
          <ClockCountdown size={40} className="text-primary" />
          <p className="mt-4 text-[1.0625rem] font-semibold">No waitlist entries</p>
          <p className="mt-1 text-[0.875rem] text-muted-foreground">You don&apos;t have any clients on the waitlist</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {visible.map((entry) => (
            <div key={entry.id} className="px-6 py-4">
              <p className="text-[0.9375rem] font-semibold">
                {entry.clients ? `${entry.clients.first_name} ${entry.clients.last_name ?? ""}` : "Walk-In"}
              </p>
              <p className="text-[0.8125rem] text-muted-foreground">
                {entry.services?.name ?? "Any service"} · {entry.preferred_date ?? "Any date"} · {entry.preferred_time ?? "Any time"}
              </p>
            </div>
          ))}
        </div>
      )}
    </DrawerShell>
  );
}
