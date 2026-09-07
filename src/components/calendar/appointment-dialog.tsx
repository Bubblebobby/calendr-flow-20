import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CaretLeft, MagnifyingGlass, Trash, User, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { CurrentBusiness } from "@/lib/use-business";
import { formatDuration, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type BookingSlot = {
  member: { id: string; first_name: string; last_name: string | null };
  minutes: number;
  date: Date;
};

type ClientRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_color: string;
};

type ServiceRow = {
  id: string;
  name: string;
  price: number | null;
  duration_minutes: number;
  category_id: string | null;
};

type CategoryRow = { id: string; name: string };

type TeamOption = { id: string; first_name: string; last_name: string | null };

type Line = {
  key: string;
  serviceId: string;
  teamMemberId: string;
  durationMinutes: number;
  price: number | null;
};

function personName(p: { first_name: string; last_name?: string | null }) {
  return [p.first_name, p.last_name].filter(Boolean).join(" ");
}

function minutesLabel(minutes: number, locale: string) {
  const d = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(d);
}

/** Combine the viewed calendar day with a minute offset into an ISO timestamp. */
function slotToISO(day: Date, minutes: number) {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d.toISOString();
}

export function AppointmentDialog({
  slot,
  business,
  team,
  onClose,
}: {
  slot: BookingSlot | null;
  business: CurrentBusiness | null | undefined;
  team: TeamOption[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const locale = typeof navigator !== "undefined" ? navigator.language : "en";
  const currency = business?.currency ?? "USD";

  const [clientQuery, setClientQuery] = useState("");
  const [client, setClient] = useState<ClientRow | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [newClient, setNewClient] = useState({ first_name: "", last_name: "", phone: "", email: "" });
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [conflict, setConflict] = useState<string | null>(null);
  const [serviceQuery, setServiceQuery] = useState("");

  // Reset the form each time a new slot is opened.
  useEffect(() => {
    if (!slot) return;
    setClientQuery("");
    setClient(null);
    setWalkIn(false);
    setQuickAdd(false);
    setNewClient({ first_name: "", last_name: "", phone: "", email: "" });
    setNotes("");
    setConflict(null);
    setLines([]);
    setServiceQuery("");
  }, [slot]);

  const { data: services } = useQuery({
    queryKey: ["booking-services", business?.id],
    enabled: Boolean(business?.id) && Boolean(slot),
    queryFn: async (): Promise<ServiceRow[]> => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, price, duration_minutes, category_id")
        .eq("business_id", business!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ServiceRow[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["booking-categories", business?.id],
    enabled: Boolean(business?.id) && Boolean(slot),
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase
        .from("service_categories")
        .select("id, name")
        .eq("business_id", business!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["booking-clients", business?.id, clientQuery],
    enabled: Boolean(business?.id) && Boolean(slot) && clientQuery.trim().length > 0,
    queryFn: async (): Promise<ClientRow[]> => {
      const term = `%${clientQuery.trim()}%`;
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, phone, avatar_color")
        .eq("business_id", business!.id)
        .or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`)
        .limit(6);
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });

  // Group the catalog by category for the right-hand picker.
  const grouped = useMemo(() => {
    const term = serviceQuery.trim().toLowerCase();
    const visible = (services ?? []).filter((s) =>
      term ? s.name.toLowerCase().includes(term) : true,
    );
    const buckets: { id: string; name: string; items: ServiceRow[] }[] = [];
    for (const category of categories ?? []) {
      const items = visible.filter((s) => s.category_id === category.id);
      if (items.length) buckets.push({ id: category.id, name: category.name, items });
    }
    const uncategorised = visible.filter(
      (s) => !s.category_id || !(categories ?? []).some((c) => c.id === s.category_id),
    );
    if (uncategorised.length)
      buckets.push({ id: "none", name: "Other services", items: uncategorised });
    return buckets;
  }, [services, categories, serviceQuery]);

  // Services run back-to-back from the clicked slot.
  const scheduled = useMemo(() => {
    let cursor = slot?.minutes ?? 0;
    return lines.map((line) => {
      const start = cursor;
      cursor += line.durationMinutes;
      return { ...line, start, end: cursor };
    });
  }, [lines, slot]);

  const totalPrice = lines.reduce((sum, l) => sum + (l.price ?? 0), 0);
  const totalMinutes = lines.reduce((sum, l) => sum + l.durationMinutes, 0);

  function addService(service: ServiceRow) {
    if (!slot) return;
    setLines((current) => [
      ...current,
      {
        key: `${service.id}-${Date.now()}`,
        serviceId: service.id,
        teamMemberId: slot.member.id,
        durationMinutes: service.duration_minutes,
        price: service.price,
      },
    ]);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!business || !slot) throw new Error("Missing business");
      if (scheduled.length === 0) throw new Error("Add at least one service");

      let clientId = client?.id ?? null;

      if (!walkIn && !clientId && quickAdd && newClient.first_name.trim()) {
        const { data, error } = await supabase
          .from("clients")
          .insert({
            business_id: business.id,
            first_name: newClient.first_name.trim(),
            last_name: newClient.last_name.trim() || null,
            phone: newClient.phone.trim() || null,
            email: newClient.email.trim() || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        clientId = data.id;
      }

      const { data: appointment, error: apptError } = await supabase
        .from("appointments")
        .insert({
          business_id: business.id,
          client_id: walkIn ? null : clientId,
          is_walk_in: walkIn,
          status: "booked",
          notes: notes.trim() || null,
        })
        .select("id")
        .single();
      if (apptError) throw apptError;

      const items = scheduled.map((line, index) => ({
        appointment_id: appointment.id,
        business_id: business.id,
        service_id: line.serviceId,
        team_member_id: line.teamMemberId,
        start_time: slotToISO(slot.date, line.start),
        end_time: slotToISO(slot.date, line.end),
        price: line.price,
        sort_order: index,
      }));

      const { error: itemsError } = await supabase.from("appointment_items").insert(items);
      if (itemsError) {
        // Roll back the header so a rejected booking leaves nothing behind.
        await supabase.from("appointments").delete().eq("id", appointment.id);
        throw itemsError;
      }
      return appointment.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
      toast.success("Appointment booked");
      onClose();
    },
    onError: (error: unknown) => {
      const err = error as { code?: string; message?: string };
      if (err.code === "23P01" || /exclusion|overlap/i.test(err.message ?? "")) {
        setConflict("This team member is already booked at that time. Pick another time or team member.");
        return;
      }
      toast.error(err.message ?? "Could not save the appointment");
    },
  });

  const open = slot !== null;
  const dayLabel = slot
    ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(
        slot.date,
      )
    : "";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="left-0 top-0 h-svh w-svw max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-background p-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">Add appointment</DialogTitle>
        <DialogDescription className="sr-only">
          Choose a client and services for this time slot.
        </DialogDescription>

        <div className="flex h-full min-h-0 flex-col lg:flex-row">
          {/* Left: appointment builder */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 lg:px-10 lg:py-8">
            <div className="mx-auto w-full max-w-2xl space-y-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Back"
                  className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-secondary lg:hidden"
                >
                  <CaretLeft size={16} />
                </button>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">Add appointment</h2>
                  {slot ? (
                    <p className="text-sm text-muted-foreground">
                      {dayLabel} · {minutesLabel(slot.minutes, locale)} ·{" "}
                      {personName(slot.member)}
                    </p>
                  ) : null}
                </div>
              </div>

              {conflict ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {conflict}
                </p>
              ) : null}

              {/* Client */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Client</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setWalkIn((v) => !v);
                      setClient(null);
                      setQuickAdd(false);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      walkIn
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    Walk-in
                  </button>
                </div>

                {walkIn ? (
                  <p className="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
                    Booking without a client record.
                  </p>
                ) : client ? (
                  <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
                    <span
                      className="flex size-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: client.avatar_color }}
                    >
                      {client.first_name[0]?.toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{personName(client)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {client.email || client.phone || "No contact details"}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label="Remove client"
                      onClick={() => setClient(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <MagnifyingGlass
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                      <Input
                        value={clientQuery}
                        onChange={(e) => setClientQuery(e.target.value)}
                        placeholder="Search client by name, email or phone"
                        className="pl-9"
                      />
                    </div>
                    {clients && clients.length > 0 ? (
                      <ul className="divide-y divide-border rounded-xl border border-border">
                        {clients.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => setClient(c)}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-secondary"
                            >
                              <span
                                className="flex size-7 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                                style={{ backgroundColor: c.avatar_color }}
                              >
                                {c.first_name[0]?.toUpperCase()}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm">{personName(c)}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {c.email || c.phone || ""}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {quickAdd ? (
                      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border p-3">
                        <Input
                          placeholder="First name"
                          value={newClient.first_name}
                          onChange={(e) => setNewClient({ ...newClient, first_name: e.target.value })}
                        />
                        <Input
                          placeholder="Last name"
                          value={newClient.last_name}
                          onChange={(e) => setNewClient({ ...newClient, last_name: e.target.value })}
                        />
                        <Input
                          placeholder="Mobile"
                          value={newClient.phone}
                          onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                        />
                        <Input
                          placeholder="Email"
                          value={newClient.email}
                          onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                        />
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setQuickAdd(true)}>
                        <User size={14} /> Add new client
                      </Button>
                    )}
                  </div>
                )}
              </section>

              {/* Selected services */}
              <section className="space-y-2">
                <Label>Services</Label>
                {scheduled.length > 0 ? (
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {scheduled.map((line, index) => {
                      const service = services?.find((s) => s.id === line.serviceId);
                      return (
                        <li key={line.key} className="flex items-center gap-3 px-3 py-3">
                          <span className="w-16 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                            {minutesLabel(line.start, locale)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {service?.name ?? "Service"}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {formatDuration(line.durationMinutes)}
                            </span>
                          </span>
                          <Select
                            value={line.teamMemberId}
                            onValueChange={(value) =>
                              setLines((current) =>
                                current.map((l, i) => (i === index ? { ...l, teamMemberId: value } : l)),
                              )
                            }
                          >
                            <SelectTrigger className="h-8 w-40 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {team.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {personName(m)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="w-24 shrink-0 text-right text-sm tabular-nums">
                            {line.price !== null
                              ? formatMoney(Number(line.price), currency, business?.country)
                              : "—"}
                          </span>
                          <button
                            type="button"
                            aria-label="Remove service"
                            onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash size={16} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                    Pick a service from the list on the right.
                  </p>
                )}
              </section>

              <section className="space-y-2">
                <Label htmlFor="appointment-notes">Notes</Label>
                <Textarea
                  id="appointment-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything the team should know"
                  rows={2}
                />
              </section>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">
                  {scheduled.length > 0
                    ? `${formatDuration(totalMinutes)} · ${formatMoney(totalPrice, currency, business?.country)}`
                    : "No services selected"}
                </span>
                <span className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={save.isPending || lines.length === 0}
                    onClick={() =>
                      save.mutateAsync().then(
                        () => toast("Coming soon", { description: "Checkout arrives with Sales." }),
                        () => undefined,
                      )
                    }
                  >
                    Save & checkout
                  </Button>
                  <Button disabled={save.isPending || lines.length === 0} onClick={() => save.mutate()}>
                    {save.isPending ? "Saving…" : "Save"}
                  </Button>
                </span>
              </div>
            </div>
          </div>

          {/* Right: service catalog */}
          <aside className="flex min-h-0 w-full flex-col border-t border-border bg-secondary/30 lg:w-[400px] lg:border-l lg:border-t-0">
            <div className="flex items-start justify-between gap-3 px-6 pt-6">
              <h3 className="text-lg font-semibold tracking-tight">Select a service</h3>
            </div>
            <div className="px-6 py-4">
              <div className="relative">
                <MagnifyingGlass
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={serviceQuery}
                  onChange={(e) => setServiceQuery(e.target.value)}
                  placeholder="Search service name"
                  className="bg-background pl-9"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
              {grouped.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No services found.</p>
              ) : (
                grouped.map((group) => (
                  <div key={group.id} className="mb-6">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.name}
                    </p>
                    <ul className="overflow-hidden rounded-xl border border-border bg-background">
                      {group.items.map((service) => (
                        <li key={service.id} className="border-b border-border last:border-0">
                          <button
                            type="button"
                            onClick={() => addService(service)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary active:bg-secondary"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{service.name}</span>
                              <span className="block text-xs text-muted-foreground">
                                {formatDuration(service.duration_minutes)}
                              </span>
                            </span>
                            <span className="shrink-0 text-sm tabular-nums">
                              {service.price !== null
                                ? formatMoney(Number(service.price), currency, business?.country)
                                : "—"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
