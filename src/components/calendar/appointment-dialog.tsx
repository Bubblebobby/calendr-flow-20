import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarBlank, MagnifyingGlass, Plus, Trash, User, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ClientForm } from "@/components/clients/client-form";
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
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [conflict, setConflict] = useState<string | null>(null);
  const [serviceQuery, setServiceQuery] = useState("");
  const [clientPickerOpen, setClientPickerOpen] = useState(false);

  // Reset the form each time a new slot is opened.
  useEffect(() => {
    if (!slot) return;
    setClientQuery("");
    setClient(null);
    setWalkIn(false);
    setClientFormOpen(false);
    setNotes("");
    setConflict(null);
    setLines([]);
    setServiceQuery("");
    setClientPickerOpen(false);
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
    queryKey: ["booking-clients", business?.id],
    enabled: Boolean(business?.id) && Boolean(slot),
    queryFn: async (): Promise<ClientRow[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, phone, avatar_color")
        .eq("business_id", business!.id)
        .order("first_name", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });

  const visibleClients = useMemo(() => {
    const term = clientQuery.trim().toLocaleLowerCase();
    if (!term) return clients ?? [];
    return (clients ?? []).filter((item) =>
      [personName(item), item.email, item.phone]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(term)),
    );
  }, [clients, clientQuery]);

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

      const clientId = client?.id ?? null;

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
        overlayClassName="bg-foreground/10"
        className="inset-y-0 left-auto right-0 top-0 h-svh w-full max-w-[720px] translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 border-l border-border bg-card p-0 shadow-2xl sm:max-w-[720px] [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Add appointment</DialogTitle>
        <DialogDescription className="sr-only">
          Choose a client and services for this time slot.
        </DialogDescription>

        <div className="flex h-full min-h-0 bg-card">
          <aside className="flex w-44 shrink-0 flex-col border-r border-border bg-card px-4 py-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User size={22} />
            </div>
            {client ? (
              <>
                <p className="mt-3 truncate text-sm font-semibold text-foreground">{personName(client)}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{client.email || client.phone}</p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setClientPickerOpen(true)}>
                  Change client
                </Button>
              </>
            ) : walkIn ? (
              <>
                <p className="mt-3 text-sm font-semibold text-foreground">Walk-in</p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setClientPickerOpen(true)}>
                  Change
                </Button>
              </>
            ) : (
              <Button variant="ghost" className="mt-2 h-auto flex-col gap-1 py-2" onClick={() => setClientPickerOpen(true)}>
                <span className="font-semibold text-foreground">Add client</span>
                <span className="whitespace-normal text-xs font-normal leading-5 text-muted-foreground">
                  Or leave empty for walk-ins
                </span>
              </Button>
            )}

            <div className="mt-auto border-t border-border pt-4 text-left">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarBlank size={15} />
                <span>{dayLabel}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {slot ? minutesLabel(slot.minutes, locale) : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{slot ? personName(slot.member) : ""}</p>
            </div>
          </aside>

          <main className="relative flex min-w-0 flex-1 flex-col bg-card">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-7">
              <h2 className="text-xl font-semibold text-foreground">
                {clientPickerOpen ? "Select a client" : "Select a service"}
              </h2>
              <Button variant="ghost" size="icon" aria-label="Close appointment" onClick={onClose}>
                <X size={20} />
              </Button>
            </div>

            {clientPickerOpen ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="space-y-3 border-b border-border px-7 py-5">
                  <div className="relative">
                    <MagnifyingGlass size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      autoFocus
                      value={clientQuery}
                      onChange={(event) => setClientQuery(event.target.value)}
                      placeholder="Search by name, email or mobile"
                      className="h-11 rounded-lg pl-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 justify-start"
                      onClick={() => {
                        setWalkIn(true);
                        setClient(null);
                        setClientPickerOpen(false);
                      }}
                    >
                      <User size={16} /> Continue as walk-in
                    </Button>
                    <Button variant="outline" onClick={() => setClientFormOpen(true)}>
                      <Plus size={16} /> New client
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-7 py-3">
                  <p className="py-2 text-xs font-semibold text-muted-foreground">
                    {clientQuery ? "Search results" : "Clients"}
                  </p>
                  {visibleClients.length ? (
                    <ul className="divide-y divide-border">
                      {visibleClients.map((item) => (
                        <li key={item.id}>
                          <Button
                            variant="ghost"
                            className="h-auto w-full justify-start rounded-none px-0 py-3 text-left"
                            onClick={() => {
                              setClient(item);
                              setWalkIn(false);
                              setClientPickerOpen(false);
                            }}
                          >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {item.first_name[0]?.toUpperCase()}{item.last_name?.[0]?.toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-foreground">{personName(item)}</span>
                              <span className="block truncate text-xs font-normal text-muted-foreground">{item.email || item.phone || "No contact details"}</span>
                            </span>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-10 text-center text-sm text-muted-foreground">No clients found.</p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-border px-7 py-4">
                  <div className="relative">
                    <MagnifyingGlass size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} placeholder="Search by service name" className="h-11 rounded-lg border-primary pl-10" />
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
                  {conflict ? <p className="mb-4 border-l-2 border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">{conflict}</p> : null}
                  {grouped.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">No services found.</p>
                  ) : grouped.map((group) => (
                    <section key={group.id} className="mb-7">
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{group.name}</h3>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{group.items.length}</span>
                      </div>
                      <ul>
                        {group.items.map((service) => (
                          <li key={service.id}>
                            <Button variant="ghost" className="h-auto w-full justify-start rounded-none border-l-2 border-accent px-4 py-3 text-left hover:bg-secondary" onClick={() => addService(service)}>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground">{service.name}</span>
                                <span className="mt-1 block text-xs font-normal text-muted-foreground">{formatDuration(service.duration_minutes)}</span>
                              </span>
                              <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                                {service.price !== null ? formatMoney(Number(service.price), currency, business?.country) : "—"}
                              </span>
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}

                  {scheduled.length ? (
                    <section className="mt-2 border-t border-border pt-5">
                      <h3 className="mb-3 text-sm font-semibold text-foreground">Appointment</h3>
                      <ul className="divide-y divide-border border-y border-border">
                        {scheduled.map((line, index) => {
                          const service = services?.find((item) => item.id === line.serviceId);
                          return (
                            <li key={line.key} className="flex items-center gap-3 py-3">
                              <span className="w-16 text-xs tabular-nums text-muted-foreground">{minutesLabel(line.start, locale)}</span>
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">{service?.name ?? "Service"}</span>
                              <Select value={line.teamMemberId} onValueChange={(value) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, teamMemberId: value } : item))}>
                                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{team.map((member) => <SelectItem key={member.id} value={member.id}>{personName(member)}</SelectItem>)}</SelectContent>
                              </Select>
                              <Button variant="ghost" size="icon" aria-label="Remove service" onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash size={16} /></Button>
                            </li>
                          );
                        })}
                      </ul>
                      <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add appointment notes" rows={2} className="mt-4" />
                    </section>
                  ) : null}
                </div>
                <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-border bg-card px-7 py-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{lines.length ? formatMoney(totalPrice, currency, business?.country) : "No services selected"}</p>
                    {lines.length ? <p className="text-xs text-muted-foreground">{formatDuration(totalMinutes)}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" disabled={save.isPending || !lines.length} onClick={() => save.mutateAsync().then(() => toast("Coming soon", { description: "Checkout arrives with Sales." }), () => undefined)}>Save & checkout</Button>
                    <Button disabled={save.isPending || !lines.length} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save"}</Button>
                  </div>
                </footer>
              </>
            )}
          </main>
        </div>

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
                  .select("id, first_name, last_name, email, phone, avatar_color")
                  .eq("id", id)
                  .single();
                if (data) {
                  setClient(data as ClientRow);
                  setWalkIn(false);
                  setClientPickerOpen(false);
                }
                queryClient.invalidateQueries({ queryKey: ["booking-clients", business?.id] });
              }}
            />
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
