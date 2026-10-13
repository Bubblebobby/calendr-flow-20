import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowsInSimple,
  CaretDown,
  CaretRight,
  Check,
  ClockCounterClockwise,
  Crosshair,
  DotsThreeVertical,
  Heart,
  MagnifyingGlass,
  NotePencil,
  PencilSimple,
  Plus,
  Trash,
  UserPlus,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { CurrentBusiness } from "@/lib/use-business";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ClientForm } from "@/components/clients/client-form";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CheckoutStart } from "@/components/sales/checkout-screen";
import { formatTime, memberName, minutesOfDay, startOfDay, type TeamMember } from "./calendar-data";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PanelTarget =
  | {
      kind: "new";
      member: TeamMember;
      date: Date;
      minutes: number;
      /** Rebook: start with this client and these services. */
      prefill?: { clientId: string | null; serviceIds: string[] };
    }
  | {
      kind: "existing";
      appointmentId: string;
      /** Reschedule: open with the appointment moved here (unsaved until Save). */
      moveTo?: { member: TeamMember; date: Date; minutes: number };
    };

export type RebookRequest = { clientId: string | null; serviceIds: string[]; label: string };

type ClientRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  created_at?: string;
};

type ServiceRow = {
  id: string;
  name: string;
  price: number | null;
  duration_minutes: number;
  category_id: string | null;
};

type CategoryRow = { id: string; name: string; color?: string | null };

type Line = {
  key: string;
  serviceId: string;
  teamMemberId: string;
  start: number; // minutes since midnight
  duration: number;
  price: number;
  appointmentItemId?: string;
};

type ExistingRow = {
  id: string;
  status: string;
  notes: string | null;
  is_walk_in: boolean;
  client_id: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  clients: ClientRow | null;
  appointment_items: Array<{
    id: string;
    service_id: string;
    team_member_id: string;
    start_time: string;
    end_time: string;
    price: number | null;
  }>;
};

type View =
  | { name: "main" }
  | { name: "services"; replaceKey?: string }
  | { name: "edit"; key: string }
  | { name: "activity" }
  | { name: "repeat" };

// ─── Constants ──────────────────────────────────────────────────────────────

export const STATUS_OPTIONS = [
  { value: "booked", label: "Booked" },
  { value: "confirmed", label: "Confirmed" },
  { value: "arrived", label: "Arrived" },
  { value: "started", label: "Started" },
] as const;

const STATUS_HEADER: Record<string, string> = {
  booked: "bg-[#2d76ec]",
  confirmed: "bg-[#2d76ec]",
  arrived: "bg-[#c77700]",
  started: "bg-[#1f8a3e]",
  completed: "bg-[#5b5b5b]",
  no_show: "bg-[#d92d20]",
  cancelled: "bg-[#d92d20]",
};

const STATUS_LABEL: Record<string, string> = {
  booked: "Booked",
  confirmed: "Confirmed",
  arrived: "Arrived",
  started: "Started",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
};

const CANCEL_REASONS = [
  "No reason provided",
  "Duplicate appointment",
  "Appointment made by mistake",
  "Client not available",
];

const TIME_OPTIONS = Array.from({ length: 288 }, (_, index) => index * 5);
const DURATION_OPTIONS = [
  ...Array.from({ length: 23 }, (_, index) => (index + 1) * 5), // 5 … 115 min
  120,
  135,
  150,
  165,
  180,
  195,
  210,
  225,
  240,
  270,
  300,
  330,
  360,
  390,
  420,
  450,
  480,
  540,
  600,
  660,
  720,
];

function durationLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function personName(person: { first_name: string; last_name?: string | null }) {
  return [person.first_name, person.last_name].filter(Boolean).join(" ");
}

function toISO(date: Date, minutes: number) {
  const value = startOfDay(date);
  value.setMinutes(minutes);
  return value.toISOString();
}

let keySeed = 0;
const nextKey = () => `line-${Date.now()}-${keySeed++}`;

// ─── Small building blocks ─────────────────────────────────────────────────

const pill =
  "inline-flex h-11 items-center justify-center rounded-full px-6 text-[0.9375rem] font-semibold transition-colors disabled:opacity-50";

function Avatar({ name, size = 72 }: { name: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-[#ebe8ff] font-semibold text-primary"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.3) }}
    >
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

function ConfirmModal({
  open,
  title,
  body,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-[30rem] rounded-2xl p-9 [&>button]:right-8 [&>button]:top-8">
        <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
        <DialogDescription className="mt-3 text-[0.9375rem] leading-6 text-foreground">
          {body}
        </DialogDescription>
        <div className="mt-14 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={cn(pill, "border border-border bg-card hover:bg-secondary")}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(pill, "bg-ink text-ink-foreground hover:bg-ink/90")}
          >
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="px-6 pb-4 pt-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-[0.875rem] font-medium hover:bg-secondary"
      >
        <ArrowLeft size={14} weight="bold" /> Back
      </button>
      <h2 className="mt-4 text-[1.75rem] font-bold leading-9 tracking-tight">{title}</h2>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-2 block text-[0.9375rem] font-semibold">{children}</span>;
}

const fieldClass =
  "h-12 w-full rounded-lg border border-border bg-card px-4 text-[0.9375rem] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:text-muted-foreground";

// ─── Panel ──────────────────────────────────────────────────────────────────

export function AppointmentPanel({
  target,
  business,
  team,
  currentUserId,
  minimized,
  onClose,
  onMinimize,
  onFocusDate,
  onReschedule,
  onRebook,
  onCheckout,
}: {
  target: PanelTarget | null;
  business: CurrentBusiness | null | undefined;
  team: TeamMember[];
  currentUserId: string | null | undefined;
  minimized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onFocusDate: (date: Date) => void;
  onReschedule: (appointmentId: string, itemIds: string[]) => void;
  onRebook: (request: RebookRequest) => void;
  /** Opens the shared full-width checkout (Sales) for this appointment. */
  onCheckout: (start: CheckoutStart) => void;
}) {
  const queryClient = useQueryClient();
  const businessId = business?.id;
  const currency = business?.currency ?? "NGN";
  const money = (value: number) => formatMoney(value, currency, business?.country ?? "");
  const isNew = target?.kind === "new";
  const appointmentId = target?.kind === "existing" ? target.appointmentId : null;

  // ── Data ──
  const { data: services = [] } = useQuery({
    queryKey: ["booking-services", businessId],
    enabled: Boolean(businessId && target),
    queryFn: async (): Promise<ServiceRow[]> => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, price, duration_minutes, category_id")
        .eq("business_id", businessId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ServiceRow[];
    },
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["booking-categories", businessId],
    enabled: Boolean(businessId && target),
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase
        .from("service_categories")
        .select("id, name, color")
        .eq("business_id", businessId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["booking-clients", businessId],
    enabled: Boolean(businessId && target),
    queryFn: async (): Promise<ClientRow[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, phone, created_at")
        .eq("business_id", businessId!)
        .order("first_name", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });
  const { data: existing } = useQuery({
    queryKey: ["appointment-detail", appointmentId],
    enabled: Boolean(appointmentId),
    queryFn: async (): Promise<ExistingRow> => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, status, notes, is_walk_in, client_id, created_at, created_by, updated_at, clients(id, first_name, last_name, email, phone, created_at), appointment_items(id, service_id, team_member_id, start_time, end_time, price)",
        )
        .eq("id", appointmentId!)
        .single();
      if (error) throw error;
      return data as unknown as ExistingRow;
    },
  });

  const serviceById = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services],
  );
  const memberById = useMemo(() => new Map(team.map((member) => [member.id, member])), [team]);
  const categoryColor = (serviceId: string) => {
    const categoryId = serviceById.get(serviceId)?.category_id;
    return categories.find((category) => category.id === categoryId)?.color || "#a5d8f3";
  };

  // ── Draft state ──
  const [client, setClient] = useState<ClientRow | null>(null);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientQuery, setClientQuery] = useState("");
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [date, setDate] = useState(() => startOfDay(new Date()));
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState<View>({ name: "main" });
  const [serviceQuery, setServiceQuery] = useState("");
  const [toPayOpen, setToPayOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Line | null>(null);

  const targetKey =
    target?.kind === "new"
      ? `new-${target.member.id}-${target.date.toDateString()}-${target.minutes}`
      : target?.kind === "existing"
        ? `existing-${target.appointmentId}-${target.moveTo ? `${target.moveTo.member.id}-${target.moveTo.date.toDateString()}-${target.moveTo.minutes}` : ""}`
        : "none";

  // Reset whenever a different appointment/slot is opened.
  useEffect(() => {
    setClientPickerOpen(false);
    setClientQuery("");
    setView({ name: "main" });
    setServiceQuery("");
    setToPayOpen(false);
    setConflict(null);
    if (target?.kind === "new") {
      setDate(startOfDay(target.date));
      setNotes("");
      setDirty(false);
      const prefilled = (target.prefill?.serviceIds ?? [])
        .map((id) => serviceById.get(id))
        .filter((service): service is ServiceRow => Boolean(service));
      let cursor = target.minutes;
      setLines(
        prefilled.map((service) => {
          const line = {
            key: nextKey(),
            serviceId: service.id,
            teamMemberId: target.member.id,
            start: cursor,
            duration: service.duration_minutes,
            price: Number(service.price ?? 0),
          };
          cursor += service.duration_minutes;
          return line;
        }),
      );
      setClient(
        target.prefill?.clientId
          ? (clients.find((row) => row.id === target.prefill!.clientId) ?? null)
          : null,
      );
      if (prefilled.length) setDirty(true);
    }
    // Existing appointments are initialised from the query below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  // Rebook prefill may arrive before services/clients load.
  useEffect(() => {
    if (target?.kind !== "new" || !target.prefill || lines.length || !services.length) return;
    let cursor = target.minutes;
    const prefilled = target.prefill.serviceIds
      .map((id) => serviceById.get(id))
      .filter((service): service is ServiceRow => Boolean(service));
    if (!prefilled.length) return;
    setLines(
      prefilled.map((service) => {
        const line = {
          key: nextKey(),
          serviceId: service.id,
          teamMemberId: target.member.id,
          start: cursor,
          duration: service.duration_minutes,
          price: Number(service.price ?? 0),
        };
        cursor += service.duration_minutes;
        return line;
      }),
    );
    if (target.prefill.clientId)
      setClient(clients.find((row) => row.id === target.prefill!.clientId) ?? null);
    setDirty(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services.length, clients.length, targetKey]);

  useEffect(() => {
    if (target?.kind !== "existing" || !existing || existing.id !== target.appointmentId) return;
    const items = [...existing.appointment_items].sort((a, b) =>
      a.start_time.localeCompare(b.start_time),
    );
    const first = items[0];
    const baseDate = first ? startOfDay(new Date(first.start_time)) : startOfDay(new Date());
    let next: Line[] = items.map((item) => ({
      key: item.id,
      appointmentItemId: item.id,
      serviceId: item.service_id,
      teamMemberId: item.team_member_id,
      start: minutesOfDay(new Date(item.start_time)),
      duration: Math.round(
        (new Date(item.end_time).getTime() - new Date(item.start_time).getTime()) / 60000,
      ),
      price: Number(item.price ?? 0),
    }));
    let nextDate = baseDate;
    let moved = false;
    if (target.moveTo && next.length) {
      const offset = target.moveTo.minutes - next[0]!.start;
      const fromMember = next[0]!.teamMemberId;
      next = next.map((line) => ({
        ...line,
        start: line.start + offset,
        teamMemberId:
          line.teamMemberId === fromMember ? target.moveTo!.member.id : line.teamMemberId,
      }));
      nextDate = startOfDay(target.moveTo.date);
      moved = true;
    }
    setLines(next);
    setDate(nextDate);
    setNotes(existing.notes ?? "");
    setClient(existing.is_walk_in ? null : existing.clients);
    setDirty(moved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, existing?.updated_at, targetKey]);

  // ── Derived ──
  const status = existing?.status ?? "booked";
  const total = lines.reduce((sum, line) => sum + line.price, 0);
  const firstStart = lines.length
    ? Math.min(...lines.map((line) => line.start))
    : target?.kind === "new"
      ? target.minutes
      : 0;
  const isLocked = status === "completed" || status === "cancelled";
  const clientLabel = client ? personName(client) : "Walk-In";

  const visibleClients = useMemo(() => {
    const term = clientQuery.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((row) =>
      [personName(row), row.email, row.phone]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  }, [clients, clientQuery]);

  const groupedServices = useMemo(() => {
    const term = serviceQuery.trim().toLowerCase();
    const visible = services.filter((service) =>
      term ? service.name.toLowerCase().includes(term) : true,
    );
    const buckets: Array<{ id: string; name: string; items: ServiceRow[] }> = [];
    for (const category of categories) {
      const items = visible.filter((service) => service.category_id === category.id);
      if (items.length) buckets.push({ id: category.id, name: category.name, items });
    }
    const other = visible.filter(
      (service) =>
        !service.category_id || !categories.some((category) => category.id === service.category_id),
    );
    if (other.length) buckets.push({ id: "other", name: "Other services", items: other });
    return buckets;
  }, [services, categories, serviceQuery]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
    queryClient.invalidateQueries({ queryKey: ["appointment-detail", appointmentId] });
    queryClient.invalidateQueries({ queryKey: ["home-dashboard"] });
  }

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setDirty(true);
    };
  }

  function addService(service: ServiceRow, replaceKey?: string) {
    const defaultMember =
      target?.kind === "new" ? target.member.id : (lines[0]?.teamMemberId ?? team[0]?.id ?? "");
    setLines((current) => {
      if (replaceKey) {
        return current.map((line) =>
          line.key === replaceKey
            ? {
                ...line,
                serviceId: service.id,
                duration: service.duration_minutes,
                price: Number(service.price ?? 0),
              }
            : line,
        );
      }
      const start = current.length
        ? Math.max(...current.map((line) => line.start + line.duration))
        : target?.kind === "new"
          ? target.minutes
          : firstStart;
      return [
        ...current,
        {
          key: nextKey(),
          serviceId: service.id,
          teamMemberId: current[current.length - 1]?.teamMemberId ?? defaultMember,
          start,
          duration: service.duration_minutes,
          price: Number(service.price ?? 0),
        },
      ];
    });
    setDirty(true);
    setServiceQuery("");
    setView(replaceKey ? { name: "edit", key: replaceKey } : { name: "main" });
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
    setDirty(true);
    setView({ name: "main" });
  }

  // ── Mutations ──
  const save = useMutation({
    mutationFn: async (): Promise<string> => {
      if (!businessId || !target) throw new Error("Missing business");
      if (!lines.length) throw new Error("Add at least one service");
      const items = [...lines]
        .sort((a, b) => a.start - b.start)
        .map((line, index) => ({
          business_id: businessId,
          service_id: line.serviceId,
          team_member_id: line.teamMemberId,
          start_time: toISO(date, line.start),
          end_time: toISO(date, line.start + line.duration),
          price: line.price,
          sort_order: index,
        }));

      if (target.kind === "new") {
        const { data: created, error } = await supabase
          .from("appointments")
          .insert({
            business_id: businessId,
            client_id: client?.id ?? null,
            is_walk_in: !client,
            status: "booked",
            notes: notes.trim() || null,
            created_by: currentUserId ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        const { error: itemsError } = await supabase
          .from("appointment_items")
          .insert(items.map((item) => ({ ...item, appointment_id: created.id })));
        if (itemsError) {
          await supabase.from("appointments").delete().eq("id", created.id);
          throw itemsError;
        }
        return created.id;
      }

      // Existing: update the header, then swap the services in one go.
      const id = target.appointmentId;
      const { error: headerError } = await supabase
        .from("appointments")
        .update({ client_id: client?.id ?? null, is_walk_in: !client, notes: notes.trim() || null })
        .eq("id", id);
      if (headerError) throw headerError;
      const previous = existing?.appointment_items ?? [];
      const { error: deleteError } = await supabase
        .from("appointment_items")
        .delete()
        .eq("appointment_id", id);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabase
        .from("appointment_items")
        .insert(items.map((item) => ({ ...item, appointment_id: id })));
      if (insertError) {
        // Put the original services back so a rejected edit changes nothing.
        if (previous.length) {
          await supabase.from("appointment_items").insert(
            previous.map((item, index) => ({
              appointment_id: id,
              business_id: businessId,
              service_id: item.service_id,
              team_member_id: item.team_member_id,
              start_time: item.start_time,
              end_time: item.end_time,
              price: item.price,
              sort_order: index,
            })),
          );
        }
        throw insertError;
      }
      return id;
    },
    onError: (error: unknown) => {
      const err = error as { code?: string; message?: string };
      if (err.code === "23P01" || /exclusion|overlap/i.test(err.message ?? "")) {
        setConflict(
          "This team member is already booked at that time. Pick another time or team member.",
        );
        toast.error("Time not available");
        return;
      }
      toast.error(err.message ?? "Could not save the appointment");
    },
  });

  const setStatus = useMutation({
    mutationFn: async (next: string) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: next })
        .eq("id", appointmentId!);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      refresh();
      toast.success(
        `Appointment ${next === "cancelled" ? "cancelled" : `marked as ${STATUS_LABEL[next]?.toLowerCase()}`}`,
      );
    },
    onError: (error: unknown) =>
      toast.error((error as Error).message ?? "Could not update the status"),
  });

  const saveNote = useMutation({
    mutationFn: async (value: string) => {
      if (!appointmentId) return;
      const { error } = await supabase
        .from("appointments")
        .update({ notes: value.trim() || null })
        .eq("id", appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Note saved");
    },
    onError: (error: unknown) => toast.error((error as Error).message),
  });

  // Like Fresha: save first if needed, then hand over to the full-width checkout at the Tip step.
  async function handleCheckout() {
    try {
      let id = appointmentId;
      if (!id || dirty) {
        id = await save.mutateAsync();
        refresh();
        setDirty(false);
      }
      const { data, error } = await supabase
        .from("appointment_items")
        .select("id, service_id, team_member_id, price, start_time, end_time")
        .eq("appointment_id", id!)
        .order("start_time", { ascending: true });
      if (error) throw error;
      onCheckout({
        appointmentId: id,
        clientId: client?.id ?? null,
        step: "tip",
        lines: (data ?? []).map((item) => ({
          key: item.id,
          serviceId: item.service_id,
          description: (item.service_id && serviceById.get(item.service_id)?.name) || "Service",
          price: Number(item.price ?? 0),
          quantity: 1,
          durationMinutes: Math.round(
            (new Date(item.end_time).getTime() - new Date(item.start_time).getTime()) / 60000,
          ),
          teamMemberId: item.team_member_id,
          appointmentItemId: item.id,
        })),
      });
    } catch {
      // save's onError already explained the problem
    }
  }

  // ── Close handling ──
  function requestClose() {
    if (dirty && !isLocked) setConfirmExit(true);
    else onClose();
  }

  function handleSave() {
    save.mutate(undefined, {
      onSuccess: () => {
        refresh();
        toast.success(isNew ? "Appointment booked" : "Appointment saved");
        setDirty(false);
        onClose();
      },
    });
  }

  if (!target || minimized) return null;

  const showClientColumnWide = clientPickerOpen;
  const timeLine = `${formatTime(firstStart)} · Doesn't repeat`;
  const dateTitle = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);

  // ── Right column views ──
  let right: React.ReactNode;
  if (view.name === "services" || (isNew && lines.length === 0 && view.name === "main")) {
    const replaceKey = view.name === "services" ? view.replaceKey : undefined;
    right = (
      <div className="flex min-h-0 flex-1 flex-col">
        {view.name === "services" ? (
          <BackHeader
            title="Select a service"
            onBack={() =>
              setView(replaceKey ? { name: "edit", key: replaceKey } : { name: "main" })
            }
          />
        ) : (
          <div className="px-6 pb-4 pt-6">
            <h2 className="text-[1.75rem] font-bold leading-9 tracking-tight">Select a service</h2>
          </div>
        )}
        <div className="px-6 pb-4">
          <label className="flex h-12 items-center gap-3 rounded-lg border-2 border-primary/70 px-4">
            <MagnifyingGlass size={18} />
            <input
              autoFocus
              value={serviceQuery}
              onChange={(event) => setServiceQuery(event.target.value)}
              placeholder="Search by service name"
              className="h-full flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border/70 px-6 pb-6">
          {groupedServices.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No services match your search.
            </p>
          ) : (
            groupedServices.map((group) => (
              <div key={group.id} className="pt-6">
                <p className="mb-3 flex items-center gap-2 text-[1.0625rem] font-semibold">
                  {group.name}
                  <span className="rounded-full bg-muted px-2 text-[0.75rem] font-medium text-muted-foreground">
                    {group.items.length}
                  </span>
                </p>
                <div className="space-y-2">
                  {group.items.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => addService(service, replaceKey)}
                      className="flex w-full items-start justify-between gap-4 rounded-lg py-3 pl-4 pr-3 text-left hover:bg-secondary"
                      style={{ boxShadow: `inset 3px 0 0 ${categoryColor(service.id)}` }}
                    >
                      <span>
                        <span className="block text-[0.9375rem] font-medium">{service.name}</span>
                        <span className="block text-[0.8125rem] text-muted-foreground">
                          {durationLabel(service.duration_minutes)}
                        </span>
                      </span>
                      <span className="text-[0.9375rem] font-medium tabular-nums">
                        {money(Number(service.price ?? 0))}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  } else if (view.name === "edit") {
    const draft =
      editDraft && editDraft.key === view.key
        ? editDraft
        : lines.find((line) => line.key === view.key);
    if (!draft) {
      right = null;
    } else {
      const service = serviceById.get(draft.serviceId);
      const update = (patch: Partial<Line>) => setEditDraft({ ...draft, ...patch });
      right = (
        <div className="flex min-h-0 flex-1 flex-col">
          <BackHeader
            title="Edit service"
            onBack={() => {
              setEditDraft(null);
              setView({ name: "main" });
            }}
          />
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-6">
            <button
              type="button"
              onClick={() => setView({ name: "services", replaceKey: draft.key })}
              className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-4 text-left hover:bg-secondary"
              style={{ boxShadow: `inset 3px 0 0 ${categoryColor(draft.serviceId)}` }}
            >
              <span className="text-[0.9375rem]">
                {service?.name ?? "Service"}, {durationLabel(draft.duration)}
              </span>
              <CaretRight size={16} />
            </button>
            <div>
              <FieldLabel>Team member</FieldLabel>
              <div className="flex gap-2">
                <select
                  value={draft.teamMemberId}
                  onChange={(event) => update({ teamMemberId: event.target.value })}
                  className={fieldClass}
                >
                  {team.map((member) => (
                    <option key={member.id} value={member.id}>
                      {memberName(member)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label="Preferred team member"
                  title="Preferred team member"
                  onClick={() =>
                    toast("Preferred team member is saved with the next database update")
                  }
                  className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-secondary"
                >
                  <Heart size={18} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label>
                <FieldLabel>Service price</FieldLabel>
                <span className="flex h-12 items-center gap-2 rounded-lg border border-border px-4 focus-within:border-primary">
                  <span className="text-muted-foreground">{currency}</span>
                  <input
                    inputMode="decimal"
                    value={String(draft.price)}
                    onChange={(event) =>
                      update({ price: Number(event.target.value.replace(/[^\d.]/g, "")) || 0 })
                    }
                    className="h-full w-full bg-transparent text-[0.9375rem] outline-none"
                  />
                </span>
              </label>
              <label>
                <FieldLabel>Discount</FieldLabel>
                <select disabled className={fieldClass}>
                  <option>No discount</option>
                </select>
              </label>
              <label>
                <FieldLabel>Start time</FieldLabel>
                <select
                  value={draft.start}
                  onChange={(event) => update({ start: Number(event.target.value) })}
                  className={fieldClass}
                >
                  {TIME_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {formatTime(minutes)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <FieldLabel>Duration</FieldLabel>
                <select
                  value={draft.duration}
                  onChange={(event) => update({ duration: Number(event.target.value) })}
                  className={fieldClass}
                >
                  {[...new Set([...DURATION_OPTIONS, draft.duration])]
                    .sort((a, b) => a - b)
                    .map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {durationLabel(minutes)}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={() =>
                toast("Extra time (processing/blocked) is saved with the next database update")
              }
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-[0.875rem] font-medium hover:bg-secondary"
            >
              <Plus size={14} /> Add extra time
            </button>
          </div>
          <div className="border-t border-border px-6 py-5">
            <div className="flex items-center justify-between text-[0.9375rem]">
              <span className="font-semibold">Total</span>
              <span>
                <span className="text-muted-foreground">{durationLabel(draft.duration)}</span>{" "}
                <span className="font-semibold">{money(draft.price)}</span>
              </span>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                aria-label="Delete service"
                onClick={() => removeLine(draft.key)}
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-destructive hover:bg-destructive/5"
              >
                <Trash size={18} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setLines((current) =>
                    current.map((line) => (line.key === draft.key ? draft : line)),
                  );
                  setDirty(true);
                  setEditDraft(null);
                  setView({ name: "main" });
                }}
                className={cn(pill, "flex-1 bg-ink text-ink-foreground hover:bg-ink/90")}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      );
    }
  } else if (view.name === "activity") {
    const created = existing ? new Date(existing.created_at) : null;
    const updated = existing ? new Date(existing.updated_at) : null;
    const stamp = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const entries = [
      ...(existing && existing.status !== "booked" && updated
        ? [
            {
              title: `Marked as ${STATUS_LABEL[existing.status]?.toLowerCase() ?? existing.status}`,
              at: updated,
              detail: "Status updated",
            },
          ]
        : []),
      ...(created
        ? [
            {
              title: "Appointment created",
              at: created,
              detail: `Booked by ${existing?.created_by && existing.created_by === currentUserId ? "you" : "a team member"}, reference ${existing!.id.slice(0, 8).toUpperCase()}`,
            },
          ]
        : []),
    ];
    right = (
      <div className="flex min-h-0 flex-1 flex-col">
        <BackHeader title="Appointment activity" onBack={() => setView({ name: "main" })} />
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <ol className="relative space-y-4 border-l border-border pl-5">
            {entries.map((entry) => (
              <li key={entry.title} className="relative">
                <span className="absolute -left-[1.6rem] top-5 size-2 rounded-full bg-border" />
                <div className="rounded-xl border border-border p-4">
                  <p className="text-[0.9375rem] font-semibold">{entry.title}</p>
                  <p className="text-[0.8125rem] text-muted-foreground">{stamp.format(entry.at)}</p>
                  <p className="mt-2 text-[0.8125rem]">{entry.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[0.8125rem] text-muted-foreground">
            Activity for this appointment in the last 12 months
          </p>
        </div>
      </div>
    );
  } else if (view.name === "repeat") {
    right = (
      <div className="flex min-h-0 flex-1 flex-col">
        <BackHeader title="Edit repeating options" onBack={() => setView({ name: "main" })} />
        <div className="min-h-0 flex-1 px-6">
          <FieldLabel>Frequency</FieldLabel>
          <select
            className={fieldClass}
            defaultValue="none"
            onChange={(event) => {
              if (event.target.value !== "none") {
                toast(
                  "Repeating appointments need the next database update (see notes/lovable-prompts.md)",
                );
                event.target.value = "none";
              }
            }}
          >
            <option value="none">Doesn't repeat</option>
            <option value="day">Every day</option>
            <option value="week">Every week</option>
            <option value="month">Every month</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div className="border-t border-border px-6 py-5">
          <button
            type="button"
            onClick={() => setView({ name: "main" })}
            className={cn(pill, "w-full bg-ink text-ink-foreground")}
          >
            Apply changes
          </button>
        </div>
      </div>
    );
  } else {
    // Main view
    right = (
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            "px-6 pb-5 pt-6",
            isNew
              ? "border-b border-border/70"
              : cn(STATUS_HEADER[status] ?? STATUS_HEADER["booked"], "text-white"),
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild disabled={isLocked}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-[1.75rem] font-bold leading-9 tracking-tight"
                  >
                    {dateTitle}
                    <CaretDown size={16} weight="bold" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    weekStartsOn={1}
                    onSelect={(next) => {
                      if (next) change(setDate)(startOfDay(next));
                      setDatePickerOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => setView({ name: "repeat" })}
                className={cn(
                  "mt-1 block text-[0.875rem]",
                  isNew ? "text-foreground" : "text-white/90",
                  "hover:underline",
                )}
              >
                {timeLine}
              </button>
            </div>
            {!isNew ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={isLocked || setStatus.isPending}>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-white/70 px-4 text-[0.875rem] font-medium hover:bg-white/10"
                  >
                    {STATUS_LABEL[status] ?? status}
                    {!isLocked ? <CaretDown size={12} weight="bold" /> : null}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5">
                  {STATUS_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onSelect={() => option.value !== status && setStatus.mutate(option.value)}
                      className="gap-3 rounded-lg px-3 py-2 text-[0.9375rem]"
                    >
                      <span className="flex-1">{option.label}</span>
                      {status === option.value ? <Check size={14} weight="bold" /> : null}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    onSelect={() => setStatus.mutate("no_show")}
                    className="rounded-lg px-3 py-2 text-[0.9375rem] text-destructive focus:text-destructive"
                  >
                    No-show
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setCancelOpen(true)}
                    className="rounded-lg px-3 py-2 text-[0.9375rem] text-destructive focus:text-destructive"
                  >
                    Cancel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <h3 className="mb-4 text-[1.0625rem] font-semibold">Services</h3>
          <div className="space-y-2">
            {[...lines]
              .sort((a, b) => a.start - b.start)
              .map((line) => (
                <div
                  key={line.key}
                  className="group flex items-start justify-between gap-3 rounded-lg py-3 pl-4 pr-3 hover:bg-secondary/70"
                  style={{ boxShadow: `inset 3px 0 0 ${categoryColor(line.serviceId)}` }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[0.9375rem] font-medium">
                      {serviceById.get(line.serviceId)?.name ?? "Service"}
                    </p>
                    <p className="truncate text-[0.8125rem] text-muted-foreground">
                      {formatTime(line.start)} · {durationLabel(line.duration)} ·{" "}
                      {memberById.get(line.teamMemberId)
                        ? memberName(memberById.get(line.teamMemberId)!)
                        : "Team member"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!isLocked ? (
                      <span className="hidden items-center gap-1 group-hover:flex">
                        <button
                          type="button"
                          aria-label="Edit service"
                          onClick={() => {
                            setEditDraft(line);
                            setView({ name: "edit", key: line.key });
                          }}
                          className="flex size-8 items-center justify-center rounded-full hover:bg-card"
                        >
                          <PencilSimple size={17} />
                        </button>
                        <button
                          type="button"
                          aria-label="Remove service"
                          onClick={() => removeLine(line.key)}
                          className="flex size-8 items-center justify-center rounded-full hover:bg-card"
                        >
                          <Trash size={17} />
                        </button>
                      </span>
                    ) : null}
                    <span className="text-[0.9375rem] font-medium tabular-nums group-hover:hidden">
                      {money(line.price)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
          {!isLocked ? (
            <button
              type="button"
              onClick={() => setView({ name: "services" })}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-[0.875rem] font-medium hover:bg-secondary"
            >
              <Plus size={14} /> Add service
            </button>
          ) : null}
          {conflict ? (
            <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {conflict}
            </p>
          ) : null}
          {notes ? (
            <div className="mt-6">
              <h3 className="mb-2 text-[1.0625rem] font-semibold">Appointment notes</h3>
              <p className="whitespace-pre-wrap rounded-lg bg-secondary/60 px-4 py-3 text-[0.875rem]">
                {notes}
              </p>
            </div>
          ) : null}
        </div>

        <div className="border-t border-border px-6 pb-5 pt-3">
          {toPayOpen ? (
            <div className="relative space-y-1 pb-3 text-[0.8125rem]">
              <button
                type="button"
                aria-label="Collapse"
                onClick={() => setToPayOpen(false)}
                className="absolute -top-7 left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card"
              >
                <CaretDown size={12} />
              </button>
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{money(total)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span>
                <span>{money(0)}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-3 font-semibold">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-between text-[0.8125rem] text-muted-foreground">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setToPayOpen((open) => !open)}
            className="flex w-full items-center justify-between py-1"
          >
            <span className="flex items-center gap-1 text-[0.9375rem] font-semibold">
              To pay {toPayOpen ? null : <CaretRight size={12} weight="bold" />}
            </span>
            <span className="text-[0.9375rem] font-semibold">
              {money(status === "completed" ? 0 : total)}
            </span>
          </button>
          <div className="mt-3 flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Options"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border hover:bg-secondary data-[state=open]:bg-secondary"
                >
                  <DotsThreeVertical size={20} weight="bold" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-60 rounded-xl p-1.5">
                <DropdownMenuLabel className="px-3 pb-1 pt-2 text-[0.9375rem] font-semibold">
                  Quick actions
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={() => {
                    setNoteDraft(notes);
                    setNoteOpen(true);
                  }}
                  className="gap-3 rounded-lg px-3 py-2 text-[0.9375rem]"
                >
                  <NotePencil size={18} /> {notes ? "Edit note" : "Add a note"}
                </DropdownMenuItem>
                {isNew ? null : (
                  <>
                    <DropdownMenuItem
                      onSelect={() => toast("Forms arrive with the next database update")}
                      className="rounded-lg px-3 py-2 text-[0.9375rem]"
                    >
                      Add a form
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setView({ name: "activity" })}
                      className="gap-3 rounded-lg px-3 py-2 text-[0.9375rem]"
                    >
                      <ClockCounterClockwise size={18} /> View appointment activity
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setView({ name: "repeat" })}
                      className="rounded-lg px-3 py-2 text-[0.9375rem]"
                    >
                      Set as repeating
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        toast("Group appointments arrive with the next database update")
                      }
                      className="rounded-lg px-3 py-2 text-[0.9375rem]"
                    >
                      Add to group appointment
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        onRebook({
                          clientId: client?.id ?? null,
                          serviceIds: [...lines]
                            .sort((a, b) => a.start - b.start)
                            .map((line) => line.serviceId),
                          label: clientLabel,
                        })
                      }
                      className="rounded-lg px-3 py-2 text-[0.9375rem]"
                    >
                      Rebook
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {!isLocked ? (
                      <>
                        <DropdownMenuItem
                          onSelect={() =>
                            onReschedule(
                              appointmentId!,
                              lines.map((line) => line.appointmentItemId ?? line.key),
                            )
                          }
                          className="rounded-lg px-3 py-2 text-[0.9375rem]"
                        >
                          Reschedule
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setStatus.mutate("no_show")}
                          className="rounded-lg px-3 py-2 text-[0.9375rem] text-destructive focus:text-destructive"
                        >
                          No-show
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setCancelOpen(true)}
                          className="rounded-lg px-3 py-2 text-[0.9375rem] text-destructive focus:text-destructive"
                        >
                          Cancel
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {isNew || dirty ? (
              <>
                <button
                  type="button"
                  disabled={!lines.length || save.isPending}
                  onClick={() => void handleCheckout()}
                  className={cn(pill, "flex-1 border border-border bg-card hover:bg-secondary")}
                >
                  Checkout
                </button>
                <button
                  type="button"
                  disabled={!lines.length || save.isPending}
                  onClick={handleSave}
                  className={cn(pill, "flex-1 bg-ink text-ink-foreground hover:bg-ink/90")}
                >
                  {save.isPending ? "Saving…" : "Save"}
                </button>
              </>
            ) : status === "completed" ? (
              <span className={cn(pill, "flex-1 bg-muted text-muted-foreground")}>Paid</span>
            ) : status === "cancelled" ? (
              <span className={cn(pill, "flex-1 bg-muted text-muted-foreground")}>Cancelled</span>
            ) : (
              <button
                type="button"
                onClick={() => void handleCheckout()}
                className={cn(pill, "flex-1 bg-ink text-ink-foreground hover:bg-ink/90")}
              >
                Checkout
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Left client column ──
  let left: React.ReactNode;
  if (clientPickerOpen) {
    left = (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-5 pb-4 pt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[1.0625rem] font-semibold">Select a client</h3>
            <button
              type="button"
              aria-label="Close client search"
              onClick={() => setClientPickerOpen(false)}
              className="rounded-full p-1 hover:bg-secondary"
            >
              <X size={16} />
            </button>
          </div>
          <label className="mt-4 flex h-12 items-center gap-3 rounded-lg border-2 border-primary/70 px-3">
            <MagnifyingGlass size={18} />
            <input
              autoFocus
              value={clientQuery}
              onChange={(event) => setClientQuery(event.target.value)}
              placeholder="Search client or leave empty"
              className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border/70 px-3 py-3">
          <button
            type="button"
            onClick={() => setClientFormOpen(true)}
            className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left hover:bg-secondary"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-[#ebe8ff] text-primary">
              <Plus size={22} />
            </span>
            <span className="text-[0.9375rem] font-semibold">Add new client</span>
          </button>
          <button
            type="button"
            onClick={() => {
              change(setClient)(null);
              setClientPickerOpen(false);
            }}
            className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left hover:bg-secondary"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-[#ebe8ff] text-primary">
              <UserPlus size={22} />
            </span>
            <span className="text-[0.9375rem] font-semibold">Walk-In</span>
          </button>
          <div className="mx-2 my-2 h-px bg-border" />
          {visibleClients.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                change(setClient)(row);
                setClientPickerOpen(false);
              }}
              className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left hover:bg-secondary"
            >
              <Avatar name={personName(row)} size={56} />
              <span className="min-w-0">
                <span className="block truncate text-[0.9375rem] font-semibold">
                  {personName(row)}
                </span>
                <span className="block truncate text-[0.8125rem] text-muted-foreground">
                  {row.email || row.phone}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  } else if (!client) {
    left = (
      <button
        type="button"
        disabled={isLocked}
        onClick={() => setClientPickerOpen(true)}
        className="flex flex-col items-center px-3 pt-6 text-center hover:opacity-80"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-[#ebe8ff] text-primary">
          <UserPlus size={22} />
        </span>
        <span className="mt-3 text-[0.9375rem] font-semibold">
          {isNew ? "Add client" : "Walk-In"}
        </span>
        <span className="mt-1 text-[0.8125rem] leading-5 text-muted-foreground">
          {isNew ? "Or leave empty for walk-ins" : "Add a client to this appointment"}
        </span>
      </button>
    );
  } else {
    left = (
      <div className="flex flex-col items-center px-5 pt-6 text-center">
        <Avatar name={personName(client)} />
        <p className="mt-3 text-[1.0625rem] font-semibold">{personName(client)}</p>
        <p className="text-[0.8125rem] text-muted-foreground">{client.email || client.phone}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-[0.875rem] font-medium hover:bg-secondary data-[state=open]:bg-secondary"
              >
                Actions <CaretDown size={12} weight="bold" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 rounded-xl p-1.5">
              {!isLocked ? (
                <DropdownMenuItem
                  onSelect={() => change(setClient)(null)}
                  className="rounded-lg px-3 py-2 text-[0.9375rem]"
                >
                  Remove client
                </DropdownMenuItem>
              ) : null}
              {!isLocked ? (
                <DropdownMenuItem
                  onSelect={() => setClientPickerOpen(true)}
                  className="rounded-lg px-3 py-2 text-[0.9375rem]"
                >
                  Change client
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              {["Messages", "Add staff alert", "Add allergy", "Add patch test", "Add tag"].map(
                (label) => (
                  <DropdownMenuItem
                    key={label}
                    onSelect={() => toast(`${label} arrives with the Clients tab`)}
                    className="rounded-lg px-3 py-2 text-[0.9375rem]"
                  >
                    {label}
                  </DropdownMenuItem>
                ),
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="rounded-lg px-3 py-2 text-[0.9375rem]">
                <Link to="/client/$clientId" params={{ clientId: client.id }}>
                  Edit client details
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link
            to="/client/$clientId"
            params={{ clientId: client.id }}
            className="inline-flex h-9 items-center rounded-full border border-border px-4 text-[0.875rem] font-medium hover:bg-secondary"
          >
            View profile
          </Link>
        </div>
        {client.created_at ? (
          <p className="mt-6 self-start text-[0.8125rem] text-muted-foreground">
            Created{" "}
            {new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(new Date(client.created_at))}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-y-0 right-0 z-50 flex animate-in slide-in-from-right-8 duration-200">
        {/* Floating controls beside the drawer, like Fresha */}
        <div className="flex flex-col gap-3 pr-4 pt-4">
          {[
            { label: "Close", icon: <X size={18} />, onClick: requestClose },
            { label: "Minimise", icon: <ArrowsInSimple size={18} />, onClick: onMinimize },
            {
              label: "Focus appointment",
              icon: <Crosshair size={18} />,
              onClick: () => onFocusDate(date),
            },
          ].map((control) => (
            <button
              key={control.label}
              type="button"
              aria-label={control.label}
              title={control.label}
              onClick={control.onClick}
              className="flex size-11 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-secondary"
            >
              {control.icon}
            </button>
          ))}
        </div>
        <div className="flex h-full border-l border-border bg-card shadow-[-12px_0_32px_-12px_rgb(0_0_0/0.2)]">
          <aside
            className={cn(
              "flex h-full min-h-0 flex-col border-r border-border/70 transition-[width] duration-200",
              showClientColumnWide ? "w-[20rem]" : client ? "w-[15rem]" : "w-[9.5rem]",
            )}
          >
            {left}
          </aside>
          <section className="flex h-full w-[30rem] min-w-0 flex-col">{right}</section>
        </div>
      </div>

      <ConfirmModal
        open={confirmExit}
        title="You have unsaved changes"
        body="If you close the appointment now, the changes will be lost. Do you wish to exit?"
        cancelLabel="Go back"
        confirmLabel="Yes, exit"
        onCancel={() => setConfirmExit(false)}
        onConfirm={() => {
          setConfirmExit(false);
          setDirty(false);
          onClose();
        }}
      />

      {/* Add a note */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-[44rem] rounded-2xl p-6">
          <DialogTitle className="text-lg font-semibold">
            {notes ? "Edit note" : "Add a note"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Notes are visible to your team only.
          </DialogDescription>
          <textarea
            autoFocus
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="Add an appointment note here..."
            className="mt-2 min-h-48 w-full resize-y rounded-xl border border-border p-4 text-[0.9375rem] outline-none focus:border-primary"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              disabled={noteDraft === notes}
              onClick={() => {
                setNotes(noteDraft);
                setNoteOpen(false);
                if (isNew) setDirty(true);
                else saveNote.mutate(noteDraft);
              }}
              className={cn(
                pill,
                "h-10 bg-ink px-5 text-ink-foreground disabled:bg-muted disabled:text-muted-foreground",
              )}
            >
              Save
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel appointment — full screen, like Fresha */}
      {cancelOpen ? (
        <CancelScreen
          total={money(total)}
          onClose={() => setCancelOpen(false)}
          onConfirm={() =>
            setStatus.mutate("cancelled", {
              onSuccess: () => {
                setCancelOpen(false);
                onClose();
              },
            })
          }
          pending={setStatus.isPending}
        />
      ) : null}

      {/* Add new client — Bookly's full client form */}
      <Dialog open={clientFormOpen} onOpenChange={setClientFormOpen}>
        <DialogContent className="left-0 top-0 h-svh w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-0 p-0 sm:max-w-none sm:rounded-none [&>button]:hidden">
          <DialogTitle className="sr-only">Add a new client</DialogTitle>
          <DialogDescription className="sr-only">
            Create a new client profile for this business.
          </DialogDescription>
          <ClientForm
            onClose={() => setClientFormOpen(false)}
            onSaved={async (id) => {
              setClientFormOpen(false);
              if (!id) return;
              const { data } = await supabase
                .from("clients")
                .select("id, first_name, last_name, email, phone, created_at")
                .eq("id", id)
                .single();
              queryClient.invalidateQueries({ queryKey: ["booking-clients", businessId] });
              if (data) {
                change(setClient)(data as ClientRow);
                setClientPickerOpen(false);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function CancelScreen({
  total,
  pending,
  onClose,
  onConfirm,
}: {
  total: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [reason, setReason] = useState(CANCEL_REASONS[0]!);
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-card animate-in fade-in-0">
      <div className="mx-auto max-w-[72rem] px-6 py-6 sm:px-10">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className={cn(pill, "h-11 border border-border bg-card hover:bg-secondary")}
          >
            Close
          </button>
        </div>
        <h1 className="mt-6 text-[2.25rem] font-bold leading-tight tracking-tight">
          Are you sure you want to cancel?
        </h1>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <p className="flex items-center gap-3 rounded-xl bg-[#ebe8ff] px-4 py-3 text-[0.9375rem]">
              <span className="flex size-5 items-center justify-center rounded-full border border-primary text-[0.75rem] text-primary">
                i
              </span>
              No policy was applied to this appointment
            </p>
            <label
              className="flex items-start gap-3 opacity-60"
              title="Client notifications arrive with Marketing → Automations"
            >
              <input
                type="checkbox"
                disabled
                className="mt-1 size-5 accent-[var(--color-primary)]"
              />
              <span>
                <span className="block text-[0.9375rem]">Send a cancellation notification</span>
                <span className="block text-[0.8125rem] text-muted-foreground">
                  Client notifications arrive with Marketing → Automations
                </span>
              </span>
            </label>
            <label className="block">
              <FieldLabel>Cancellation reason</FieldLabel>
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={fieldClass}
              >
                {CANCEL_REASONS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="self-start rounded-2xl border border-border bg-secondary/40 p-8">
            <h2 className="text-xl font-semibold">Cancellation details</h2>
            <div className="mt-4 flex justify-between border-b border-border pb-4 text-[0.9375rem]">
              <span>Appointment total</span>
              <span className="font-semibold">{total}</span>
            </div>
            <p className="mt-4 text-[0.875rem] text-muted-foreground">No fee will be charged</p>
            <button
              type="button"
              disabled={pending}
              onClick={onConfirm}
              className={cn(pill, "mt-6 w-full bg-[#c8273a] text-white hover:bg-[#b01f31]")}
            >
              {pending ? "Cancelling…" : "Cancel appointment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
