import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, CaretDown, Export, Funnel, MagnifyingGlass } from "@phosphor-icons/react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/use-business";
import { businessLocale, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ItemRow = {
  start_time: string;
  end_time: string;
  sort_order: number;
  services: { name: string } | null;
  team_members: { first_name: string | null; last_name: string | null } | null;
};

type AppointmentRow = {
  id: string;
  status: string;
  is_walk_in: boolean;
  created_at: string;
  clients: { id: string; first_name: string | null; last_name: string | null } | null;
  profiles: { full_name: string | null } | null;
  appointment_items: ItemRow[];
};

type FlatRow = {
  id: string;
  ref: string;
  clientId: string | null;
  clientName: string;
  serviceName: string;
  createdBy: string;
  createdAt: Date;
  scheduledAt: Date;
  durationMinutes: number;
  teamMember: string;
  status: string;
};

const PERIODS = [
  { value: "month-to-date", label: "Month to date" },
  { value: "last-7-days", label: "Last 7 days" },
  { value: "last-30-days", label: "Last 30 days" },
  { value: "last-month", label: "Last month" },
  { value: "all-time", label: "All time" },
] as const;

type Period = (typeof PERIODS)[number]["value"];

const SORTS = [
  { value: "scheduled-desc", label: "Scheduled Date (newest first)" },
  { value: "scheduled-asc", label: "Scheduled Date (oldest first)" },
  { value: "created-desc", label: "Created Date (newest first)" },
  { value: "created-asc", label: "Created Date (oldest first)" },
] as const;

type Sort = (typeof SORTS)[number]["value"];

const STATUSES = [
  { value: "booked", label: "Booked" },
  { value: "confirmed", label: "Confirmed" },
  { value: "arrived", label: "Arrived" },
  { value: "started", label: "Started" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No-show" },
  { value: "cancelled", label: "Cancelled" },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fullName(person: { first_name: string | null; last_name: string | null } | null) {
  if (!person) return "—";
  const name = [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
  return name || "—";
}

function periodStart(period: Period, now: Date): Date | null {
  const start = new Date(now);
  switch (period) {
    case "month-to-date":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return start;
    case "last-7-days":
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return start;
    case "last-30-days":
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return start;
    case "last-month":
      start.setDate(1);
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      return start;
    case "all-time":
      return null;
  }
}

function periodEnd(period: Period, now: Date): Date {
  const end = new Date(now);
  if (period === "last-month") {
    end.setDate(1);
    end.setHours(0, 0, 0, 0);
    end.setMilliseconds(-1);
    return end;
  }
  end.setHours(23, 59, 59, 999);
  return end;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SalesAppointmentsList() {
  const { data: business } = useBusiness();
  const businessId = business?.id;

  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("month-to-date");
  const [sort, setSort] = useState<Sort>("scheduled-desc");
  const [excludedStatuses, setExcludedStatuses] = useState<Set<string>>(new Set());

  const appointmentsQuery = useQuery({
    queryKey: ["sales-appointments", businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          `id, status, is_walk_in, created_at,
           clients ( id, first_name, last_name ),
           profiles ( full_name ),
           appointment_items ( start_time, end_time, sort_order,
             services ( name ),
             team_members ( first_name, last_name ) )`,
        )
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AppointmentRow[];
    },
  });

  const locale = businessLocale(business?.country);
  const dateTime = (d: Date) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);

  const rows = useMemo<FlatRow[]>(() => {
    return (appointmentsQuery.data ?? []).map((appt) => {
      const items = [...appt.appointment_items].sort((a, b) => a.sort_order - b.sort_order);
      const first = items[0];
      const scheduledAt = first ? new Date(first.start_time) : new Date(appt.created_at);
      const durationMinutes = items.reduce(
        (sum, item) =>
          sum +
          Math.max(0, Math.round((new Date(item.end_time).getTime() - new Date(item.start_time).getTime()) / 60000)),
        0,
      );
      const serviceNames = [
        ...new Set(items.map((item) => item.services?.name).filter(Boolean) as string[]),
      ];
      const memberNames = [
        ...new Set(items.map((item) => fullName(item.team_members)).filter((n) => n !== "—")),
      ];
      return {
        id: appt.id,
        ref: `#${appt.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
        clientId: appt.clients?.id ?? null,
        clientName: appt.is_walk_in || !appt.clients ? "Walk-In" : fullName(appt.clients),
        serviceName: serviceNames.join(", ") || "—",
        createdBy: appt.profiles?.full_name?.trim() || "—",
        createdAt: new Date(appt.created_at),
        scheduledAt,
        durationMinutes,
        teamMember: memberNames.join(", ") || "—",
        status: appt.status,
      };
    });
  }, [appointmentsQuery.data]);

  const filtered = useMemo(() => {
    const now = new Date();
    const start = periodStart(period, now);
    const end = periodEnd(period, now);
    const query = search.trim().toLowerCase();
    const list = rows.filter((row) => {
      if (excludedStatuses.has(row.status)) return false;
      if (start && row.scheduledAt < start) return false;
      if (row.scheduledAt > end) return false;
      if (query && !row.ref.toLowerCase().includes(query) && !row.clientName.toLowerCase().includes(query))
        return false;
      return true;
    });
    const dir = sort.endsWith("asc") ? 1 : -1;
    const key = sort.startsWith("created") ? "createdAt" : "scheduledAt";
    return [...list].sort((a, b) => dir * (a[key].getTime() - b[key].getTime()));
  }, [rows, search, period, sort, excludedStatuses]);

  const toggleStatus = (value: string) =>
    setExcludedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  const activeFilterCount = excludedStatuses.size;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Appointments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View, filter and export appointments booked by your clients.
          </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="rounded-full">
              Export
              <CaretDown size={14} className="ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-44 p-1.5">
            {["PDF", "CSV", "Excel"].map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => toast(`${format} export — coming soon`)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted/60"
              >
                <Export size={15} className="text-muted-foreground" />
                Export as {format}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-secondary/70 p-3">
        <div className="relative">
          <MagnifyingGlass
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by Reference or Client"
            className="w-64 rounded-full pl-9"
          />
        </div>

        <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
          <SelectTrigger className="w-40 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="rounded-full">
              <Funnel size={14} className="mr-1.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[0.6875rem] font-semibold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-3">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </p>
            <p className="mb-2 px-1 text-xs text-muted-foreground">Uncheck to hide a status.</p>
            <div className="flex flex-col gap-1">
              {STATUSES.map((status) => (
                <label
                  key={status.value}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm hover:bg-muted/60"
                >
                  <Checkbox
                    checked={!excludedStatuses.has(status.value)}
                    onCheckedChange={() => toggleStatus(status.value)}
                  />
                  {status.label}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="ml-auto">
          <Select value={sort} onValueChange={(value) => setSort(value as Sort)}>
            <SelectTrigger className="w-64 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {SORTS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="data-table min-w-[64rem] whitespace-nowrap">
          <thead>
            <tr className="border-b border-border text-[0.8125rem] font-semibold text-foreground">
              <th className="px-5 py-3.5">Ref #</th>
              <th className="px-4 py-3.5">Client</th>
              <th className="px-4 py-3.5">Service</th>
              <th className="px-4 py-3.5">Created by</th>
              <th className="px-4 py-3.5">Created Date</th>
              <th className="px-4 py-3.5">
                <button
                  type="button"
                  onClick={() =>
                    setSort((prev) =>
                      prev === "scheduled-desc" ? "scheduled-asc" : "scheduled-desc",
                    )
                  }
                  className="inline-flex items-center gap-1"
                >
                  Scheduled Date
                  <ArrowDown
                    size={13}
                    className={cn(
                      "transition-transform",
                      sort === "scheduled-asc" && "rotate-180",
                    )}
                  />
                </button>
              </th>
              <th className="px-4 py-3.5">Duration</th>
              <th className="px-5 py-3.5">Team member</th>
            </tr>
          </thead>
          <tbody>
            {appointmentsQuery.isLoading ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                  Loading appointments…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                  No appointments match these filters.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3.5 font-medium text-primary">{row.ref}</td>
                  <td className="px-4 py-3.5">
                    {row.clientId ? (
                      <Link
                        to="/client/$clientId"
                        params={{ clientId: row.clientId }}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.clientName}
                      </Link>
                    ) : (
                      <span className="text-foreground">{row.clientName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-foreground">{row.serviceName}</td>
                  <td className="px-4 py-3.5 text-foreground">{row.createdBy}</td>
                  <td className="px-4 py-3.5 text-foreground">{dateTime(row.createdAt)}</td>
                  <td className="px-4 py-3.5 text-foreground">{dateTime(row.scheduledAt)}</td>
                  <td className="px-4 py-3.5 text-foreground">
                    {row.durationMinutes ? formatDuration(row.durationMinutes) : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-foreground">{row.teamMember}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!appointmentsQuery.isLoading && filtered.length > 0 && (
          <p className="px-5 py-4 text-center text-sm text-muted-foreground">
            Viewing 1 – {filtered.length} of {filtered.length} results
          </p>
        )}
      </div>
    </div>
  );
}
