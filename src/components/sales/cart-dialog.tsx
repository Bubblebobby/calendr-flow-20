import { useMemo, useState } from "react";
import {
  CalendarCheck,
  CaretRight,
  Gift,
  MagnifyingGlass,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Sparkle,
  Stack,
  Trash,
  UserPlus,
  X,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { businessLocale, formatMoney } from "@/lib/format";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

type CartItem = {
  key: string;
  description: string;
  price: number;
  quantity: number;
  serviceId: string | null;
  appointmentItemId: string | null;
};

type ClientRow = { id: string; first_name: string; last_name: string | null; email: string | null };

type ServiceRow = {
  id: string;
  name: string;
  price: number | null;
  duration_minutes: number | null;
  category_id: string | null;
};

type SellableAppointment = {
  id: string;
  client_id: string | null;
  clientName: string;
  start: string;
  items: { id: string; service_id: string | null; price: number | null; name: string }[];
};

type Source = "menu" | "services" | "appointments";

type Step = "cart" | "payment";

const uid = () => Math.random().toString(36).slice(2);

const personName = (row: { first_name: string; last_name: string | null }) =>
  [row.first_name, row.last_name].filter(Boolean).join(" ").trim();

const QUICK_COLORS = [
  "border-l-sky-400",
  "border-l-teal-400",
  "border-l-amber-400",
  "border-l-rose-400",
  "border-l-violet-400",
  "border-l-lime-500",
];

const SOURCE_CARDS: { id: string; label: string; icon: typeof Stack; available: boolean }[] = [
  { id: "appointments", label: "Appointments", icon: CalendarCheck, available: true },
  { id: "services", label: "Services", icon: Sparkle, available: true },
  { id: "products", label: "Products", icon: Package, available: false },
  { id: "packages", label: "Packages", icon: Stack, available: false },
  { id: "gift-cards", label: "Gift cards", icon: Gift, available: false },
];

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash" },
  { id: "card", label: "Card" },
  { id: "other", label: "Other" },
] as const;

export function CartDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const businessId = business?.id;

  const [step, setStep] = useState<Step>("cart");
  const [source, setSource] = useState<Source>("menu");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "other">("cash");

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

  const servicesQuery = useQuery({
    queryKey: ["cart-services", businessId],
    enabled: Boolean(businessId) && open,
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

  const filteredServices = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = servicesQuery.data ?? [];
    if (!term) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(term));
  }, [servicesQuery.data, search]);

  const filteredAppointments = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = appointmentsQuery.data ?? [];
    if (!term) return rows;
    return rows.filter((row) =>
      `${row.clientName} ${row.items.map((item) => item.name).join(" ")}`
        .toLowerCase()
        .includes(term),
    );
  }, [appointmentsQuery.data, search]);

  const quickSale = useMemo(() => (servicesQuery.data ?? []).slice(0, 6), [servicesQuery.data]);

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const dateFormatter = new Intl.DateTimeFormat(businessLocale(business?.country), {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  function reset() {
    setStep("cart");
    setSource("menu");
    setSearch("");
    setItems([]);
    setAppointmentId(null);
    setClientId(null);
    setClientPickerOpen(false);
    setClientSearch("");
    setPaymentMethod("cash");
  }

  function addService(service: ServiceRow) {
    setItems((prev) => {
      const existing = prev.find((row) => row.serviceId === service.id && !row.appointmentItemId);
      if (existing) {
        return prev.map((row) =>
          row.key === existing.key ? { ...row, quantity: row.quantity + 1 } : row,
        );
      }
      return [
        ...prev,
        {
          key: uid(),
          description: service.name,
          price: Number(service.price ?? 0),
          quantity: 1,
          serviceId: service.id,
          appointmentItemId: null,
        },
      ];
    });
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
    setSource("menu");
    setSearch("");
  }

  const completeSale = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("No business found");
      if (items.length === 0) throw new Error("Your cart is empty");

      const { data: auth } = await supabase.auth.getSession();
      const { data: sale, error } = await supabase
        .from("sales")
        .insert({
          business_id: businessId,
          client_id: clientId,
          appointment_id: appointmentId,
          is_walk_in: !clientId,
          status: "completed",
          payment_method: paymentMethod,
          total,
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", businessId] });
      queryClient.invalidateQueries({ queryKey: ["daily-sales", businessId] });
      queryClient.invalidateQueries({ queryKey: ["sale-sellable-appointments", businessId] });
      queryClient.invalidateQueries({ queryKey: ["home-dashboard", businessId] });
      toast.success("Sale completed");
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
        overlayClassName="bg-foreground/10"
        className="[&>button:last-child]:hidden left-auto right-0 top-0 flex h-full max-h-none w-[min(100%,82rem)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-visible rounded-none border-0 border-l border-border bg-background p-0 shadow-2xl sm:w-[calc(100%-18rem)]"
      >
        <DialogTitle className="sr-only">Add to cart</DialogTitle>

        <Button
          variant="outline"
          size="icon"
          className="absolute -left-16 top-3 hidden h-12 w-12 rounded-full bg-background shadow-md sm:inline-flex"
          aria-label="Close"
          onClick={() => onOpenChange(false)}
        >
          <X size={18} weight="bold" />
        </Button>

        {/* Top bar */}
        <header className="flex items-center gap-3 px-8 pt-8">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full sm:hidden"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            <X size={16} weight="bold" />
          </Button>
          <nav className="flex items-center gap-2 text-sm font-medium">
            <button
              type="button"
              onClick={() => setStep("cart")}
              className={cn(step === "cart" ? "text-foreground" : "text-muted-foreground")}
            >
              Cart
            </button>
            <CaretRight size={12} className="text-muted-foreground" />
            <button
              type="button"
              onClick={() => toast("Tips — coming soon")}
              className="text-muted-foreground"
            >
              Tip
            </button>
            <CaretRight size={12} className="text-muted-foreground" />
            <span className={cn(step === "payment" ? "text-foreground" : "text-muted-foreground")}>
              Payment
            </span>
          </nav>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Main panel */}
          {step === "cart" ? (
            <div className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Add to cart</h2>

              <div className="relative mt-4 max-w-2xl">
                <MagnifyingGlass
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search"
                  className="h-11 rounded-xl pl-10"
                />
              </div>

              {source === "menu" && (
                <>
                  <div className="mt-5 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
                    {SOURCE_CARDS.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() =>
                          card.available
                            ? setSource(card.id as Source)
                            : toast(`${card.label} — coming soon`)
                        }
                        className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-foreground/30"
                      >
                        <card.icon size={22} className="text-muted-foreground" />
                        <span className="text-sm font-semibold text-foreground">{card.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Quick sale */}
                  <div className="mt-8 max-w-2xl">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-foreground">Quick sale</h3>
                      <button
                        type="button"
                        className="text-sm font-medium text-primary"
                        onClick={() => toast("Edit quick sale — coming soon")}
                      >
                        Edit
                      </button>
                    </div>
                    {quickSale.length === 0 ? (
                      <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                        No services yet — add services in your catalog to see them here.
                      </p>
                    ) : (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {quickSale.map((service, index) => (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => addService(service)}
                            className={cn(
                              "rounded-xl border border-border border-l-4 bg-card px-4 py-3.5 text-left transition-colors hover:border-foreground/30",
                              QUICK_COLORS[index % QUICK_COLORS.length],
                            )}
                          >
                            <span className="block text-sm font-semibold text-foreground">
                              {service.name}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {money(Number(service.price ?? 0))}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {source === "services" && (
                <div className="mt-5 max-w-2xl">
                  <button
                    type="button"
                    className="text-sm font-medium text-primary"
                    onClick={() => setSource("menu")}
                  >
                    ← Back
                  </button>
                  <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {filteredServices.length === 0 && (
                      <p className="px-4 py-4 text-sm text-muted-foreground">No services found.</p>
                    )}
                    {filteredServices.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/60"
                        onClick={() => addService(service)}
                      >
                        <span className="text-sm font-medium text-foreground">{service.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {money(Number(service.price ?? 0))}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {source === "appointments" && (
                <div className="mt-5 max-w-2xl">
                  <button
                    type="button"
                    className="text-sm font-medium text-primary"
                    onClick={() => setSource("menu")}
                  >
                    ← Back
                  </button>
                  <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {appointmentsQuery.isLoading && (
                      <p className="px-4 py-4 text-sm text-muted-foreground">Loading…</p>
                    )}
                    {!appointmentsQuery.isLoading && filteredAppointments.length === 0 && (
                      <p className="px-4 py-4 text-sm text-muted-foreground">
                        No completed appointments left to sell.
                      </p>
                    )}
                    {filteredAppointments.map((appointment) => (
                      <button
                        key={appointment.id}
                        type="button"
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/60"
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
                </div>
              )}
            </div>
          ) : (
            /* Payment step */
            <div className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Payment</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose how the client is paying.
              </p>
              <div className="mt-5 grid max-w-md grid-cols-3 gap-3">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id)}
                    className={cn(
                      "rounded-xl border px-4 py-3.5 text-sm font-semibold transition-colors",
                      paymentMethod === method.id
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/30",
                    )}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cart panel */}
          <aside className="flex w-[24rem] shrink-0 flex-col border-l border-border bg-card">
            <div className="border-b border-border p-4">
              {selectedClient ? (
                <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
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
                  <button
                    type="button"
                    onClick={() => setClientPickerOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left transition-colors hover:border-foreground/30"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-foreground">Add client</span>
                      <span className="block text-xs text-muted-foreground">
                        Leave empty for walk-ins
                      </span>
                    </span>
                    <span className="flex size-9 items-center justify-center rounded-full bg-muted text-foreground">
                      <UserPlus size={18} />
                    </span>
                  </button>
                  {clientPickerOpen && (
                    <div className="mt-2">
                      <Input
                        value={clientSearch}
                        onChange={(event) => setClientSearch(event.target.value)}
                        placeholder="Search clients"
                        className="h-10"
                        autoFocus
                      />
                      <div className="mt-2 max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                        {filteredClients.length === 0 && (
                          <p className="px-4 py-3 text-sm text-muted-foreground">No clients found.</p>
                        )}
                        {filteredClients.map((row) => (
                          <button
                            key={row.id}
                            type="button"
                            className="flex w-full flex-col items-start px-4 py-2.5 text-left hover:bg-muted/60"
                            onClick={() => {
                              setClientId(row.id);
                              setClientPickerOpen(false);
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
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Cart body */}
            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <ShoppingCart size={36} className="text-muted-foreground/50" />
                  <p className="text-sm font-semibold text-foreground">Your cart is empty</p>
                  <p className="max-w-[16rem] text-xs text-muted-foreground">
                    Tap an item to add to cart or add an existing client for smart recommendations
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {items.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.description}
                        </p>
                        <p className="text-xs text-muted-foreground">{money(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7 rounded-full"
                          aria-label="Decrease quantity"
                          onClick={() =>
                            setItems((prev) =>
                              prev.map((row) =>
                                row.key === item.key
                                  ? { ...row, quantity: Math.max(1, row.quantity - 1) }
                                  : row,
                              ),
                            )
                          }
                        >
                          <Minus size={12} weight="bold" />
                        </Button>
                        <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7 rounded-full"
                          aria-label="Increase quantity"
                          onClick={() =>
                            setItems((prev) =>
                              prev.map((row) =>
                                row.key === item.key ? { ...row, quantity: row.quantity + 1 } : row,
                              ),
                            )
                          }
                        >
                          <Plus size={12} weight="bold" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-full text-muted-foreground"
                          aria-label="Remove item"
                          onClick={() =>
                            setItems((prev) => prev.filter((row) => row.key !== item.key))
                          }
                        >
                          <Trash size={14} />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Cart footer */}
            <div className="border-t border-border p-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-semibold text-foreground">Total</span>
                <span className="text-base font-bold tabular-nums text-foreground">
                  {money(total)}
                </span>
              </div>
              {step === "cart" ? (
                <Button
                  className="h-11 w-full rounded-full text-sm font-semibold"
                  disabled={items.length === 0}
                  onClick={() => setStep("payment")}
                >
                  Continue to payment
                </Button>
              ) : (
                <Button
                  className="h-11 w-full rounded-full text-sm font-semibold"
                  disabled={items.length === 0 || completeSale.isPending}
                  onClick={() => completeSale.mutate()}
                >
                  {completeSale.isPending ? "Completing…" : `Complete sale · ${money(total)}`}
                </Button>
              )}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
