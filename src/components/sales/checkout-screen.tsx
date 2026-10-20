import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Backspace,
  CalendarCheck,
  CaretDown,
  CaretRight,
  CheckCircle,
  ClipboardText,
  CreditCard,
  Crown,
  CurrencyCircleDollar,
  DotsThreeVertical,
  Gift,
  MagnifyingGlass,
  Money,
  Package,
  PencilSimple,
  PlusCircle,
  Receipt,
  ShoppingCartSimple,
  Stack,
  Tag,
  Trash,
  UserPlus,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import { lineTaxes } from "@/lib/tax";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";
import {
  GiftCardSellDialog,
  RedeemGiftDialog,
  finalizeExtras,
  useClientBenefits,
  useSellables,
  type GiftPayment,
  type LineExtra,
} from "@/components/sales/checkout-extras";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Types ──────────────────────────────────────────────────────────────────

export type CheckoutLine = {
  key: string;
  serviceId: string | null;
  /** Set for retail products; stock is taken out when the sale completes. */
  productId?: string | null;
  /** Gift cards, packages, memberships and package-session redemptions. */
  extra?: LineExtra;
  description: string;
  price: number;
  quantity: number;
  durationMinutes: number | null;
  teamMemberId: string | null;
  appointmentItemId: string | null;
};

export type CheckoutStart = {
  /** Resume an existing draft sale instead of creating a new one. */
  saleId?: string | null;
  appointmentId?: string | null;
  clientId?: string | null;
  lines?: CheckoutLine[];
  /** Jump straight to Tip (appointment checkout, like Fresha). */
  step?: Step;
};

type Step = "cart" | "tip" | "payment" | "done";
type Method = "cash" | "card" | "other";
type Payment = { key: string; method: Method; amount: number; gift?: GiftPayment };

type ServiceRow = {
  id: string;
  tax_rate_id?: string | null;
  name: string;
  price: number | null;
  duration_minutes: number;
  category_id: string | null;
};
type CategoryRow = { id: string; name: string; color: string | null };
type ProductRow = { id: string; name: string; retail_price: number; track_stock: boolean; stock_quantity: number; tax_rate_id?: string | null };
type ClientRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};
type MemberRow = { id: string; first_name: string; last_name: string | null };
type SellableAppointment = {
  id: string;
  clientId: string | null;
  label: string;
  when: string;
  lines: CheckoutLine[];
};

const TIP_OPTIONS = [0, 10, 18, 25] as const;
const METHOD_LABEL: Record<Method, string> = { cash: "Cash", card: "Card", other: "Other" };

let seed = 0;
const lineKey = () => `cart-${Date.now()}-${seed++}`;

const personName = (person: { first_name: string; last_name?: string | null }) =>
  [person.first_name, person.last_name].filter(Boolean).join(" ");

const pill =
  "inline-flex h-12 items-center justify-center rounded-full px-6 text-heading font-semibold transition-colors disabled:opacity-50";

// ─── Component ──────────────────────────────────────────────────────────────

export function CheckoutScreen({
  open,
  start,
  onClose,
  onCompleted,
}: {
  open: boolean;
  start?: CheckoutStart | null;
  onClose: () => void;
  onCompleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const businessId = business?.id;
  const currency = business?.currency ?? "NGN";
  const money = (value: number) => formatMoney(value, currency, business?.country ?? "");

  const [step, setStep] = useState<Step>("cart");
  const [browse, setBrowse] = useState<null | "services" | "appointments" | "products" | "packages" | "memberships">(null);
  const [giftSellOpen, setGiftSellOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [issuedCodes, setIssuedCodes] = useState<string[]>([]);
  const [dealCode, setDealCode] = useState<string | null>(null);
  // Which lines the cart discount covers: a services-only deal skips products.
  const [discountScope, setDiscountScope] = useState<"all" | "services">("all");
  const [completedSaleId, setCompletedSaleId] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<CheckoutLine[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [saleId, setSaleId] = useState<string | null>(null);
  const [clientPicker, setClientPicker] = useState(false);
  const [clientQuery, setClientQuery] = useState("");
  const [tip, setTip] = useState<number | "custom">(0);
  const [customTip, setCustomTip] = useState("");
  const [discount, setDiscount] = useState(0);
  const [receiptNote, setReceiptNote] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [amountModal, setAmountModal] = useState<Method | null>(null);
  const [toPayOpen, setToPayOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [editLine, setEditLine] = useState<CheckoutLine | null>(null);
  const [prompt, setPrompt] = useState<null | "discount" | "note" | "tip">(null);
  const [splitMode, setSplitMode] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(start?.step ?? "cart");
    setBrowse(null);
    setSearch("");
    setLines(start?.lines ?? []);
    setClientId(start?.clientId ?? null);
    setAppointmentId(start?.appointmentId ?? null);
    setSaleId(start?.saleId ?? null);
    setClientPicker(false);
    setTip(0);
    setCustomTip("");
    setDiscount(0);
    setReceiptNote("");
    setPayments([]);
    setToPayOpen(false);
    setSplitMode(false);
    setIssuedCodes([]);
    setDealCode(null);
    setDiscountScope("all");
    setPromoInput("");
    setPromoError(null);
  }, [open, start]);

  // ── Data ──
  const { data: services = [] } = useQuery({
    queryKey: ["checkout-services", businessId],
    enabled: Boolean(open && businessId),
    queryFn: async (): Promise<ServiceRow[]> => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("business_id", businessId!)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as ServiceRow[];
    },
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["checkout-categories", businessId],
    enabled: Boolean(open && businessId),
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase
        .from("service_categories")
        .select("id, name, color")
        .eq("business_id", businessId!)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });
  const { data: products = [] } = useQuery({
    queryKey: ["checkout-products", businessId],
    enabled: Boolean(open && businessId),
    retry: false,
    queryFn: async (): Promise<ProductRow[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("business_id", businessId!)
        .eq("is_archived", false)
        .order("name");
      if (error) return [];
      return (data ?? []) as ProductRow[];
    },
  });
  const sellables = useSellables(businessId, open);
  // Tax: each item's own rate, else the business default (prices include tax).
  const { data: taxSetup } = useQuery({
    queryKey: ["checkout-tax", businessId],
    enabled: Boolean(open && businessId),
    retry: false,
    queryFn: async () => {
      const [rates, biz] = await Promise.all([
        supabase.from("tax_rates").select("id, name, rate").eq("business_id", businessId!),
        supabase.from("businesses").select("*").eq("id", businessId!).single(),
      ]);
      return {
        rates: new Map((rates.error ? [] : (rates.data ?? [])).map((r) => [r.id, Number(r.rate)])),
        defaultId: biz.error ? null : ((biz.data as { default_tax_rate_id?: string | null }).default_tax_rate_id ?? null),
      };
    },
  });
  const { data: benefits } = useClientBenefits(open ? clientId : null);
  const { data: members = [] } = useQuery({
    queryKey: ["checkout-members", businessId],
    enabled: Boolean(open && businessId),
    queryFn: async (): Promise<MemberRow[]> => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, first_name, last_name")
        .eq("business_id", businessId!)
        .eq("is_active", true)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as MemberRow[];
    },
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["checkout-clients", businessId],
    enabled: Boolean(open && businessId),
    queryFn: async (): Promise<ClientRow[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, phone")
        .eq("business_id", businessId!)
        .order("first_name")
        .limit(300);
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });
  const { data: sellable = [] } = useQuery({
    queryKey: ["checkout-appointments", businessId],
    enabled: Boolean(open && businessId && browse === "appointments"),
    queryFn: async (): Promise<SellableAppointment[]> => {
      const [appointments, sold] = await Promise.all([
        supabase
          .from("appointments")
          .select(
            "id, client_id, status, clients(first_name, last_name), appointment_items(id, service_id, team_member_id, price, start_time, end_time, services(name))",
          )
          .eq("business_id", businessId!)
          .not("status", "in", "(completed,cancelled,no_show)")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("sales")
          .select("appointment_id")
          .eq("business_id", businessId!)
          .not("appointment_id", "is", null),
      ]);
      if (appointments.error) throw appointments.error;
      const taken = new Set((sold.data ?? []).map((row) => row.appointment_id));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (appointments.data ?? [])
        .filter((row: any) => !taken.has(row.id))
        .map((row: any) => {
          const items = [...(row.appointment_items ?? [])].sort((a, b) =>
            a.start_time.localeCompare(b.start_time),
          );
          const first = items[0];
          return {
            id: row.id,
            clientId: row.client_id,
            label: row.clients ? personName(row.clients) : "Walk-In",
            when: first
              ? new Intl.DateTimeFormat("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(first.start_time))
              : "",
            lines: items.map((item) => ({
              key: lineKey(),
              serviceId: item.service_id,
              description: item.services?.name ?? "Service",
              price: Number(item.price ?? 0),
              quantity: 1,
              durationMinutes: Math.round(
                (new Date(item.end_time).getTime() - new Date(item.start_time).getTime()) / 60000,
              ),
              teamMemberId: item.team_member_id,
              appointmentItemId: item.id,
            })),
          } satisfies SellableAppointment;
        });
    },
  });

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
  const client = clients.find((row) => row.id === clientId) ?? null;
  const colorFor = (serviceId: string | null) => {
    const categoryId = services.find((service) => service.id === serviceId)?.category_id;
    return categories.find((category) => category.id === categoryId)?.color || "#a5d8f3";
  };

  // ── Totals ──
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const afterDiscount = Math.max(0, subtotal - discount);
  // Percentage tips are worked out on services and products, not gift cards, packages or memberships.
  const prepaidTotal = lines.reduce((sum, line) => sum + (line.extra ? line.price * line.quantity : 0), 0);
  const tipBase = Math.max(0, afterDiscount - prepaidTotal);
  const tipAmount =
    tip === "custom" ? Math.max(0, Number(customTip) || 0) : Math.round(tipBase * tip) / 100;
  const toPay = afterDiscount + tipAmount;
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const lineRate = (line: CheckoutLine): number | null => {
    if (!taxSetup || line.extra) return null;
    const own = line.productId
      ? products.find((p) => p.id === line.productId)?.tax_rate_id
      : line.serviceId
        ? services.find((s) => s.id === line.serviceId)?.tax_rate_id
        : null;
    const id = own ?? taxSetup.defaultId;
    return id ? (taxSetup.rates.get(id) ?? null) : null;
  };
  const discountable = (line: CheckoutLine) =>
    !line.extra && (discountScope === "all" || (!!line.serviceId && !line.productId));
  const taxes = lineTaxes(
    lines.map((line) => ({ amount: line.price * line.quantity, rate: lineRate(line), discountable: discountable(line) })),
    discount,
  );
  const taxTotal = Math.round(taxes.reduce((sum, value) => sum + value, 0) * 100) / 100;
  const leftToPay = Math.max(0, Math.round((toPay - paid) * 100) / 100);
  const staffNames = [
    ...new Set(
      lines
        .map((line) => line.teamMemberId && memberById.get(line.teamMemberId)?.first_name)
        .filter(Boolean),
    ),
  ].join(", ");

  function addService(service: ServiceRow) {
    setLines((current) => [
      ...current,
      {
        key: lineKey(),
        serviceId: service.id,
        description: service.name,
        price: Number(service.price ?? 0),
        quantity: 1,
        durationMinutes: service.duration_minutes,
        teamMemberId: members[0]?.id ?? null,
        appointmentItemId: null,
      },
    ]);
  }

  function addProduct(product: ProductRow) {
    setLines((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) return current.map((line) => (line === existing ? { ...line, quantity: line.quantity + 1 } : line));
      return [
        ...current,
        {
          key: lineKey(),
          serviceId: null,
          productId: product.id,
          description: product.name,
          price: Number(product.retail_price),
          quantity: 1,
          durationMinutes: null,
          teamMemberId: members[0]?.id ?? null,
          appointmentItemId: null,
        },
      ];
    });
  }

  function addExtra(description: string, price: number, extra: LineExtra) {
    setLines((current) => [
      ...current,
      {
        key: lineKey(),
        serviceId: null,
        productId: null,
        extra,
        description,
        price,
        quantity: 1,
        durationMinutes: null,
        teamMemberId: members[0]?.id ?? null,
        appointmentItemId: null,
      },
    ]);
  }

  /** Sessions the client has left for a service, minus ones already used in this cart. */
  function sessionsLeftFor(serviceId: string | null) {
    if (!serviceId || !benefits) return null;
    const item = benefits.sessions.find(
      (s) =>
        s.service_id === serviceId &&
        s.left > lines.filter((l) => l.extra?.kind === "package_session" && l.extra.clientPackageItemId === s.id).length,
    );
    if (!item) return null;
    const used = lines.filter((l) => l.extra?.kind === "package_session" && l.extra.clientPackageItemId === item.id).length;
    return { item, left: item.left - used };
  }

  function addAppointment(appointment: SellableAppointment) {
    if (appointmentId && appointmentId !== appointment.id) {
      toast.error("A sale can include one appointment. Complete this sale first.");
      return;
    }
    setAppointmentId(appointment.id);
    if (appointment.clientId) setClientId(appointment.clientId);
    setLines((current) => [
      ...current.filter((line) => !line.appointmentItemId),
      ...appointment.lines,
    ]);
    setBrowse(null);
  }

  function invalidate() {
    for (const key of [
      "sales",
      "daily-sales",
      "sale-sellable-appointments",
      "home-dashboard",
      "calendar-appointments",
      "appointment-detail",
      "sales-appointments",
      "payments-list",
    ]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  // ── Persistence ──
  const persist = useMutation({
    mutationFn: async (mode: "draft" | "completed") => {
      if (!businessId) throw new Error("No business");
      if (!lines.length) throw new Error("Your cart is empty");
      const needsClient = lines.some((l) => l.extra?.kind === "package" || l.extra?.kind === "membership");
      if (needsClient && !clientId) throw new Error("Add a client to sell packages and memberships");
      const hasExtras = lines.some((l) => l.extra) || payments.some((p) => p.gift);
      if (mode === "draft" && hasExtras) throw new Error("Complete this sale now: gift cards, packages and memberships can't be saved as unpaid");
      const { data: auth } = await supabase.auth.getSession();
      const method: Method =
        payments.length === 0
          ? "other"
          : [...payments].sort((a, b) => b.amount - a.amount)[0]!.method;
      const noteParts = [
        receiptNote.trim() || null,
        tipAmount > 0 ? `Tip ${money(tipAmount)}${staffNames ? ` for ${staffNames}` : ""}` : null,
        discount > 0 ? `Cart discount ${money(discount)}` : null,
        payments.length > 1
          ? `Split payment: ${payments.map((payment) => `${payment.gift ? `Gift card ${payment.gift.code}` : METHOD_LABEL[payment.method]} ${money(payment.amount)}`).join(", ")}`
          : null,
      ].filter(Boolean);
      const header = {
        business_id: businessId,
        client_id: clientId,
        appointment_id: appointmentId,
        is_walk_in: !clientId,
        status: mode,
        payment_method: method,
        total: afterDiscount,
        team_member_id: lines.find((line) => line.teamMemberId)?.teamMemberId ?? null,
        notes: noteParts.length ? noteParts.join(" · ") : null,
        tip_amount: tipAmount,
        tax_amount: taxTotal,
        discount_amount: discount,
      };
      // Columns added by the 19 Oct database update; if it hasn't been run, save without them.
      const NEW_SALE_COLUMNS = ["tax_amount", "discount_amount"] as const;
      const NEW_ITEM_COLUMNS = ["product_id", "team_member_id", "tax_amount"] as const;
      const isMissingColumn = (e: { code?: string; message?: string } | null) =>
        Boolean(e && (e.code === "PGRST204" || e.code === "42703" || /column .* (does not exist|of '.*' in the schema cache)/i.test(e.message ?? "")));
      const strip = <T extends Record<string, unknown>>(row: T, keys: readonly string[]) =>
        Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key))) as T;
      let id = saleId;
      if (id) {
        let { error } = await supabase.from("sales").update(header).eq("id", id);
        if (isMissingColumn(error)) ({ error } = await supabase.from("sales").update(strip(header, NEW_SALE_COLUMNS)).eq("id", id));
        if (error) throw error;
        const { error: deleteError } = await supabase.from("sale_items").delete().eq("sale_id", id);
        if (deleteError) throw deleteError;
      } else {
        const row = { ...header, created_by: auth.session?.user.id ?? null };
        let { data, error } = await supabase.from("sales").insert(row).select("id").single();
        if (isMissingColumn(error)) ({ data, error } = await supabase.from("sales").insert(strip(row, NEW_SALE_COLUMNS)).select("id").single());
        if (error || !data) throw error ?? new Error("Couldn't save the sale");
        id = data.id;
      }
      const itemRows = lines.map((line, index) => ({
          sale_id: id!,
          business_id: businessId,
          service_id: line.serviceId,
          product_id: line.productId ?? null,
          team_member_id: line.teamMemberId,
          tax_amount: taxes[index] ?? 0,
          appointment_item_id: line.appointmentItemId,
          description: line.description,
          price: line.price,
          quantity: line.quantity,
          sort_order: index,
        }));
      let { error: itemsError } = await supabase.from("sale_items").insert(itemRows);
      if (isMissingColumn(itemsError)) {
        if (itemRows.some((row) => row.product_id)) throw new Error("Selling products needs the latest database update");
        ({ error: itemsError } = await supabase.from("sale_items").insert(itemRows.map((row) => strip(row, NEW_ITEM_COLUMNS))));
      }
      if (itemsError) throw itemsError;
      if (mode === "completed") {
        const codes = await finalizeExtras({
          saleId: id!,
          businessId,
          clientId,
          lines,
          giftPayments: payments.filter((p) => p.gift).map((p) => ({ ...p.gift!, amount: p.amount })),
          packages: sellables.packages,
          memberships: sellables.memberships,
        });
        setIssuedCodes(codes);
        if (dealCode && discount > 0) {
          const { error: dealError } = await supabase.rpc("redeem_deal", { p_code: dealCode, p_sale: id!, p_amount: discount });
          if (dealError) toast.warning(`Sale completed, but promo code ${dealCode} couldn't be recorded: ${dealError.message}`);
        }
      }
      if (mode === "completed" && appointmentId) {
        const { error } = await supabase
          .from("appointments")
          .update({ status: "completed" })
          .eq("id", appointmentId);
        if (error) throw error;
      }
      return { id: id!, mode };
    },
    onSuccess: ({ id: savedId, mode }) => {
      if (mode === "completed") setCompletedSaleId(savedId);
      invalidate();
      if (mode === "completed") {
        setStep("done");
        onCompleted?.();
      } else {
        toast.success("Sale saved as draft");
        onClose();
      }
    },
    onError: (error: Error) => {
      toast.error(
        /duplicate key/i.test(error.message)
          ? "This appointment has already been checked out."
          : error.message,
      );
    },
  });

  function requestClose() {
    if (step !== "done" && lines.length && !persist.isPending) setConfirmDiscard(true);
    else onClose();
  }

  if (!open) return null;

  // ── Left pane ──
  const crumbs = (
    <div className="flex items-center gap-2 text-body">
      {(["cart", "tip", "payment"] as const).map((key, index) => (
        <span key={key} className="flex items-center gap-2">
          {index ? <CaretRight size={12} className="text-muted-foreground" /> : null}
          <button
            type="button"
            disabled={step === "done" || (key !== "cart" && !lines.length)}
            onClick={() => setStep(key)}
            className={cn(
              "capitalize",
              step === key
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {key}
          </button>
        </span>
      ))}
    </div>
  );

  const term = search.trim().toLowerCase();
  const visibleServices = services.filter(
    (service) => !term || service.name.toLowerCase().includes(term),
  );

  let leftPane: React.ReactNode;
  if (step === "done") {
    leftPane = (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <CheckCircle size={72} weight="fill" className="text-primary" />
        <h1 className="mt-6 text-[2rem] font-semibold tracking-tight">Sale completed</h1>
        <p className="mt-2 text-body text-muted-foreground">
          {money(toPay)} paid
          {payments.length
            ? ` by ${payments.map((payment) => (payment.gift ? `gift card ${payment.gift.code}` : METHOD_LABEL[payment.method])).join(" + ")}`
            : ""}
        </p>
        {issuedCodes.length ? (
          <div className="mt-6 rounded-xl bg-secondary px-6 py-4">
            <p className="text-body font-semibold">Gift card code{issuedCodes.length > 1 ? "s" : ""}</p>
            {issuedCodes.map((code) => (
              <p key={code} className="mt-1 font-mono text-title font-semibold tracking-widest">
                {code}
              </p>
            ))}
            <p className="mt-1 text-caption text-muted-foreground">Give this code to the client. It's also in Sales → Gift cards sold.</p>
          </div>
        ) : null}
        <div className="mt-8 flex gap-2">
          {completedSaleId ? (
            <button
              type="button"
              onClick={() => window.open(`/receipt/${completedSaleId}`, "_blank", "noopener")}
              className={cn(pill, "border border-input bg-card hover:bg-secondary")}
            >
              Print receipt
            </button>
          ) : null}
          <button type="button" onClick={onClose} className={cn(pill, "bg-ink text-ink-foreground")}>
            Done
          </button>
        </div>
      </div>
    );
  } else if (step === "cart") {
    leftPane = (
      <>
        {crumbs}
        {browse ? (
          <button
            type="button"
            onClick={() => setBrowse(null)}
            className="mt-4 inline-flex items-center gap-2 text-body font-medium hover:underline"
          >
            <ArrowLeft size={14} /> Back
          </button>
        ) : null}
        <h1 className="mt-3 text-display font-semibold">
          {browse === "services"
            ? "Services"
            : browse === "products"
              ? "Products"
              : browse === "packages"
                ? "Packages"
                : browse === "memberships"
                  ? "Memberships"
                  : browse === "appointments"
              ? "Appointments"
              : "Add to cart"}
        </h1>
        {browse !== "appointments" ? (
          <label className="mt-6 flex h-12 items-center gap-3 rounded-lg border border-border px-4 focus-within:border-primary">
            <MagnifyingGlass size={18} className="text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              className="h-full flex-1 bg-transparent text-body outline-none placeholder:text-placeholder"
            />
          </label>
        ) : null}

        {browse === "appointments" ? (
          <div className="mt-6 space-y-2">
            {sellable.length === 0 ? (
              <p className="py-10 text-center text-body text-muted-foreground">
                No unpaid appointments to check out.
              </p>
            ) : (
              sellable.map((appointment) => (
                <button
                  key={appointment.id}
                  type="button"
                  onClick={() => addAppointment(appointment)}
                  className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left hover:bg-secondary"
                >
                  <span>
                    <span className="block text-body font-semibold">
                      {appointment.label}
                    </span>
                    <span className="block text-caption text-muted-foreground">
                      {appointment.when} ·{" "}
                      {appointment.lines.map((line) => line.description).join(", ")}
                    </span>
                  </span>
                  <span className="text-body font-medium">
                    {money(appointment.lines.reduce((sum, line) => sum + line.price, 0))}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : browse === "packages" || browse === "memberships" ? (
          <div className="mt-6 space-y-1">
            {browse === "packages"
              ? sellables.packages
                  .filter((pkg) => !term || pkg.name.toLowerCase().includes(term))
                  .map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => addExtra(pkg.name, Number(pkg.price), { kind: "package", packageId: pkg.id })}
                      className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left hover:bg-secondary"
                    >
                      <span>
                        <span className="block text-body">{pkg.name}</span>
                        <span className="block text-caption text-muted-foreground">
                          {pkg.package_items.map((i) => `${i.sessions}× ${i.services?.name ?? "service"}`).join(", ")}
                        </span>
                      </span>
                      <span className="text-body">{money(Number(pkg.price))}</span>
                    </button>
                  ))
              : sellables.memberships
                  .filter((m) => !term || m.name.toLowerCase().includes(term))
                  .map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => addExtra(m.name, Number(m.price), { kind: "membership", membershipId: m.id })}
                      className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left hover:bg-secondary"
                    >
                      <span>
                        <span className="block text-body">{m.name}</span>
                        <span className="block text-caption text-muted-foreground">
                          {Number(m.discount_percent)}% off services for {m.duration_days} days
                        </span>
                      </span>
                      <span className="text-body">{money(Number(m.price))}</span>
                    </button>
                  ))}
            {(browse === "packages" ? sellables.packages : sellables.memberships).length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">
                None set up yet. Add them in Catalog → {browse === "packages" ? "Packages" : "Memberships"}.
              </p>
            ) : null}
            <p className="pt-3 text-caption text-muted-foreground">Add a client to the sale: {browse} are saved to their profile.</p>
          </div>
        ) : browse === "products" ? (
          <div className="mt-6 space-y-1">
            {products
              .filter((product) => !term || product.name.toLowerCase().includes(term))
              .map((product) => {
                const inCart = lines.filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.quantity, 0);
                const left = product.stock_quantity - inCart;
                const out = product.track_stock && left <= 0;
                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={out}
                    onClick={() => addProduct(product)}
                    className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left hover:bg-secondary disabled:opacity-50"
                  >
                    <span>
                      <span className="block text-body">{product.name}</span>
                      <span className={cn("block text-caption", out ? "text-destructive" : "text-muted-foreground")}>
                        {product.track_stock ? (out ? "Out of stock" : `${left} in stock`) : "Stock not tracked"}
                      </span>
                    </span>
                    <span className="text-body">{money(Number(product.retail_price))}</span>
                  </button>
                );
              })}
            {products.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">No products yet. Add them in Catalog → Products.</p>
            ) : null}
          </div>
        ) : browse === "services" || term ? (
          <div className="mt-6 space-y-6">
            {[
              ...categories.map((category) => ({
                ...category,
                items: visibleServices.filter((service) => service.category_id === category.id),
              })),
              {
                id: "other",
                name: "Other services",
                color: null,
                items: visibleServices.filter(
                  (service) => !categories.some((category) => category.id === service.category_id),
                ),
              },
            ]
              .filter((group) => group.items.length)
              .map((group) => (
                <div key={group.id}>
                  <p className="mb-2 text-heading font-semibold">{group.name}</p>
                  {group.items.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => addService(service)}
                      className="flex w-full items-start justify-between rounded-lg py-3 pl-4 pr-3 text-left hover:bg-secondary"
                      style={{ boxShadow: `inset 3px 0 0 ${group.color || "#a5d8f3"}` }}
                    >
                      <span>
                        <span className="block text-body">{service.name}</span>
                        <span className="block text-caption text-muted-foreground">
                          {service.duration_minutes}min
                        </span>
                      </span>
                      <span className="text-body">{money(Number(service.price ?? 0))}</span>
                    </button>
                  ))}
                </div>
              ))}
            {visibleServices.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">Nothing matches your search.</p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {(
                [
                  ["appointments", "Appointments", CalendarCheck],
                  ["services", "Services", ClipboardText],
                  ["products", "Products", Package],
                  ["packages", "Packages", Stack],
                  ["memberships", "Memberships", Crown],
                  ["gift-cards", "Gift cards", Gift],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === "gift-cards") setGiftSellOpen(true);
                    else setBrowse(key);
                  }}
                  className="flex h-24 flex-col justify-between rounded-xl border border-border p-4 text-left hover:bg-secondary"
                >
                  <Icon size={20} />
                  <span className="text-body font-medium">{label}</span>
                </button>
              ))}
            </div>
            <div className="mt-8 flex items-center justify-between">
              <p className="text-heading font-semibold">Quick sale</p>
              <button
                type="button"
                onClick={() => toast("Choose quick sale items in Settings → Sales")}
                className="text-body font-medium text-primary hover:underline"
              >
                Edit
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {services.slice(0, 8).map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => addService(service)}
                  className="flex h-28 flex-col justify-center rounded-xl border border-border pl-5 pr-3 text-left hover:bg-secondary"
                  style={{ boxShadow: `inset 6px 0 0 ${colorFor(service.id)}` }}
                >
                  <span className="text-body font-medium">{service.name}</span>
                  <span className="text-body text-muted-foreground">
                    {money(Number(service.price ?? 0))}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </>
    );
  } else if (step === "tip") {
    leftPane = (
      <>
        {crumbs}
        <h1 className="mt-3 text-display font-semibold">Select tip</h1>
        <p className="mt-6 text-body">Select an amount for {staffNames || "your team"}</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {TIP_OPTIONS.map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => setTip(percent)}
              className={cn(
                "flex aspect-[1.1] flex-col items-center justify-center rounded-xl border text-center",
                tip === percent
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:bg-secondary",
              )}
            >
              <span className="text-heading font-semibold">
                {percent ? `${percent}%` : "No tip"}
              </span>
              {percent ? (
                <span className="text-body text-muted-foreground">
                  {money(Math.round(tipBase * percent) / 100)}
                </span>
              ) : null}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTip("custom")}
            className={cn(
              "flex aspect-[1.1] flex-col items-center justify-center gap-2 rounded-xl border",
              tip === "custom"
                ? "border-primary ring-1 ring-primary"
                : "border-border hover:bg-secondary",
            )}
          >
            <PlusCircle size={20} />
            <span className="text-heading font-semibold">Custom tip</span>
          </button>
        </div>
        {tip === "custom" ? (
          <label className="mt-4 flex h-12 max-w-xs items-center gap-2 rounded-lg border border-border px-4">
            <span className="text-muted-foreground">{currency}</span>
            <input
              autoFocus
              inputMode="decimal"
              value={customTip}
              onChange={(event) => setCustomTip(event.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0.00"
              className="h-full w-full bg-transparent outline-none"
            />
          </label>
        ) : null}
      </>
    );
  } else {
    leftPane = (
      <>
        {crumbs}
        <h1 className="mt-3 text-display font-semibold">Select payment</h1>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {(
            [
              ["cash", "Cash", Money, "text-[#1f8a3e]"],
              ["card", "Card", CreditCard, "text-[#2d76ec]"],
              ["gift", "Redeem gift", Gift, "text-[#1f8a3e]"],
              ["split", "Split payment", Receipt, "text-foreground"],
              ["other", "Other", CurrencyCircleDollar, "text-primary"],
            ] as const
          ).map(([key, label, Icon, tone]) => (
            <button
              key={key}
              type="button"
              disabled={leftToPay <= 0}
              onClick={() => {
                if (key === "gift") setRedeemOpen(true);
                else if (key === "split") {
                  setSplitMode(true);
                  toast("Split payment: add each part with Cash, Card or Other");
                } else setAmountModal(key);
              }}
              className={cn(
                "flex aspect-[1.1] flex-col items-center justify-center gap-2 rounded-xl border text-body",
                key === "split" && splitMode
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:bg-secondary",
                "disabled:opacity-40",
              )}
            >
              <Icon size={24} className={tone} />
              {label}
            </button>
          ))}
        </div>
        {payments.length ? (
          <div className="mt-8">
            <p className="mb-2 text-heading font-semibold">Payments</p>
            {payments.map((payment) => (
              <div
                key={payment.key}
                className="flex items-center justify-between border-b border-border py-3 text-body"
              >
                <span>{payment.gift ? `Gift card ${payment.gift.code}` : METHOD_LABEL[payment.method]}</span>
                <span className="flex items-center gap-3">
                  {money(payment.amount)}
                  <button
                    type="button"
                    aria-label="Remove payment"
                    onClick={() =>
                      setPayments((current) => current.filter((entry) => entry.key !== payment.key))
                    }
                    className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
                  >
                    <X size={14} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </>
    );
  }

  // ── Right pane ──
  const clientBox = clientPicker ? (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between">
        <p className="text-heading font-semibold">Select a client</p>
        <button
          type="button"
          aria-label="Close"
          onClick={() => setClientPicker(false)}
          className="rounded-full p-1 hover:bg-secondary"
        >
          <X size={16} />
        </button>
      </div>
      <label className="mt-3 flex h-11 items-center gap-2 rounded-lg border-2 border-primary/70 px-3">
        <MagnifyingGlass size={16} />
        <input
          autoFocus
          value={clientQuery}
          onChange={(event) => setClientQuery(event.target.value)}
          placeholder="Search client or leave empty"
          className="h-full flex-1 bg-transparent text-body outline-none"
        />
      </label>
      <div className="mt-2 max-h-64 overflow-y-auto">
        <button
          type="button"
          onClick={() => {
            setClientId(null);
            setClientPicker(false);
          }}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-secondary"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-accent text-primary">
            <UserPlus size={18} />
          </span>
          <span className="text-body font-semibold">Walk-In</span>
        </button>
        {clients
          .filter((row) => {
            const value = clientQuery.trim().toLowerCase();
            return (
              !value ||
              [personName(row), row.email, row.phone]
                .filter(Boolean)
                .some((text) => text!.toLowerCase().includes(value))
            );
          })
          .map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                setClientId(row.id);
                setClientPicker(false);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-secondary"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-accent font-semibold text-primary">
                {row.first_name[0]}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-body font-semibold">
                  {personName(row)}
                </span>
                <span className="block truncate text-caption text-muted-foreground">
                  {row.email || row.phone}
                </span>
              </span>
            </button>
          ))}
      </div>
    </div>
  ) : (
    <button
      type="button"
      disabled={step === "done"}
      onClick={() => setClientPicker(true)}
      className="flex w-full items-center justify-between rounded-2xl border border-border px-5 py-5 text-left hover:bg-secondary/60"
    >
      <span>
        <span className="block text-heading font-semibold">
          {client ? personName(client) : "Add client"}
        </span>
        <span className="block text-body text-muted-foreground">
          {client ? client.email || client.phone || "Client" : "Leave empty for walk-ins"}
        </span>
      </span>
      <span className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
        {client ? (
          <span className="text-lg font-semibold">{client.first_name[0]}</span>
        ) : (
          <UserPlus size={24} />
        )}
      </span>
    </button>
  );

  const primary =
    step === "cart" || step === "tip" ? (
      <button
        type="button"
        disabled={!lines.length}
        onClick={() => setStep(step === "cart" ? "tip" : "payment")}
        className={cn(pill, "flex-1 bg-ink text-ink-foreground hover:bg-ink/90")}
      >
        Continue to payment
      </button>
    ) : step === "payment" ? (
      leftToPay <= 0 && payments.length ? (
        <button
          type="button"
          disabled={persist.isPending}
          onClick={() => persist.mutate("completed")}
          className={cn(pill, "flex-1 bg-ink text-ink-foreground hover:bg-ink/90")}
        >
          {persist.isPending ? "Completing…" : "Complete sale"}
        </button>
      ) : (
        <button
          type="button"
          disabled={persist.isPending}
          onClick={() => persist.mutate("draft")}
          className={cn(pill, "flex-1 border border-input bg-card hover:bg-secondary")}
        >
          Save unpaid
        </button>
      )
    ) : null;

  return (
    <div className="fixed inset-0 z-[65] flex bg-card animate-in fade-in-0 duration-150">
      <button
        type="button"
        aria-label="Close checkout"
        onClick={requestClose}
        className="absolute left-4 top-4 z-10 flex size-11 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-secondary"
      >
        <X size={18} />
      </button>

      <main className="min-w-0 flex-1 overflow-y-auto px-6 pb-10 pt-20 sm:px-12 lg:pt-8 lg:pl-24">
        <div className="mx-auto max-w-[40rem]">{leftPane}</div>
      </main>

      <aside className="hidden w-[30rem] shrink-0 flex-col border-l border-border md:flex">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-8">
          {clientBox}
          <div className="mt-6 space-y-2">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center py-24 text-center">
                <ShoppingCartSimple size={44} weight="duotone" className="text-primary" />
                <p className="mt-4 text-heading font-semibold">Your cart is empty</p>
                <p className="mt-1 max-w-xs text-body text-muted-foreground">
                  Tap an item to add to cart or add an existing client for smart recommendations
                </p>
              </div>
            ) : (
              lines.map((line) => (
                <div
                  key={line.key}
                  className="group flex items-start justify-between gap-3 rounded-lg py-3 pl-4 pr-3 hover:bg-secondary/60"
                  style={{ boxShadow: `inset 3px 0 0 ${colorFor(line.serviceId)}` }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-heading font-medium">
                      {line.description}
                      {line.quantity > 1 ? ` × ${line.quantity}` : ""}
                    </p>
                    {step !== "done" && line.price > 0 && !line.extra && sessionsLeftFor(line.serviceId) ? (
                      <button
                        type="button"
                        onClick={() => {
                          const found = sessionsLeftFor(line.serviceId)!;
                          setLines((current) =>
                            current.map((entry) =>
                              entry.key === line.key
                                ? { ...entry, price: 0, quantity: 1, description: `${entry.description} (package)`, extra: { kind: "package_session", clientPackageItemId: found.item.id } }
                                : entry,
                            ),
                          );
                        }}
                        className="mt-1 rounded-full bg-accent px-2 py-0.5 text-caption font-semibold text-primary hover:bg-accent/70"
                      >
                        Use package session ({sessionsLeftFor(line.serviceId)!.left} left)
                      </button>
                    ) : null}
                    <p className="truncate text-body text-muted-foreground">
                      {[
                        line.durationMinutes ? `${line.durationMinutes}min` : null,
                        line.teamMemberId ? memberById.get(line.teamMemberId)?.first_name : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {step !== "done" ? (
                    <span className="hidden items-center gap-1 group-hover:flex">
                      <button
                        type="button"
                        aria-label="Edit item"
                        onClick={() => setEditLine(line)}
                        className="rounded-full p-1.5 hover:bg-card"
                      >
                        <PencilSimple size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label="Remove item"
                        onClick={() =>
                          setLines((current) => current.filter((entry) => entry.key !== line.key))
                        }
                        className="rounded-full p-1.5 hover:bg-card"
                      >
                        <Trash size={16} />
                      </button>
                    </span>
                  ) : null}
                  <span className="text-heading font-medium tabular-nums group-hover:hidden">
                    {money(line.price * line.quantity)}
                  </span>
                </div>
              ))
            )}
            {benefits?.membership && lines.length && (step === "cart" || step === "tip") && discount === 0 ? (
              <button
                type="button"
                onClick={() => {
                  const services = lines.filter((l) => l.serviceId).reduce((sum, l) => sum + l.price * l.quantity, 0);
                  const amount = Math.round(services * benefits.membership!.discount_percent) / 100;
                  if (amount > 0) {
                    setDiscount(amount);
                    setDiscountScope("services");
                    toast.success(`${benefits.membership!.name}: ${benefits.membership!.discount_percent}% off services applied`);
                  } else toast("There are no services in the cart to discount");
                }}
                className="mt-2 flex w-full items-center gap-3 rounded-xl bg-accent px-4 py-3 text-left text-body"
              >
                <Crown size={20} className="text-primary" />
                <span className="flex-1">
                  <span className="block font-semibold">{benefits.membership.name}</span>
                  <span className="block text-caption text-muted-foreground">Apply {benefits.membership.discount_percent}% off services</span>
                </span>
              </button>
            ) : null}
            {lines.length && step !== "cart" && step !== "done" ? (
              <button
                type="button"
                onClick={() => setStep("cart")}
                className="mt-2 inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-body font-medium hover:bg-secondary"
              >
                <ShoppingCartSimple size={16} /> Add to cart
              </button>
            ) : null}
          </div>
        </div>
        <div className="border-t border-border px-6 pb-5 pt-3">
          {toPayOpen ? (
            <div className="space-y-1 border-b border-border pb-3 text-caption text-muted-foreground">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              {discount ? (
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span>-{money(discount)}</span>
                </div>
              ) : null}
              {tipAmount ? (
                <div className="flex justify-between">
                  <span>Tip</span>
                  <span>{money(tipAmount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span>Tax (included)</span>
                <span>{money(taxTotal)}</span>
              </div>
              {paid ? (
                <div className="flex justify-between">
                  <span>Paid</span>
                  <span>-{money(paid)}</span>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex justify-between text-caption text-muted-foreground">
              <span>Total</span>
              <span>{money(toPay)}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setToPayOpen((value) => !value)}
            className="flex w-full items-center justify-between py-1"
          >
            <span className="flex items-center gap-1 text-body font-semibold">
              {paid ? "Left to pay" : "To pay"}{" "}
              {toPayOpen ? (
                <CaretDown size={12} weight="bold" />
              ) : (
                <CaretRight size={12} weight="bold" />
              )}
            </span>
            <span className="text-body font-semibold">
              {money(step === "done" ? 0 : leftToPay)}
            </span>
          </button>
          {step !== "done" ? (
            <div className="mt-3 flex gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open options"
                    className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border hover:bg-secondary"
                  >
                    <DotsThreeVertical size={20} weight="bold" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-60 rounded-xl p-1.5">
                  <DropdownMenuLabel className="px-3 pb-1 pt-2 text-heading font-semibold">
                    Quick actions
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={() => setStep("tip")}
                    className="gap-3 rounded-lg px-3 py-2 text-body"
                  >
                    <Money size={18} /> Add tip
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setPrompt("discount")}
                    className="gap-3 rounded-lg px-3 py-2 text-body"
                  >
                    <Tag size={18} /> Add cart discount
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setPrompt("note")}
                    className="gap-3 rounded-lg px-3 py-2 text-body"
                  >
                    <Receipt size={18} /> Add receipt note
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => toast("Service charges are set up in Settings → Sales")}
                    className="gap-3 rounded-lg px-3 py-2 text-body"
                  >
                    <CurrencyCircleDollar size={18} /> Add service charge
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={!lines.length}
                    onSelect={() => persist.mutate("draft")}
                    className="rounded-lg px-3 py-2 text-body"
                  >
                    Save as draft
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setConfirmDiscard(true)}
                    className="rounded-lg px-3 py-2 text-body text-destructive focus:text-destructive"
                  >
                    Cancel sale
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {primary}
            </div>
          ) : null}
        </div>
      </aside>

      {/* Amount keypad (Cash / Card / Other) */}
      <GiftCardSellDialog
        open={giftSellOpen}
        currency={currency}
        onClose={() => setGiftSellOpen(false)}
        onAdd={(value, extra) => addExtra(`Gift card${extra.recipientName ? ` for ${extra.recipientName}` : ""}`, value, extra)}
      />
      <RedeemGiftDialog
        open={redeemOpen}
        businessId={businessId}
        maxAmount={leftToPay}
        usedCardIds={payments.filter((p) => p.gift).map((p) => p.gift!.giftCardId)}
        money={money}
        onClose={() => setRedeemOpen(false)}
        onRedeem={(amount, gift) => setPayments((current) => [...current, { key: lineKey(), method: "other", amount, gift }])}
      />
      {amountModal ? (
        <AmountModal
          method={amountModal}
          suggested={leftToPay}
          currency={currency}
          money={money}
          receivedBy={staffNames.split(", ")[0] || "you"}
          onClose={() => setAmountModal(null)}
          onAdd={(amount) => {
            setPayments((current) => [...current, { key: lineKey(), method: amountModal, amount }]);
            setAmountModal(null);
          }}
        />
      ) : null}

      {/* Edit cart item */}
      <Dialog open={Boolean(editLine)} onOpenChange={(next) => !next && setEditLine(null)}>
        <DialogContent overlayClassName="z-[75]" className="z-[80] max-w-md rounded-2xl p-6">
          <DialogTitle className="text-xl font-semibold">Edit item</DialogTitle>
          <DialogDescription className="sr-only">
            Change price, quantity or team member for this item.
          </DialogDescription>
          {editLine ? (
            <div className="mt-2 space-y-4">
              <p className="text-body font-medium">{editLine.description}</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-body font-semibold">
                  Price
                  <input
                    inputMode="decimal"
                    value={String(editLine.price)}
                    onChange={(event) =>
                      setEditLine({
                        ...editLine,
                        price: Number(event.target.value.replace(/[^\d.]/g, "")) || 0,
                      })
                    }
                    className="mt-1 h-11 w-full rounded-lg border border-border px-3 font-normal"
                  />
                </label>
                <label className="text-body font-semibold">
                  Quantity
                  <input
                    inputMode="numeric"
                    value={String(editLine.quantity)}
                    disabled={Boolean(editLine.appointmentItemId)}
                    onChange={(event) =>
                      setEditLine({
                        ...editLine,
                        quantity: Math.max(1, Number(event.target.value.replace(/\D/g, "")) || 1),
                      })
                    }
                    className="mt-1 h-11 w-full rounded-lg border border-border px-3 font-normal disabled:bg-muted"
                  />
                </label>
              </div>
              <label className="block text-body font-semibold">
                Team member
                <select
                  value={editLine.teamMemberId ?? ""}
                  onChange={(event) =>
                    setEditLine({ ...editLine, teamMemberId: event.target.value || null })
                  }
                  className="mt-1 h-11 w-full rounded-lg border border-border bg-card px-3 font-normal"
                >
                  <option value="">No team member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {personName(member)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setLines((current) =>
                    current.map((line) => (line.key === editLine.key ? editLine : line)),
                  );
                  setEditLine(null);
                }}
                className={cn(pill, "w-full bg-ink text-ink-foreground")}
              >
                Apply
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Cart discount / receipt note */}
      <Dialog
        open={prompt === "discount" || prompt === "note"}
        onOpenChange={(next) => !next && setPrompt(null)}
      >
        <DialogContent overlayClassName="z-[75]" className="z-[80] max-w-md rounded-2xl p-6">
          <DialogTitle className="text-xl font-semibold">
            {prompt === "discount" ? "Add cart discount" : "Add receipt note"}
          </DialogTitle>
          <DialogDescription className="sr-only">Applies to this sale only.</DialogDescription>
          {prompt === "discount" ? (
            <>
              <form
                className="mt-2 flex gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setPromoError(null);
                  const { data, error } = await supabase.rpc("check_deal", { p_code: promoInput });
                  if (error || !data) {
                    const reasons: Record<string, string> = {
                      deal_not_found: "No active deal with that code.",
                      deal_expired: "This code has expired.",
                      deal_not_started: "This code isn't active yet.",
                      deal_used_up: "This code has reached its usage limit.",
                    };
                    const key = Object.keys(reasons).find((k) => error?.message.includes(k));
                    setPromoError(key ? reasons[key]! : "Couldn't check that code.");
                    return;
                  }
                  const deal = data as { code: string; name: string; discount_type: string; value: number; applies_to: string };
                  const base =
                    deal.applies_to === "all" ? subtotal : lines.filter((l) => l.serviceId).reduce((sum, l) => sum + l.price * l.quantity, 0);
                  const amount = Math.min(
                    subtotal,
                    deal.discount_type === "percent" ? Math.round(base * Number(deal.value)) / 100 : Math.min(base, Number(deal.value)),
                  );
                  if (amount <= 0) {
                    setPromoError(deal.applies_to === "all" ? "The cart is empty." : "This code only applies to services.");
                    return;
                  }
                  setDiscount(amount);
                  setDiscountScope(deal.applies_to === "all" ? "all" : "services");
                  setDealCode(deal.code);
                  setPrompt(null);
                  toast.success(`${deal.name}: ${money(amount)} off`);
                }}
              >
                <input
                  value={promoInput}
                  onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
                  placeholder="Promo code"
                  maxLength={20}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-border px-3 font-mono uppercase tracking-wider outline-none focus:border-primary"
                />
                <button type="submit" disabled={promoInput.trim().length < 3} className={cn(pill, "h-11 bg-ink px-5 text-ink-foreground")}>
                  Apply
                </button>
              </form>
              {promoError ? <p className="text-caption text-destructive">{promoError}</p> : null}
              <p className="mt-2 text-caption text-muted-foreground">Or enter an amount:</p>
              <PromptInput
                initial={discount ? String(discount) : ""}
                placeholder="0.00"
                prefix={currency}
                numeric
                onSave={(value) => {
                  setDiscount(Math.min(subtotal, Number(value) || 0));
                  setDiscountScope("all");
                  setDealCode(null);
                  setPrompt(null);
                }}
              />
            </>
          ) : (
            <PromptInput
              initial={receiptNote}
              placeholder="Shown on the receipt"
              onSave={(value) => {
                setReceiptNote(value);
                setPrompt(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Discard draft sale? */}
      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent overlayClassName="z-[75]" className="z-[80] max-w-[30rem] rounded-2xl p-9">
          <DialogTitle className="text-2xl font-semibold">Discard draft sale?</DialogTitle>
          <DialogDescription className="mt-3 text-body text-foreground">
            Your cart won&apos;t be saved. To keep your changes, save this sale as a draft
          </DialogDescription>
          <div className="mt-10 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={persist.isPending}
              onClick={() => {
                setConfirmDiscard(false);
                persist.mutate("draft");
              }}
              className={cn(pill, "border border-input bg-card hover:bg-secondary")}
            >
              Save as draft
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmDiscard(false);
                onClose();
              }}
              className={cn(pill, "bg-[#c8273a] text-white hover:bg-[#b01f31]")}
            >
              Discard
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PromptInput({
  initial,
  placeholder,
  prefix,
  numeric,
  onSave,
}: {
  initial: string;
  placeholder: string;
  prefix?: string;
  numeric?: boolean;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="mt-2 space-y-4">
      <label className="flex h-12 items-center gap-2 rounded-lg border border-border px-4 focus-within:border-primary">
        {prefix ? <span className="text-muted-foreground">{prefix}</span> : null}
        <input
          autoFocus
          inputMode={numeric ? "decimal" : "text"}
          value={value}
          onChange={(event) =>
            setValue(numeric ? event.target.value.replace(/[^\d.]/g, "") : event.target.value)
          }
          placeholder={placeholder}
          className="h-full w-full bg-transparent outline-none"
        />
      </label>
      <button
        type="button"
        onClick={() => onSave(value)}
        className={cn(pill, "w-full bg-ink text-ink-foreground")}
      >
        Save
      </button>
    </div>
  );
}

function AmountModal({
  method,
  suggested,
  currency,
  money,
  receivedBy,
  onClose,
  onAdd,
}: {
  method: Method;
  suggested: number;
  currency: string;
  money: (value: number) => string;
  receivedBy: string;
  onClose: () => void;
  onAdd: (amount: number) => void;
}) {
  const [value, setValue] = useState(String(suggested));
  const amount = Number(value) || 0;
  // Fresha-style quick amounts: exact, then a few "rounded up" notes (₦40 → 45, 50, 60, 100).
  const unit = suggested > 0 ? 10 ** Math.floor(Math.log10(suggested)) : 1;
  const above = (step: number) => Math.ceil((suggested + 0.001) / step) * step;
  const roundUps = [...new Set([suggested, suggested + unit / 2, above(unit), above(unit * 2), above(unit * 10)])]
    .filter((entry) => entry > 0)
    .sort((a, b) => a - b)
    .slice(0, 5);
  const press = (key: string) =>
    setValue((current) => {
      if (key === "back") return current.slice(0, -1);
      if (key === "." && current.includes(".")) return current;
      return current === "0" && key !== "." ? key : current + key;
    });
  const change = Math.max(0, amount - suggested);

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent overlayClassName="z-[75]" className="z-[80] max-w-[24.5rem] rounded-2xl p-9">
        <DialogTitle className="text-lg font-semibold">
          Add {method === "cash" ? "cash" : method} amount
        </DialogTitle>
        <DialogDescription className="sr-only">Enter the amount received.</DialogDescription>
        <div className="mt-4 flex justify-center">
          <span className="border-b-2 border-border pb-1 text-[2.25rem] font-semibold tabular-nums">
            {currency} {value || "0"}
          </span>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {roundUps.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setValue(String(entry))}
              className="shrink-0 rounded-full border border-border px-3 py-1.5 text-caption hover:bg-secondary"
            >
              {money(entry)}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              className="flex h-14 items-center justify-center rounded-full border border-border text-[1.375rem] font-semibold hover:bg-secondary"
            >
              {key === "back" ? <Backspace size={20} /> : key}
            </button>
          ))}
        </div>
        <p className="mt-5 text-caption text-muted-foreground">
          {method === "cash" ? "Cash" : "Payment"} received by ·{" "}
          <span className="text-primary">{receivedBy}</span>
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-heading font-semibold">
            {change > 0
              ? `Change · ${money(change)}`
              : `Left to pay · ${money(Math.max(0, suggested - amount))}`}
          </span>
          <button
            type="button"
            disabled={amount <= 0}
            onClick={() => onAdd(Math.min(amount, suggested))}
            className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-body font-semibold text-ink-foreground disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
