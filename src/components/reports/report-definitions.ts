import { supabase } from "@/integrations/supabase/client";
import { addDays, isoDay, resolveDay, shiftMinutes, TIME_OFF_TYPES, type ShiftData } from "@/lib/team-shifts";

export type ReportCategory = "Dashboards" | "Sales" | "Finance" | "Appointments" | "Team" | "Clients" | "Inventory";
export const REPORT_CATEGORIES: ReportCategory[] = ["Sales", "Finance", "Appointments", "Team", "Clients", "Inventory"];

export type ColumnFormat = "text" | "number" | "money" | "percent" | "date" | "datetime" | "hours";
export type Column = { key: string; label: string; format?: ColumnFormat };
export type Row = Record<string, string | number | null>;
export type ReportResult = { rows: Row[]; total?: Row };
export type Range = { from: string | null; to: string | null };

export type ReportDef = {
  id: string;
  name: string;
  category: ReportCategory;
  description: string;
  columns: Column[];
  /** Missing = not available yet (needs data Bookly doesn't record). */
  load?: (businessId: string, range: Range) => Promise<ReportResult>;
  /** Shown instead of a table when the report can't run yet. */
  unavailable?: string;
};

const MAX_ROWS = 2000;

function clientName(c: { first_name: string; last_name: string | null } | null | undefined) {
  return c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : "Walk-in";
}
function memberLabel(m: { first_name: string; last_name: string | null } | null | undefined) {
  return m ? [m.first_name, m.last_name].filter(Boolean).join(" ") : "Unassigned";
}
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const sum = (rows: Row[], key: string) => rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);

function within<T extends { gte: (c: string, v: string) => T; lt: (c: string, v: string) => T }>(query: T, column: string, range: Range) {
  let q = query;
  if (range.from) q = q.gte(column, range.from);
  if (range.to) q = q.lt(column, range.to);
  return q;
}

type SaleRow = {
  id: string;
  sale_date: string;
  status: string;
  payment_method: string;
  total: number;
  tip_amount?: number | null;
  clients: { first_name: string; last_name: string | null } | null;
  team_members: { first_name: string; last_name: string | null } | null;
  sale_items: { description: string; price: number; quantity: number; service_id: string | null }[];
};

async function loadSales(businessId: string, range: Range): Promise<SaleRow[]> {
  const { data, error } = await within(
    supabase
      .from("sales")
      .select("*, clients(first_name, last_name), team_members(first_name, last_name), sale_items(description, price, quantity, service_id)")
      .eq("business_id", businessId)
      .in("status", ["completed", "refunded"]),
    "sale_date",
    range,
  )
    .order("sale_date", { ascending: false })
    .limit(MAX_ROWS);
  if (error) throw error;
  return (data ?? []) as unknown as SaleRow[];
}

type ItemRow = {
  id: string;
  start_time: string;
  end_time: string;
  price: number | null;
  team_member_id: string;
  services: { name: string } | null;
  team_members: { first_name: string; last_name: string | null } | null;
  appointments: {
    id: string;
    status: string;
    cancellation_reason?: string | null;
    client_id: string | null;
    created_at: string;
    clients: { first_name: string; last_name: string | null; client_source?: string | null } | null;
  } | null;
};

async function loadAppointmentItems(businessId: string, range: Range): Promise<ItemRow[]> {
  const { data, error } = await within(
    supabase
      .from("appointment_items")
      .select(
        "id, start_time, end_time, price, team_member_id, services(name), team_members(first_name, last_name), appointments(*, clients(first_name, last_name, client_source))",
      )
      .eq("business_id", businessId),
    "start_time",
    range,
  )
    .order("start_time", { ascending: false })
    .limit(MAX_ROWS);
  if (error) throw error;
  return (data ?? []) as unknown as ItemRow[];
}

const STATUS_LABELS: Record<string, string> = {
  booked: "Booked",
  confirmed: "Confirmed",
  arrived: "Arrived",
  started: "Started",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
};

const minutesBetween = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 60000);

/** Shift data for a date range, without the React hook. */
async function loadShiftData(businessId: string, from: string, to: string): Promise<ShiftData> {
  const [hours, schedules, overrides, timeOff, closed] = await Promise.all([
    supabase.from("business_hours").select("day_of_week, is_open, open_time, close_time").eq("business_id", businessId),
    supabase.from("team_schedules").select("id, team_member_id, repeat_weeks, start_date, end_date, weeks").eq("business_id", businessId).lte("start_date", to).or(`end_date.is.null,end_date.gte.${from}`),
    supabase.from("team_shift_overrides").select("id, team_member_id, date, shifts").eq("business_id", businessId).gte("date", from).lte("date", to),
    supabase.from("team_time_off").select("id, team_member_id, start_date, end_date, type, notes").eq("business_id", businessId).lte("start_date", to).gte("end_date", from),
    supabase.from("business_closed_periods").select("id, start_date, end_date, description").eq("business_id", businessId).lte("start_date", to).gte("end_date", from),
  ]);
  const error = hours.error ?? schedules.error ?? overrides.error ?? timeOff.error ?? closed.error;
  if (error) throw error;
  return {
    hours: hours.data ?? [],
    schedules: (schedules.data ?? []) as unknown as ShiftData["schedules"],
    overrides: (overrides.data ?? []) as unknown as ShiftData["overrides"],
    timeOff: timeOff.data ?? [],
    closed: closed.data ?? [],
    available: true,
  };
}

/** Inclusive local day range for shift reports; capped at 92 days, "all time" = last 30 days. */
function dayRange(range: Range) {
  const today = isoDay(new Date());
  const from = range.from ? isoDay(new Date(range.from)) : addDays(today, -29);
  let to = range.to ? addDays(isoDay(new Date(range.to)), -1) : today;
  if (addDays(from, 91) < to) to = addDays(from, 91);
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return { from, to, days };
}

async function activeMembers(businessId: string) {
  const { data, error } = await supabase
    .from("team_members")
    .select("id, first_name, last_name")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export const REPORTS: ReportDef[] = [
  // ─── Dashboards ─────────────────────────────────────────────────────────
  {
    id: "performance-dashboard",
    name: "Performance dashboard",
    category: "Dashboards",
    description: "Key numbers for your business: sales, appointments, clients and online bookings.",
    columns: [
      { key: "metric", label: "Metric" },
      { key: "value", label: "Value" },
    ],
  },

  // ─── Sales ──────────────────────────────────────────────────────────────
  {
    id: "sales-summary",
    name: "Sales summary",
    category: "Sales",
    description: "Sales quantities and value, excluding tips.",
    columns: [
      { key: "type", label: "Type" },
      { key: "sales", label: "Sales qty", format: "number" },
      { key: "items", label: "Items sold", format: "number" },
      { key: "gross", label: "Gross sales", format: "money" },
      { key: "refunds", label: "Refunds", format: "money" },
      { key: "net", label: "Net sales", format: "money" },
    ],
    load: async (businessId, range) => {
      const sales = await loadSales(businessId, range);
      const groups = new Map<string, Row>();
      for (const sale of sales) {
        const seen = new Set<string>();
        for (const item of sale.sale_items) {
          const type = item.service_id ? "Service" : "Other";
          const row = groups.get(type) ?? { type, sales: 0, items: 0, gross: 0, refunds: 0, net: 0 };
          const amount = Number(item.price) * item.quantity;
          if (!seen.has(type)) {
            row["sales"] = Number(row["sales"]) + 1;
            seen.add(type);
          }
          row["items"] = Number(row["items"]) + item.quantity;
          row["gross"] = Number(row["gross"]) + amount;
          if (sale.status === "refunded") row["refunds"] = Number(row["refunds"]) + amount;
          row["net"] = Number(row["gross"]) - Number(row["refunds"]);
          groups.set(type, row);
        }
      }
      const rows = [...groups.values()];
      return {
        rows,
        total: { type: "Total", sales: sales.length, items: sum(rows, "items"), gross: sum(rows, "gross"), refunds: sum(rows, "refunds"), net: sum(rows, "net") },
      };
    },
  },
  {
    id: "sales-list",
    name: "Sales list",
    category: "Sales",
    description: "Every sale in the period.",
    columns: [
      { key: "date", label: "Sale date", format: "datetime" },
      { key: "ref", label: "Sale #" },
      { key: "client", label: "Client" },
      { key: "member", label: "Team member" },
      { key: "items", label: "Items" },
      { key: "payment", label: "Payment" },
      { key: "status", label: "Status" },
      { key: "total", label: "Total", format: "money" },
    ],
    load: async (businessId, range) => {
      const sales = await loadSales(businessId, range);
      const rows = sales.map((s) => ({
        date: s.sale_date,
        ref: s.id.slice(0, 8).toUpperCase(),
        client: clientName(s.clients),
        member: memberLabel(s.team_members),
        items: s.sale_items.map((i) => (i.quantity > 1 ? `${i.description} ×${i.quantity}` : i.description)).join(", "),
        payment: s.payment_method[0]!.toUpperCase() + s.payment_method.slice(1),
        status: s.status === "refunded" ? "Refunded" : "Completed",
        total: Number(s.total),
      }));
      return { rows, total: { date: null, ref: "Total", total: sum(rows.filter((r) => r.status === "Completed"), "total") } };
    },
  },
  {
    id: "sales-by-service",
    name: "Sales by item",
    category: "Sales",
    description: "Which services and items sold, and how much they made.",
    columns: [
      { key: "item", label: "Item" },
      { key: "qty", label: "Items sold", format: "number" },
      { key: "gross", label: "Gross sales", format: "money" },
      { key: "share", label: "% of sales", format: "percent" },
    ],
    load: async (businessId, range) => {
      const sales = (await loadSales(businessId, range)).filter((s) => s.status === "completed");
      const map = new Map<string, Row>();
      for (const s of sales)
        for (const i of s.sale_items) {
          const row = map.get(i.description) ?? { item: i.description, qty: 0, gross: 0, share: 0 };
          row["qty"] = Number(row["qty"]) + i.quantity;
          row["gross"] = Number(row["gross"]) + Number(i.price) * i.quantity;
          map.set(i.description, row);
        }
      const rows = [...map.values()].sort((a, b) => Number(b["gross"]) - Number(a["gross"]));
      const gross = sum(rows, "gross");
      rows.forEach((r) => (r["share"] = gross ? Number(r["gross"]) / gross : 0));
      return { rows, total: { item: "Total", qty: sum(rows, "qty"), gross, share: gross ? 1 : 0 } };
    },
  },
  {
    id: "sales-by-team-member",
    name: "Sales by team member",
    category: "Sales",
    description: "Sales value credited to each team member.",
    columns: [
      { key: "member", label: "Team member" },
      { key: "sales", label: "Sales qty", format: "number" },
      { key: "total", label: "Total sales", format: "money" },
      { key: "average", label: "Average sale", format: "money" },
    ],
    load: async (businessId, range) => {
      const sales = (await loadSales(businessId, range)).filter((s) => s.status === "completed");
      const map = new Map<string, Row>();
      for (const s of sales) {
        const key = memberLabel(s.team_members);
        const row = map.get(key) ?? { member: key, sales: 0, total: 0, average: 0 };
        row["sales"] = Number(row["sales"]) + 1;
        row["total"] = Number(row["total"]) + Number(s.total);
        map.set(key, row);
      }
      const rows = [...map.values()].sort((a, b) => Number(b["total"]) - Number(a["total"]));
      rows.forEach((r) => (r["average"] = Number(r["total"]) / Number(r["sales"])));
      const total = sum(rows, "total");
      return { rows, total: { member: "Total", sales: sales.length, total, average: sales.length ? total / sales.length : 0 } };
    },
  },
  { id: "gift-card-list", name: "Gift card list", category: "Sales", description: "Issued and outstanding gift cards.", columns: [], unavailable: "Gift cards aren't set up in Bookly yet." },
  { id: "memberships-summary", name: "Memberships summary", category: "Sales", description: "Membership performance including benefits.", columns: [], unavailable: "Memberships aren't set up in Bookly yet." },

  // ─── Finance ────────────────────────────────────────────────────────────
  {
    id: "payments-summary",
    name: "Payments summary",
    category: "Finance",
    description: "Payments split by payment method.",
    columns: [
      { key: "method", label: "Payment method" },
      { key: "count", label: "Transactions", format: "number" },
      { key: "amount", label: "Amount", format: "money" },
      { key: "refunds", label: "Refunds", format: "money" },
      { key: "net", label: "Net", format: "money" },
    ],
    load: async (businessId, range) => {
      const sales = await loadSales(businessId, range);
      const map = new Map<string, Row>();
      for (const s of sales) {
        const method = s.payment_method[0]!.toUpperCase() + s.payment_method.slice(1);
        const row = map.get(method) ?? { method, count: 0, amount: 0, refunds: 0, net: 0 };
        row["count"] = Number(row["count"]) + 1;
        row["amount"] = Number(row["amount"]) + Number(s.total);
        if (s.status === "refunded") row["refunds"] = Number(row["refunds"]) + Number(s.total);
        row["net"] = Number(row["amount"]) - Number(row["refunds"]);
        map.set(method, row);
      }
      const rows = [...map.values()];
      return { rows, total: { method: "Total", count: sum(rows, "count"), amount: sum(rows, "amount"), refunds: sum(rows, "refunds"), net: sum(rows, "net") } };
    },
  },
  {
    id: "tips-summary",
    name: "Tips summary",
    category: "Finance",
    description: "Tips collected, by team member.",
    columns: [
      { key: "member", label: "Team member" },
      { key: "count", label: "Tipped sales", format: "number" },
      { key: "tips", label: "Tips", format: "money" },
    ],
    load: async (businessId, range) => {
      const sales = (await loadSales(businessId, range)).filter((s) => s.status === "completed" && Number(s.tip_amount ?? 0) > 0);
      const map = new Map<string, Row>();
      for (const s of sales) {
        const key = memberLabel(s.team_members);
        const row = map.get(key) ?? { member: key, count: 0, tips: 0 };
        row["count"] = Number(row["count"]) + 1;
        row["tips"] = Number(row["tips"]) + Number(s.tip_amount ?? 0);
        map.set(key, row);
      }
      const rows = [...map.values()];
      return { rows, total: { member: "Total", count: sum(rows, "count"), tips: sum(rows, "tips") } };
    },
  },
  { id: "taxes-summary", name: "Taxes summary", category: "Finance", description: "Tax collected on sales.", columns: [], unavailable: "Tax rates aren't set up in Bookly yet." },

  // ─── Appointments ───────────────────────────────────────────────────────
  {
    id: "appointments-summary",
    name: "Appointments summary",
    category: "Appointments",
    description: "Appointments by status, including cancellations and no-shows.",
    columns: [
      { key: "status", label: "Status" },
      { key: "count", label: "Appointments", format: "number" },
      { key: "share", label: "% of total", format: "percent" },
      { key: "value", label: "Value", format: "money" },
    ],
    load: async (businessId, range) => {
      const items = await loadAppointmentItems(businessId, range);
      const byAppointment = new Map<string, { status: string; value: number }>();
      for (const i of items) {
        if (!i.appointments) continue;
        const entry = byAppointment.get(i.appointments.id) ?? { status: i.appointments.status, value: 0 };
        entry.value += Number(i.price ?? 0);
        byAppointment.set(i.appointments.id, entry);
      }
      const map = new Map<string, Row>();
      for (const { status, value } of byAppointment.values()) {
        const label = STATUS_LABELS[status] ?? status;
        const row = map.get(label) ?? { status: label, count: 0, share: 0, value: 0 };
        row["count"] = Number(row["count"]) + 1;
        row["value"] = Number(row["value"]) + value;
        map.set(label, row);
      }
      const rows = [...map.values()].sort((a, b) => Number(b["count"]) - Number(a["count"]));
      const total = byAppointment.size;
      rows.forEach((r) => (r["share"] = total ? Number(r["count"]) / total : 0));
      return { rows, total: { status: "Total", count: total, share: total ? 1 : 0, value: sum(rows, "value") } };
    },
  },
  {
    id: "appointments-list",
    name: "Appointments list",
    category: "Appointments",
    description: "Every appointment in the period.",
    columns: [
      { key: "start", label: "Date", format: "datetime" },
      { key: "client", label: "Client" },
      { key: "service", label: "Service" },
      { key: "member", label: "Team member" },
      { key: "duration", label: "Duration", format: "hours" },
      { key: "source", label: "Booked via" },
      { key: "status", label: "Status" },
      { key: "price", label: "Price", format: "money" },
    ],
    load: async (businessId, range) => {
      const items = await loadAppointmentItems(businessId, range);
      const rows = items.map((i) => ({
        start: i.start_time,
        client: clientName(i.appointments?.clients),
        service: i.services?.name ?? "—",
        member: memberLabel(i.team_members),
        duration: minutesBetween(i.start_time, i.end_time),
        source: i.appointments?.clients?.client_source === "online_booking" ? "Online" : "Calendar",
        status: STATUS_LABELS[i.appointments?.status ?? ""] ?? "—",
        price: Number(i.price ?? 0),
      }));
      return { rows, total: { start: null, client: plural(rows.length, "appointment"), price: sum(rows, "price") } };
    },
  },
  {
    id: "cancellations-no-shows",
    name: "Cancellations & no-shows",
    category: "Appointments",
    description: "Appointments that were cancelled or not attended, with reasons.",
    columns: [
      { key: "start", label: "Date", format: "datetime" },
      { key: "client", label: "Client" },
      { key: "service", label: "Service" },
      { key: "member", label: "Team member" },
      { key: "status", label: "Status" },
      { key: "reason", label: "Reason" },
      { key: "price", label: "Value lost", format: "money" },
    ],
    load: async (businessId, range) => {
      const items = (await loadAppointmentItems(businessId, range)).filter(
        (i) => i.appointments?.status === "cancelled" || i.appointments?.status === "no_show",
      );
      const rows = items.map((i) => ({
        start: i.start_time,
        client: clientName(i.appointments?.clients),
        service: i.services?.name ?? "—",
        member: memberLabel(i.team_members),
        status: STATUS_LABELS[i.appointments!.status]!,
        reason: i.appointments?.cancellation_reason ?? "",
        price: Number(i.price ?? 0),
      }));
      return { rows, total: { start: null, client: plural(rows.length, "appointment"), price: sum(rows, "price") } };
    },
  },
  { id: "waitlist-summary", name: "Waitlist summary", category: "Appointments", description: "Waitlist entries booked and expired.", columns: [], unavailable: "Coming in a later update." },

  // ─── Team ───────────────────────────────────────────────────────────────
  {
    id: "team-appointments",
    name: "Appointments by team member",
    category: "Team",
    description: "Booked time and appointment value per team member.",
    columns: [
      { key: "member", label: "Team member" },
      { key: "appointments", label: "Appointments", format: "number" },
      { key: "booked", label: "Booked time", format: "hours" },
      { key: "value", label: "Value", format: "money" },
    ],
    load: async (businessId, range) => {
      const items = (await loadAppointmentItems(businessId, range)).filter(
        (i) => i.appointments && !["cancelled", "no_show"].includes(i.appointments.status),
      );
      const map = new Map<string, Row>();
      for (const i of items) {
        const key = memberLabel(i.team_members);
        const row = map.get(key) ?? { member: key, appointments: 0, booked: 0, value: 0 };
        row["appointments"] = Number(row["appointments"]) + 1;
        row["booked"] = Number(row["booked"]) + minutesBetween(i.start_time, i.end_time);
        row["value"] = Number(row["value"]) + Number(i.price ?? 0);
        map.set(key, row);
      }
      const rows = [...map.values()].sort((a, b) => Number(b["value"]) - Number(a["value"]));
      return { rows, total: { member: "Total", appointments: sum(rows, "appointments"), booked: sum(rows, "booked"), value: sum(rows, "value") } };
    },
  },
  {
    id: "scheduled-shifts",
    name: "Scheduled shifts",
    category: "Team",
    description: "Scheduled working hours and days per team member (up to 92 days).",
    columns: [
      { key: "member", label: "Team member" },
      { key: "days", label: "Days working", format: "number" },
      { key: "hours", label: "Scheduled time", format: "hours" },
      { key: "off", label: "Days off (time off)", format: "number" },
    ],
    load: async (businessId, range) => {
      const { from, to, days } = dayRange(range);
      const [members, data] = await Promise.all([activeMembers(businessId), loadShiftData(businessId, from, to)]);
      const rows = members.map((m) => {
        let worked = 0;
        let minutes = 0;
        let off = 0;
        for (const day of days) {
          const state = resolveDay(data, m.id, day);
          if (state.kind === "time_off") off += 1;
          const mins = shiftMinutes(state.shifts);
          if (mins > 0) worked += 1;
          minutes += mins;
        }
        return { member: memberLabel(m), days: worked, hours: minutes, off };
      });
      return { rows, total: { member: "Total", days: sum(rows, "days"), hours: sum(rows, "hours"), off: sum(rows, "off") } };
    },
  },
  {
    id: "team-time-off",
    name: "Team time off",
    category: "Team",
    description: "Time off booked for your team.",
    columns: [
      { key: "member", label: "Team member" },
      { key: "type", label: "Type" },
      { key: "start", label: "Start", format: "date" },
      { key: "end", label: "End", format: "date" },
      { key: "days", label: "Days", format: "number" },
      { key: "notes", label: "Notes" },
    ],
    load: async (businessId, range) => {
      const { from, to } = dayRange(range);
      const { data, error } = await supabase
        .from("team_time_off")
        .select("start_date, end_date, type, notes, team_members(first_name, last_name)")
        .eq("business_id", businessId)
        .lte("start_date", to)
        .gte("end_date", from)
        .order("start_date");
      if (error) throw error;
      const rows = (data ?? []).map((t) => ({
        member: memberLabel(t.team_members as unknown as { first_name: string; last_name: string | null } | null),
        type: TIME_OFF_TYPES[t.type] ?? t.type,
        start: t.start_date,
        end: t.end_date,
        days: Math.round((new Date(t.end_date).getTime() - new Date(t.start_date).getTime()) / 86400000) + 1,
        notes: t.notes ?? "",
      }));
      return { rows, total: { member: "Total", days: sum(rows, "days") } };
    },
  },
  { id: "commission-summary", name: "Commission summary", category: "Team", description: "Commission earned by team members.", columns: [], unavailable: "Commissions aren't set up in Bookly yet." },

  // ─── Clients ────────────────────────────────────────────────────────────
  {
    id: "client-summary",
    name: "Client summary",
    category: "Clients",
    description: "New, returning and walk-in clients with appointments in the period.",
    columns: [
      { key: "type", label: "Client type" },
      { key: "clients", label: "Clients", format: "number" },
      { key: "appointments", label: "Appointments", format: "number" },
      { key: "value", label: "Value", format: "money" },
    ],
    load: async (businessId, range) => {
      const items = (await loadAppointmentItems(businessId, range)).filter(
        (i) => i.appointments && !["cancelled", "no_show"].includes(i.appointments.status),
      );
      const clientIds = [...new Set(items.map((i) => i.appointments?.client_id).filter(Boolean))] as string[];
      // A client is "new" if their first ever appointment falls inside this period.
      const firstSeen = new Map<string, string>();
      if (clientIds.length) {
        const { data, error } = await supabase
          .from("appointments")
          .select("client_id, appointment_items(start_time)")
          .in("client_id", clientIds.slice(0, 500));
        if (error) throw error;
        for (const a of data ?? []) {
          for (const it of (a.appointment_items as { start_time: string }[]) ?? []) {
            const prev = firstSeen.get(a.client_id!);
            if (!prev || it.start_time < prev) firstSeen.set(a.client_id!, it.start_time);
          }
        }
      }
      const groups: Record<string, { clients: Set<string>; appointments: Set<string>; value: number }> = {
        New: { clients: new Set(), appointments: new Set(), value: 0 },
        Returning: { clients: new Set(), appointments: new Set(), value: 0 },
        "Walk-in": { clients: new Set(), appointments: new Set(), value: 0 },
      };
      for (const i of items) {
        const cid = i.appointments?.client_id;
        const type = !cid ? "Walk-in" : range.from && (firstSeen.get(cid) ?? "") < range.from ? "Returning" : "New";
        const g = groups[type]!;
        if (cid) g.clients.add(cid);
        g.appointments.add(i.appointments!.id);
        g.value += Number(i.price ?? 0);
      }
      const rows = Object.entries(groups).map(([type, g]) => ({
        type,
        clients: type === "Walk-in" ? g.appointments.size : g.clients.size,
        appointments: g.appointments.size,
        value: g.value,
      }));
      return { rows, total: { type: "Total", clients: sum(rows, "clients"), appointments: sum(rows, "appointments"), value: sum(rows, "value") } };
    },
  },
  {
    id: "client-list",
    name: "Client list",
    category: "Clients",
    description: "All clients added in the period, with how they found you.",
    columns: [
      { key: "name", label: "Client" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "source", label: "Source" },
      { key: "added", label: "Added", format: "date" },
    ],
    load: async (businessId, range) => {
      const { data, error } = await within(
        supabase.from("clients").select("first_name, last_name, email, phone, phone_country_code, client_source, created_at").eq("business_id", businessId),
        "created_at",
        range,
      )
        .order("created_at", { ascending: false })
        .limit(MAX_ROWS);
      if (error) throw error;
      const rows = (data ?? []).map((c) => ({
        name: clientName(c),
        email: c.email ?? "",
        phone: c.phone ? `${c.phone_country_code ?? ""} ${c.phone}`.trim() : "",
        source: (c.client_source ?? "").replaceAll("_", " ").replace(/^\w/, (x) => x.toUpperCase()),
        added: c.created_at,
      }));
      return { rows, total: { name: plural(rows.length, "client") } };
    },
  },

  // ─── Inventory ──────────────────────────────────────────────────────────
  { id: "stock-on-hand", name: "Stock on hand", category: "Inventory", description: "Current stock of each product.", columns: [], unavailable: "Products aren't set up in Bookly yet." },
  { id: "product-list", name: "Product list", category: "Inventory", description: "All products.", columns: [], unavailable: "Products aren't set up in Bookly yet." },
];

export const reportById = (id: string) => REPORTS.find((r) => r.id === id);
