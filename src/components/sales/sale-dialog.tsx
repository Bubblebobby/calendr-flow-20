import { useMemo, useState } from "react";
import { MagnifyingGlass, Plus, Trash, X } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { businessLocale, formatMoney } from "@/lib/format";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

type LineItem = {
  key: string;
  description: string;
  price: number;
  quantity: number;
  serviceId: string | null;
  appointmentItemId: string | null;
};

type ClientRow = { id: string; first_name: string; last_name: string | null; email: string | null };

type TeamRow = { id: string; first_name: string; last_name: string | null };

type SellableAppointment = {
  id: string;
  client_id: string | null;
  is_walk_in: boolean;
  clientName: string;
  start: string;
  items: { id: string; service_id: string | null; price: number | null; name: string }[];
};

const uid = () => Math.random().toString(36).slice(2);

const personName = (row: { first_name: string; last_name: string | null }) =>
  [row.first_name, row.last_name].filter(Boolean).join(" ").trim();

export function SaleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const businessId = business?.id;

  const [clientId, setClientId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [teamMemberId, setTeamMemberId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "other">("cash");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [apptOpen, setApptOpen] = useState(false);

  const money = (value: number) =>
    business ? formatMoney(value, business.currency, business.country) : value.toFixed(2);

  const clientsQuery = useQuery({
    queryKey: ["sale-clients", businessId],
    enabled: Boolean(businessId) && open,
    queryFn: async (): Promise<ClientRow[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email")
        .eq("business_id", businessId!)
        .order("first_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const teamQuery = useQuery({
    queryKey: ["sale-team", businessId],
    enabled: Boolean(businessId) && open,
    queryFn: async (): Promise<TeamRow[]> => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, first_name, last_name")
        .eq("business_id", businessId!)
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const appointmentsQuery = useQuery({
    queryKey: ["sale-sellable-appointments", businessId],
    enabled: Boolean(businessId) && open,
    queryFn: async (): Promise<SellableAppointment[]> => {
      const [appointments, sold] = await Promise.all([
        supabase
          .from("appointments")
          .select(
            "id, client_id, is_walk_in, clients(first_name, last_name), appointment_items(id, service_id, price, start_time, services(name))",
          )
          .eq("business_id", businessId!)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("sales")
          .select("appointment_id")
          .eq("business_id", businessId!)
          .not("appointment_id", "is", null),
      ]);
      if (appointments.error) throw appointments.error;
      if (sold.error) throw sold.error;
      const taken = new Set((sold.data ?? []).map((row) => row.appointment_id));

      return (appointments.data ?? [])
        .filter((row) => !taken.has(row.id))
        .map((row) => {
          const rowItems = (row.appointment_items ?? []) as {
            id: string;
            service_id: string | null;
            price: number | null;
            start_time: string;
            services: { name: string } | null;
          }[];
          const sorted = [...rowItems].sort((a, b) => a.start_time.localeCompare(b.start_time));
          return {
            id: row.id,
            client_id: row.client_id,
            is_walk_in: row.is_walk_in,
            clientName: row.clients ? personName(row.clients) : "Walk-in",
            start: sorted[0]?.start_time ?? "",
            items: sorted.map((item) => ({
              id: item.id,
              service_id: item.service_id,
              price: item.price,
              name: item.services?.name ?? "Service",
            })),
          };
        });
    },
  });

  const selectedClient = clientsQuery.data?.find((row) => row.id === clientId) ?? null;

  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();
    const rows = clientsQuery.data ?? [];
    if (!term) return rows.slice(0, 8);
    return rows
      .filter((row) => `${personName(row)} ${row.email ?? ""}`.toLowerCase().includes(term))
      .slice(0, 8);
  }, [clientsQuery.data, clientSearch]);

  const sellable = useMemo(() => {
    const rows = appointmentsQuery.data ?? [];
    if (!clientId) return rows;
    return rows.filter((row) => row.client_id === clientId);
  }, [appointmentsQuery.data, clientId]);

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const dateFormatter = new Intl.DateTimeFormat(businessLocale(business?.country), {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  function reset() {
    setClientId(null);
    setClientSearch("");
    setTeamMemberId("");
    setPaymentMethod("cash");
    setNotes("");
    setItems([]);
    setAppointmentId(null);
    setApptOpen(false);
  }

  function pickAppointment(appointment: SellableAppointment) {
    setAppointmentId(appointment.id);
    if (appointment.client_id) setClientId(appointment.client_id);
    setItems(
      appointment.items.map((item) => ({
        key: uid(),
        description: item.name,
        price: Number(item.price ?? 0),
        quantity: 1,
        serviceId: item.service_id,
        appointmentItemId: item.id,
      })),
    );
    setApptOpen(false);
  }

  const saveSale = useMutation({
    mutationFn: async (status: "draft" | "completed") => {
      if (!businessId) throw new Error("No business found");
      if (items.length === 0) throw new Error("Add at least one item");

      const { data: auth } = await supabase.auth.getSession();
      const { data: sale, error } = await supabase
        .from("sales")
        .insert({
          business_id: businessId,
          client_id: clientId,
          appointment_id: appointmentId,
          team_member_id: teamMemberId || null,
          is_walk_in: !clientId,
          status,
          payment_method: paymentMethod,
          total,
          notes: notes.trim() || null,
          created_by: auth.session?.user.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: itemsError } = await supabase.from("sale_items").insert(
        items.map((item, index) => ({
          sale_id: sale.id,
          business_id: businessId,
          service_id: item.serviceId,
          appointment_item_id: item.appointmentItemId,
          description: item.description.trim() || "Item",
          price: item.price,
          quantity: item.quantity,
          sort_order: index,
        })),
      );
      if (itemsError) throw itemsError;
      return status;
    },
    onSuccess: (status) => {
      queryClient.invalidateQueries({ queryKey: ["sales", businessId] });
      queryClient.invalidateQueries({ queryKey: ["sale-sellable-appointments", businessId] });
      toast.success(status === "draft" ? "Draft saved" : "Sale completed");
      reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      if (error.message.toLowerCase().includes("duplicate key")) {
        toast.error("That appointment has already been sold.");
        return;
      }
      toast.error(error.message);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        hideClose
        className="left-0 top-0 flex h-full max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-background p-0 sm:left-auto sm:right-0 sm:h-full sm:w-[36rem] sm:max-w-[36rem] sm:rounded-none"
      >
        <header className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Add sale</h2>
            <p className="text-sm text-muted-foreground">
              Record a sale from an appointment or add items manually.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            <X size={18} weight="bold" />
          </Button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {/* Client */}
          <section className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">Client</Label>
            {selectedClient ? (
              <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {personName(selectedClient)}
                  </p>
                  {selectedClient.email && (
                    <p className="text-xs text-muted-foreground">{selectedClient.email}</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setClientId(null)}>
                  Clear
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <MagnifyingGlass
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={clientSearch}
                    onChange={(event) => setClientSearch(event.target.value)}
                    placeholder="Search clients, or leave empty for walk-in"
                    className="h-11 pl-9"
                  />
                </div>
                {clientSearch.trim() && (
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
                    {filteredClients.length === 0 && (
                      <p className="px-4 py-3 text-sm text-muted-foreground">No clients found.</p>
                    )}
                    {filteredClients.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        className="flex w-full flex-col items-start border-b border-border px-4 py-2.5 text-left last:border-0 hover:bg-muted/60"
                        onClick={() => {
                          setClientId(row.id);
                          setClientSearch("");
                        }}
                      >
                        <span className="text-sm font-medium text-foreground">
                          {personName(row)}
                        </span>
                        {row.email && (
                          <span className="text-xs text-muted-foreground">{row.email}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  No client selected — this will be recorded as a walk-in.
                </p>
              </>
            )}
          </section>

          {/* Sources */}
          <section className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="h-10 gap-2 rounded-full"
              onClick={() => setApptOpen((prev) => !prev)}
            >
              <Plus size={16} weight="bold" />
              Add from appointment
            </Button>
            <Button
              variant="outline"
              className="h-10 gap-2 rounded-full"
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  {
                    key: uid(),
                    description: "",
                    price: 0,
                    quantity: 1,
                    serviceId: null,
                    appointmentItemId: null,
                  },
                ])
              }
            >
              <Plus size={16} weight="bold" />
              Add item manually
            </Button>
          </section>

          {apptOpen && (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
              {appointmentsQuery.isLoading && (
                <p className="px-4 py-3 text-sm text-muted-foreground">Loading appointments…</p>
              )}
              {!appointmentsQuery.isLoading && sellable.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  No completed appointments left to sell.
                </p>
              )}
              {sellable.map((appointment) => (
                <button
                  key={appointment.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between border-b border-border px-4 py-3 text-left last:border-0 hover:bg-muted/60",
                    appointmentId === appointment.id && "bg-muted/60",
                  )}
                  onClick={() => pickAppointment(appointment)}
                >
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      {appointment.clientName}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {appointment.items.map((item) => item.name).join(", ")}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {appointment.start ? dateFormatter.format(new Date(appointment.start)) : ""}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Line items */}
          <section className="space-y-3">
            <Label className="text-sm font-semibold text-foreground">Items</Label>
            {items.length === 0 && (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No items yet.
              </p>
            )}
            {items.map((item, index) => (
              <div
                key={item.key}
                className="grid grid-cols-[1fr_6rem_4.5rem_2.25rem] items-center gap-2"
              >
                <Input
                  value={item.description}
                  placeholder="Description"
                  className="h-10"
                  onChange={(event) =>
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, description: event.target.value } : row,
                      ),
                    )
                  }
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.price}
                  className="h-10"
                  onChange={(event) =>
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, price: Number(event.target.value) || 0 } : row,
                      ),
                    )
                  }
                />
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  className="h-10"
                  onChange={(event) =>
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === index
                          ? { ...row, quantity: Math.max(1, Number(event.target.value) || 1) }
                          : row,
                      ),
                    )
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove item"
                  className="h-10 w-9 rounded-full text-muted-foreground"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash size={16} />
                </Button>
              </div>
            ))}

            {items.length > 0 && (
              <div className="space-y-1 rounded-xl bg-muted/60 px-4 py-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{money(total)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-foreground">
                  <span>Total</span>
                  <span>{money(total)}</span>
                </div>
              </div>
            )}
          </section>

          {/* Meta */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Payment method</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) => setPaymentMethod(value as typeof paymentMethod)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Team member</Label>
              <Select value={teamMemberId} onValueChange={setTeamMemberId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {(teamQuery.data ?? []).map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {personName(row)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">Notes</Label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional notes for this sale"
              className="min-h-20"
            />
          </section>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button
            variant="outline"
            className="h-11 rounded-full px-6"
            disabled={saveSale.isPending}
            onClick={() => saveSale.mutate("draft")}
          >
            Save as draft
          </Button>
          <Button
            className="h-11 rounded-full px-6"
            disabled={saveSale.isPending}
            onClick={() => saveSale.mutate("completed")}
          >
            Complete sale
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
