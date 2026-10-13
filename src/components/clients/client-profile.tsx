import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CakeIcon,
  CalendarCheck,
  CaretDown,
  CaretUp,
  ChatCircle,
  GenderIntersex,
  Info,
  Plus,
  Receipt,
  Star,
  Tag,
  UserPlus,
  Wallet,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { CheckoutScreen, type CheckoutStart } from "@/components/sales/checkout-screen";
import { pillButton } from "@/components/sales/list-ui";
import { StatusBadge } from "@/components/home/home-dashboard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";

type ClientRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  phone_country_code: string | null;
  additional_email: string | null;
  additional_phone: string | null;
  gender: string | null;
  pronouns: string | null;
  birth_day: number | null;
  birth_month: number | null;
  birth_year: number | null;
  client_source: string;
  referred_by_client_id: string | null;
  preferred_language: string | null;
  country: string | null;
  occupation: string | null;
  notes: string | null;
  created_at: string;
};

type AppointmentRow = {
  id: string;
  status: string;
  appointment_items: Array<{
    id: string;
    service_id: string;
    team_member_id: string;
    price: number | null;
    start_time: string;
    end_time: string;
    services: { name: string } | null;
    team_members: { first_name: string; last_name: string | null } | null;
  }>;
};

type SaleRow = {
  id: string;
  sale_date: string;
  status: "draft" | "completed" | "refunded";
  total: number;
  appointment_id: string | null;
  sale_items: Array<{
    id: string;
    description: string;
    price: number;
    quantity: number;
    service_id: string | null;
    appointment_item_id: string | null;
  }>;
};

type Section =
  | "overview"
  | "appointments"
  | "sales"
  | "details"
  | "items"
  | "notes"
  | "allergies"
  | "patch-tests"
  | "forms"
  | "files"
  | "wallet"
  | "loyalty"
  | "reviews";

const RECORDS: Array<[Section, string]> = [
  ["notes", "Notes"],
  ["allergies", "Allergies"],
  ["patch-tests", "Patch tests"],
  ["forms", "Client forms"],
  ["files", "Files"],
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const NEEDS_DB = "This needs its own database table, coming with a later update";

const fullName = (person: { first_name: string; last_name: string | null }) =>
  [person.first_name, person.last_name].filter(Boolean).join(" ");

function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-14 text-center">
      <span className="text-primary">{icon}</span>
      <p className="mt-4 text-heading font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-body text-muted-foreground">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function Pills<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<[T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "h-9 rounded-full px-4 text-body font-semibold",
            value === key ? "bg-ink text-ink-foreground" : "hover:bg-card",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-caption font-semibold">{label}</p>
      <p className="text-body text-muted-foreground">{value || "-"}</p>
    </div>
  );
}

export function ClientProfile({
  clientId,
  onClose,
}: {
  clientId: string | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const businessId = business?.id;
  const money = (value: number) =>
    business ? formatMoney(value, business.currency, business.country) : "—";

  const [section, setSection] = useState<Section>("overview");
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [apptFilter, setApptFilter] = useState<
    "all" | "booked" | "confirmed" | "completed" | "cancelled"
  >("all");
  const [saleFilter, setSaleFilter] = useState<"all" | "completed" | "draft" | "refunded">("all");
  const [itemTab, setItemTab] = useState<
    "services" | "products" | "memberships" | "packages" | "gift-cards"
  >("services");
  const [checkout, setCheckout] = useState<CheckoutStart | null>(null);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    if (!clientId) return;
    setSection("overview");
    setRecordsOpen(false);
    setNoteDraft(null);
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    const onKey = (event: KeyboardEvent) => {
      // Let open menus/popovers/dialogs take the Escape first.
      const layerOpen = document.querySelector(
        "[data-radix-popper-content-wrapper], [role=dialog][data-state=open]",
      );
      if (event.key === "Escape" && !checkout && !layerOpen) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clientId, checkout, onClose]);

  const { data: client } = useQuery({
    queryKey: ["client-profile", clientId],
    enabled: Boolean(clientId),
    queryFn: async (): Promise<ClientRow> => {
      const { data, error } = await supabase
        .from("clients")
        .select(
          "id, first_name, last_name, email, phone, phone_country_code, additional_email, additional_phone, gender, pronouns, birth_day, birth_month, birth_year, client_source, referred_by_client_id, preferred_language, country, occupation, notes, created_at",
        )
        .eq("id", clientId!)
        .single();
      if (error) throw error;
      return data as ClientRow;
    },
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["client-appointments", clientId],
    enabled: Boolean(clientId),
    queryFn: async (): Promise<AppointmentRow[]> => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, status, appointment_items(id, service_id, team_member_id, price, start_time, end_time, services(name), team_members(first_name, last_name))",
        )
        .eq("client_id", clientId!);
      if (error) throw error;
      return (data ?? []) as unknown as AppointmentRow[];
    },
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["client-sales-list", clientId],
    enabled: Boolean(clientId),
    queryFn: async (): Promise<SaleRow[]> => {
      const { data, error } = await supabase
        .from("sales")
        .select(
          "id, sale_date, status, total, appointment_id, sale_items(id, description, price, quantity, service_id, appointment_item_id)",
        )
        .eq("client_id", clientId!)
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SaleRow[];
    },
  });

  const { data: tagData } = useQuery({
    queryKey: ["client-tags", businessId, clientId],
    enabled: Boolean(clientId && businessId),
    queryFn: async () => {
      const [tags, assigned] = await Promise.all([
        supabase
          .from("client_tags")
          .select("id, name")
          .eq("business_id", businessId!)
          .order("name"),
        supabase.from("client_tag_assignments").select("id, tag_id").eq("client_id", clientId!),
      ]);
      if (tags.error) throw tags.error;
      if (assigned.error) throw assigned.error;
      return { tags: tags.data ?? [], assigned: assigned.data ?? [] };
    },
  });

  const { data: addresses = [] } = useQuery({
    queryKey: ["client-addresses-view", clientId],
    enabled: Boolean(clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_addresses")
        .select(
          "id, address_name, address_type, street_address, apartment_suite, city, region, postcode, country",
        )
        .eq("client_id", clientId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: referrer } = useQuery({
    queryKey: ["client-referrer", client?.referred_by_client_id],
    enabled: Boolean(client?.referred_by_client_id),
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("first_name, last_name")
        .eq("id", client!.referred_by_client_id!)
        .single();
      return data;
    },
  });

  function refresh() {
    for (const key of ["client-profile", "client-tags", "clients", "client-tags-index"])
      queryClient.invalidateQueries({ queryKey: [key] });
  }

  const saveNote = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase
        .from("clients")
        .update({ notes: value.trim() || null })
        .eq("id", clientId!);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      setNoteDraft(null);
      toast.success("Note saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addTag = useMutation({
    mutationFn: async (input: { tagId?: string; name?: string }) => {
      let tagId = input.tagId;
      if (!tagId && input.name) {
        const { data, error } = await supabase
          .from("client_tags")
          .insert({ business_id: businessId!, name: input.name.trim() })
          .select("id")
          .single();
        if (error) throw error;
        tagId = data.id;
      }
      const { error } = await supabase
        .from("client_tag_assignments")
        .insert({ business_id: businessId!, client_id: clientId!, tag_id: tagId! });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      setNewTag("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeTag = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("client_tag_assignments")
        .delete()
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteClient = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").delete().eq("id", clientId!);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Client deleted");
      setConfirmDelete(false);
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const stats = useMemo(() => {
    const completedSales = sales.filter((sale) => sale.status === "completed");
    return {
      totalSales: completedSales.reduce((sum, sale) => sum + Number(sale.total), 0),
      appointments: appointments.filter((row) => row.status !== "cancelled").length,
      cancelled: appointments.filter((row) => row.status === "cancelled").length,
      noShow: appointments.filter((row) => row.status === "no_show").length,
    };
  }, [sales, appointments]);

  const paidAppointments = new Set(
    sales.filter((sale) => sale.status === "completed").map((sale) => sale.appointment_id),
  );

  if (!clientId) return null;

  const name = client ? fullName(client) : "";
  const assignedTags = (tagData?.assigned ?? []).map((row) => ({
    ...row,
    name: tagData?.tags.find((tag) => tag.id === row.tag_id)?.name ?? "Tag",
  }));
  const unassigned = (tagData?.tags ?? []).filter(
    (tag) => !assignedTags.some((row) => row.tag_id === tag.id),
  );
  const birthday =
    client?.birth_day && client.birth_month
      ? `${client.birth_day} ${MONTHS[client.birth_month - 1]}${client.birth_year ? ` ${client.birth_year}` : ""}`
      : null;
  const joined = client
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
        new Date(client.created_at),
      )
    : "";
  const goEdit = () => navigate({ to: "/client/$clientId", params: { clientId } });

  const sell = () => setCheckout({ clientId });
  const bookNow = () => {
    onClose();
    navigate({ to: "/calendar", search: { book: clientId } as never });
  };

  const navItem = (key: Section, label: string, count?: number) => (
    <button
      key={key}
      type="button"
      onClick={() => setSection(key)}
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-body",
        section === key ? "bg-accent font-medium" : "hover:bg-secondary",
      )}
    >
      {label}
      {count ? (
        <span className="rounded-full bg-secondary px-1.5 text-[0.75rem]">{count}</span>
      ) : null}
    </button>
  );

  // ── Content ──
  let content: React.ReactNode;
  if (section === "overview") {
    content = (
      <>
        <h2 className="text-display font-semibold">Overview</h2>
        <div className="mt-5 flex items-center justify-between">
          <p className="text-heading font-semibold">Wallet</p>
          <button
            type="button"
            onClick={() => setSection("wallet")}
            className="text-body font-medium text-primary hover:underline"
          >
            View wallet
          </button>
        </div>
        <div className="mt-3 rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center justify-between text-body font-semibold">
            Balance <Info size={16} className="text-muted-foreground" />
          </p>
          <p className="mt-2 text-display font-semibold">{money(0)}</p>
        </div>
        <p className="mt-6 text-heading font-semibold">Summary</p>
        <div className="mt-3 rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center justify-between text-body font-semibold">
            Total sales <Info size={16} className="text-muted-foreground" />
          </p>
          <p className="mt-2 text-display font-semibold">{money(stats.totalSales)}</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            ["Appointments", stats.appointments],
            ["Rating", "-"],
            ["Canceled", stats.cancelled],
            ["No show", stats.noShow],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-5">
              <p className="flex items-center justify-between text-body font-semibold">
                {label} <Info size={16} className="text-muted-foreground" />
              </p>
              <p className="mt-2 text-display font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </>
    );
  } else if (section === "appointments") {
    const rows = appointments
      .filter(
        (row) =>
          apptFilter === "all" ||
          row.status === apptFilter ||
          (apptFilter === "cancelled" && row.status === "no_show"),
      )
      .map((row) => ({
        ...row,
        items: [...row.appointment_items].sort((a, b) => a.start_time.localeCompare(b.start_time)),
      }))
      .filter((row) => row.items.length)
      .sort((a, b) => b.items[0]!.start_time.localeCompare(a.items[0]!.start_time));
    let lastMonth = "";
    content = (
      <>
        <h2 className="text-display font-semibold">Appointments</h2>
        <div className="mt-4">
          <Pills
            value={apptFilter}
            onChange={setApptFilter}
            options={[
              ["all", "All"],
              ["booked", "Booked"],
              ["confirmed", "Confirmed"],
              ["completed", "Completed"],
              ["cancelled", "Cancelled"],
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <div className="mt-5">
            <Empty
              icon={<CalendarCheck size={40} weight="duotone" />}
              title="No appointments"
              body="Appointments booked for this client appear here"
            />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {rows.map((row) => {
              const first = new Date(row.items[0]!.start_time);
              const month = new Intl.DateTimeFormat("en-GB", {
                month: "long",
                year: "numeric",
              }).format(first);
              const header = month !== lastMonth ? month : null;
              lastMonth = month;
              const total = row.items.reduce((sum, item) => sum + Number(item.price ?? 0), 0);
              const unpaid =
                !paidAppointments.has(row.id) &&
                !["cancelled", "no_show", "completed"].includes(row.status);
              return (
                <div key={row.id}>
                  {header ? (
                    <p className="mb-2 text-body text-muted-foreground">{header}</p>
                  ) : null}
                  <div className="relative pl-8">
                    <span className="absolute left-0 top-4 flex size-6 items-center justify-center rounded-full bg-ink text-ink-foreground">
                      <CalendarCheck size={13} />
                    </span>
                    <div className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-body font-semibold">Appointment</p>
                          <p className="text-caption text-muted-foreground">
                            {new Intl.DateTimeFormat("en-GB", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                              hourCycle: "h23",
                            }).format(first)}{" "}
                            · {business?.name}
                          </p>
                        </div>
                        <StatusBadge status={row.status} />
                      </div>
                      {row.items.map((item) => (
                        <div key={item.id} className="mt-3 flex justify-between text-body">
                          <span>
                            <span className="block font-medium">
                              {item.services?.name ?? "Service"}
                            </span>
                            <span className="block text-caption text-muted-foreground">
                              {new Intl.DateTimeFormat("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hourCycle: "h23",
                              }).format(new Date(item.start_time))}{" "}
                              ·{" "}
                              {Math.round(
                                (new Date(item.end_time).getTime() -
                                  new Date(item.start_time).getTime()) /
                                  60000,
                              )}{" "}
                              min · {item.team_members ? fullName(item.team_members) : ""}
                            </span>
                          </span>
                          <span className="font-medium">{money(Number(item.price ?? 0))}</span>
                        </div>
                      ))}
                      {unpaid ? (
                        <button
                          type="button"
                          onClick={() =>
                            setCheckout({
                              clientId,
                              appointmentId: row.id,
                              step: "tip",
                              lines: row.items.map((item) => ({
                                key: item.id,
                                serviceId: item.service_id,
                                description: item.services?.name ?? "Service",
                                price: Number(item.price ?? 0),
                                quantity: 1,
                                durationMinutes: Math.round(
                                  (new Date(item.end_time).getTime() -
                                    new Date(item.start_time).getTime()) /
                                    60000,
                                ),
                                teamMemberId: item.team_member_id,
                                appointmentItemId: item.id,
                              })),
                            })
                          }
                          className="mt-4 inline-flex h-9 items-center rounded-full border border-border px-4 text-body font-semibold hover:bg-secondary"
                        >
                          Checkout · {money(total)}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  } else if (section === "sales") {
    const rows = sales.filter((sale) => saleFilter === "all" || sale.status === saleFilter);
    content = (
      <>
        <div className="flex items-center justify-between">
          <h2 className="text-display font-semibold">Sales</h2>
          <button
            type="button"
            onClick={sell}
            className="inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-body font-semibold hover:bg-secondary"
          >
            Sell
          </button>
        </div>
        <div className="mt-4">
          <Pills
            value={saleFilter}
            onChange={setSaleFilter}
            options={[
              ["all", "All"],
              ["completed", "Paid"],
              ["draft", "Drafts"],
              ["refunded", "Refunded"],
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <div className="mt-5">
            <Empty
              icon={<Receipt size={40} weight="duotone" />}
              title="No sales"
              body="No sales have been created with this client"
            />
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {rows.map((sale) => (
              <button
                key={sale.id}
                type="button"
                onClick={() =>
                  sale.status === "draft"
                    ? setCheckout({
                        saleId: sale.id,
                        clientId,
                        appointmentId: sale.appointment_id,
                        step: "payment",
                        lines: sale.sale_items.map((item) => ({
                          key: item.id,
                          serviceId: item.service_id,
                          description: item.description,
                          price: Number(item.price),
                          quantity: item.quantity,
                          durationMinutes: null,
                          teamMemberId: null,
                          appointmentItemId: item.appointment_item_id,
                        })),
                      })
                    : undefined
                }
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left"
              >
                <span>
                  <span className="block text-body font-semibold">
                    Sale #{sale.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="block text-caption text-muted-foreground">
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(sale.sale_date))}{" "}
                    · {sale.sale_items.map((item) => item.description).join(", ")}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-body font-semibold">
                    {money(Number(sale.total))}
                  </span>
                  <span className="block text-caption capitalize text-muted-foreground">
                    {sale.status === "draft" ? "Unpaid" : sale.status}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </>
    );
  } else if (section === "details" && client) {
    content = (
      <>
        <div className="flex items-center justify-between">
          <h2 className="text-display font-semibold">Client details</h2>
          <button
            type="button"
            onClick={goEdit}
            className="inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-body font-semibold hover:bg-secondary"
          >
            Edit
          </button>
        </div>
        <p className="mt-5 text-heading font-semibold">Profile</p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Field label="Full name" value={name} />
          <Field label="Email" value={client.email} />
          <Field
            label="Phone number"
            value={
              client.phone
                ? [client.phone_country_code, client.phone].filter(Boolean).join(" ")
                : null
            }
          />
          <Field label="Date of birth" value={birthday} />
          <Field label="Gender" value={client.gender} />
          <Field label="Pronouns" value={client.pronouns ?? "Not specified"} />
          <Field label="Joined" value={joined} />
        </div>
        <div className="my-6 h-px bg-border" />
        <p className="text-heading font-semibold">Additional info</p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Field label="Client source" value={client.client_source} />
          <Field label="Referred by" value={referrer ? fullName(referrer) : null} />
          <Field label="Preferred language" value={client.preferred_language} />
          <Field label="Country" value={client.country} />
          <Field label="Occupation" value={client.occupation} />
          <Field label="Additional email" value={client.additional_email} />
          <Field label="Additional phone" value={client.additional_phone} />
        </div>
        <p className="mt-5 text-caption font-semibold">Tags</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {assignedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-accent pl-3 pr-1 text-caption text-primary"
            >
              {tag.name}
              <button
                type="button"
                aria-label={`Remove ${tag.name}`}
                onClick={() => removeTag.mutate(tag.id)}
                className="rounded-full p-0.5 hover:bg-white/60"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1 rounded-full border border-border px-3 text-caption hover:bg-secondary"
              >
                <Plus size={12} /> Add tag
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 rounded-xl p-2">
              {unassigned.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => addTag.mutate({ tagId: tag.id })}
                  className="block w-full rounded-lg px-3 py-2 text-left text-body hover:bg-secondary"
                >
                  {tag.name}
                </button>
              ))}
              <form
                className="mt-1 flex gap-2 border-t border-border pt-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (newTag.trim()) addTag.mutate({ name: newTag });
                }}
              >
                <input
                  value={newTag}
                  onChange={(event) => setNewTag(event.target.value)}
                  placeholder="New tag"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-border px-3 text-body"
                />
                <button
                  type="submit"
                  className="h-9 rounded-lg bg-ink px-3 text-caption font-semibold text-ink-foreground"
                >
                  Add
                </button>
              </form>
            </PopoverContent>
          </Popover>
        </div>
        <div className="my-6 h-px bg-border" />
        <p className="text-heading font-semibold">Addresses</p>
        {addresses.length === 0 ? (
          <p className="mt-2 text-body text-muted-foreground">No addresses saved</p>
        ) : (
          <div className="mt-3 space-y-2">
            {addresses.map((address) => (
              <div
                key={address.id}
                className="rounded-xl border border-border bg-card p-4 text-body"
              >
                <p className="font-semibold capitalize">
                  {address.address_name || address.address_type}
                </p>
                <p className="text-muted-foreground">
                  {[
                    address.street_address,
                    address.apartment_suite,
                    address.city,
                    address.region,
                    address.postcode,
                    address.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            ))}
          </div>
        )}
      </>
    );
  } else if (section === "items") {
    const services = sales
      .filter((sale) => sale.status === "completed")
      .flatMap((sale) =>
        sale.sale_items
          .filter((item) => item.service_id)
          .map((item) => ({ ...item, date: sale.sale_date })),
      );
    content = (
      <>
        <h2 className="text-display font-semibold">Items</h2>
        <div className="mt-4">
          <Pills
            value={itemTab}
            onChange={setItemTab}
            options={[
              ["services", "Services"],
              ["products", "Products"],
              ["memberships", "Memberships"],
              ["packages", "Packages"],
              ["gift-cards", "Gift cards"],
            ]}
          />
        </div>
        <div className="mt-5">
          {itemTab === "services" && services.length ? (
            <div className="divide-y divide-border rounded-2xl border border-border bg-card">
              {services.map((item) => (
                <div key={item.id} className="flex justify-between p-4 text-body">
                  <span>
                    <span className="block font-medium">{item.description}</span>
                    <span className="block text-caption text-muted-foreground">
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(item.date))}
                    </span>
                  </span>
                  <span className="font-medium">{money(Number(item.price) * item.quantity)}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={<Tag size={40} weight="duotone" />}
              title={`No ${itemTab.replace("-", " ")}`}
              body={`No ${itemTab.replace("-", " ")} have been sold to this client`}
            />
          )}
        </div>
      </>
    );
  } else if (section === "notes") {
    content = (
      <>
        <div className="flex items-center justify-between">
          <h2 className="text-display font-semibold">Notes</h2>
          <button
            type="button"
            onClick={() => setNoteDraft(client?.notes ?? "")}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-border bg-card px-4 text-body font-semibold hover:bg-secondary"
          >
            <Plus size={14} /> {client?.notes ? "Edit" : "Add"}
          </button>
        </div>
        {noteDraft !== null ? (
          <div className="mt-5 rounded-2xl border border-border bg-card p-4">
            <textarea
              autoFocus
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Add a note visible to your team only"
              className="min-h-40 w-full resize-y rounded-xl border border-border p-3 text-body outline-none focus:border-primary"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNoteDraft(null)}
                className={cn(pillButton, "h-10 hover:bg-secondary")}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveNote.isPending}
                onClick={() => saveNote.mutate(noteDraft)}
                className={cn(pillButton, "h-10 bg-ink text-ink-foreground")}
              >
                Save
              </button>
            </div>
          </div>
        ) : client?.notes ? (
          <div className="mt-5 whitespace-pre-wrap rounded-2xl border border-border bg-card p-5 text-body">
            {client.notes}
          </div>
        ) : (
          <div className="mt-5">
            <Empty
              icon={<ChatCircle size={40} weight="duotone" />}
              title="No notes"
              body="No notes have been created for this client"
            />
          </div>
        )}
      </>
    );
  } else if (
    section === "allergies" ||
    section === "patch-tests" ||
    section === "forms" ||
    section === "files"
  ) {
    const label = RECORDS.find(([key]) => key === section)![1];
    content = (
      <>
        <div className="flex items-center justify-between">
          <h2 className="text-display font-semibold">{label}</h2>
          <button
            type="button"
            onClick={() => toast(NEEDS_DB)}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-border bg-card px-4 text-body font-semibold hover:bg-secondary"
          >
            <Plus size={14} /> Add
          </button>
        </div>
        <div className="mt-5">
          <Empty
            icon={<Info size={40} weight="duotone" />}
            title={`No ${label.toLowerCase()}`}
            body={`No ${label.toLowerCase()} have been added for this client`}
          />
        </div>
      </>
    );
  } else if (section === "wallet") {
    content = (
      <>
        <div className="flex items-center justify-between">
          <h2 className="text-display font-semibold">Wallet</h2>
          <button
            type="button"
            onClick={() => toast("Wallet top-ups and saved cards arrive with online payments")}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-border bg-card px-4 text-body font-semibold hover:bg-secondary"
          >
            Actions <CaretDown size={12} weight="bold" />
          </button>
        </div>
        <p className="mt-4 text-display font-semibold">{money(0)}</p>
        <p className="text-body text-muted-foreground">Available balance.</p>
        <div className="mt-5">
          <Empty
            icon={<Wallet size={40} weight="duotone" />}
            title="No payment methods"
            body="Client cards will appear here."
          />
        </div>
        <p className="mt-6 text-heading font-semibold">Rewards</p>
        <p className="mt-1 text-body text-muted-foreground">
          Loyalty rewards appear here once Client loyalty is set up.
        </p>
      </>
    );
  } else if (section === "loyalty") {
    content = (
      <>
        <h2 className="text-display font-semibold">Loyalty</h2>
        <div className="mt-5">
          <Empty
            icon={<Star size={40} weight="duotone" />}
            title="Loyalty isn't set up"
            body="Reward this client with points, tiers and referrals once Client loyalty is switched on."
            action={
              <button
                type="button"
                onClick={() => navigate({ to: "/clients", search: { tab: "loyalty" } as never })}
                className={cn(pillButton, "h-10 border border-input hover:bg-secondary")}
              >
                Learn about loyalty
              </button>
            }
          />
        </div>
      </>
    );
  } else {
    content = (
      <>
        <h2 className="text-display font-semibold">Reviews</h2>
        <div className="mt-5">
          <Empty
            icon={<Star size={40} weight="duotone" />}
            title="No reviews yet"
            body="Reviews this client leaves after a visit appear here"
          />
        </div>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-background animate-in fade-in-0 duration-150">
      <button
        type="button"
        aria-label="Close client profile"
        onClick={onClose}
        className="absolute left-4 top-4 z-10 flex size-11 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-secondary"
      >
        <X size={18} />
      </button>

      {/* Profile column */}
      <aside className="hidden w-[20rem] shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
          <span className="flex size-24 items-center justify-center rounded-full bg-accent text-[2rem] font-semibold text-primary">
            {client?.first_name[0]?.toUpperCase()}
          </span>
          <p className="mt-4 text-heading font-semibold">{name}</p>
          <p className="text-body text-muted-foreground">{client?.email || client?.phone}</p>
          <div className="mt-5 flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-4 text-body font-semibold hover:bg-secondary data-[state=open]:bg-secondary"
                >
                  Actions <CaretDown size={12} weight="bold" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 rounded-xl p-1.5">
                <DropdownMenuItem
                  onSelect={() => toast("Two-way messaging arrives with Marketing")}
                  className="rounded-lg px-3 py-2 text-body"
                >
                  Messages
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={sell} className="rounded-lg px-3 py-2 text-body">
                  Sell
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => toast(NEEDS_DB)}
                  className="rounded-lg px-3 py-2 text-body"
                >
                  Add staff alert
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setSection("notes");
                    setRecordsOpen(true);
                    setNoteDraft(client?.notes ?? "");
                  }}
                  className="rounded-lg px-3 py-2 text-body"
                >
                  Add simple note
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => toast(NEEDS_DB)}
                  className="rounded-lg px-3 py-2 text-body"
                >
                  Add allergy
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => toast(NEEDS_DB)}
                  className="rounded-lg px-3 py-2 text-body"
                >
                  Add patch test
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setSection("details")}
                  className="rounded-lg px-3 py-2 text-body"
                >
                  Add tag
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => toast("Rewards arrive with Client loyalty")}
                  className="rounded-lg px-3 py-2 text-body"
                >
                  Add reward
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={goEdit}
                  className="rounded-lg px-3 py-2 text-body"
                >
                  Edit client details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => toast("Merging profiles is coming in a later update")}
                  className="rounded-lg px-3 py-2 text-body"
                >
                  Merge profiles
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => toast(NEEDS_DB)}
                  className="rounded-lg px-3 py-2 text-body"
                >
                  Block client
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setConfirmDelete(true)}
                  className="rounded-lg px-3 py-2 text-body text-destructive focus:text-destructive"
                >
                  Delete client
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={bookNow}
              className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-body font-semibold text-ink-foreground hover:bg-ink/90"
            >
              Book now
            </button>
          </div>
        </div>
        <div className="space-y-4 border-t border-border px-6 py-5 text-body">
          <button
            type="button"
            onClick={goEdit}
            className="flex items-center gap-3 text-muted-foreground hover:text-foreground"
          >
            <GenderIntersex size={18} /> {client?.pronouns ?? "Add pronouns"}
          </button>
          <button
            type="button"
            onClick={goEdit}
            className="flex items-center gap-3 text-muted-foreground hover:text-foreground"
          >
            <CakeIcon size={18} /> {birthday ?? "Add date of birth"}
          </button>
          <p className="flex items-center gap-3">
            <UserPlus size={18} /> Created {joined}
          </p>
        </div>
      </aside>

      {/* Section menu */}
      <nav className="w-[13rem] shrink-0 space-y-1 border-r border-border bg-card px-3 pt-20 md:pt-6">
        {navItem("overview", "Overview")}
        {navItem("appointments", "Appointments", appointments.length)}
        {navItem("sales", "Sales")}
        {navItem("details", "Client details")}
        {navItem("items", "Items")}
        <button
          type="button"
          onClick={() => setRecordsOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-body hover:bg-secondary"
        >
          Records {recordsOpen ? <CaretUp size={12} /> : <CaretDown size={12} />}
        </button>
        {recordsOpen ? (
          <div className="space-y-1 pl-3">{RECORDS.map(([key, label]) => navItem(key, label))}</div>
        ) : null}
        {navItem("wallet", "Wallet")}
        {navItem("loyalty", "Loyalty")}
        {navItem("reviews", "Reviews")}
      </nav>

      {/* Content */}
      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-8 sm:px-8">
        <div className="max-w-[36rem]">{content}</div>
      </main>

      {confirmDelete ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal
        >
          <div className="w-full max-w-[30rem] rounded-2xl bg-card p-9">
            <h3 className="text-xl font-semibold">Delete {name}?</h3>
            <p className="mt-3 text-body">
              Their profile is removed. Past appointments and sales stay, shown as walk-ins.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className={cn(pillButton, "h-12 border border-input hover:bg-secondary")}
              >
                Go back
              </button>
              <button
                type="button"
                disabled={deleteClient.isPending}
                onClick={() => deleteClient.mutate()}
                className={cn(pillButton, "h-12 bg-[#c8273a] text-white hover:bg-[#b01f31]")}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CheckoutScreen
        open={checkout !== null}
        start={checkout}
        onClose={() => {
          setCheckout(null);
          queryClient.invalidateQueries({ queryKey: ["client-sales-list", clientId] });
          queryClient.invalidateQueries({ queryKey: ["client-appointments", clientId] });
        }}
      />
    </div>
  );
}
