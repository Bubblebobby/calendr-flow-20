import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarBlank,
  CalendarCheck,
  ChartBar,
  DotsThreeVertical,
  TrendUp,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { formatDuration, formatMoney } from "@/lib/format";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";
import { statusTone } from "@/components/calendar/calendar-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Charts load separately so the rest of the dashboard doesn't wait for the charting library.
const SalesChart = lazy(() => import("./home-charts").then((m) => ({ default: m.SalesChart })));
const UpcomingChart = lazy(() =>
  import("./home-charts").then((m) => ({ default: m.UpcomingChart })),
);

type DashboardItem = {
  id: string;
  appointment_id: string;
  start_time: string;
  end_time: string;
  price: number | null;
  services: { id: string; name: string } | null;
  team_members: { first_name: string; last_name: string | null } | null;
  appointments: {
    id: string;
    status: string;
    is_walk_in: boolean;
    created_at: string;
    clients: { first_name: string; last_name: string | null } | null;
  } | null;
};

type DashboardAppointment = {
  id: string;
  status: string;
  createdAt: string;
  clientName: string;
  start: Date;
  end: Date;
  serviceNames: string[];
  teamNames: string[];
  durationMinutes: number;
};

type ServiceRow = {
  id: string;
  name: string;
};

type SaleRow = {
  id: string;
  total: number;
  sale_date: string;
  team_member_id: string | null;
  team_members: { first_name: string; last_name: string | null } | null;
};

type TimePeriod = "last-7-days" | "last-30-days" | "this-month" | "last-month";

const TIME_PERIODS: Array<{ value: TimePeriod; label: string }> = [
  { value: "last-7-days", label: "Last 7 days" },
  { value: "last-30-days", label: "Last 30 days" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
];

function ChartLegend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-5 text-body text-foreground">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function dateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function periodDates(period: TimePeriod, now: Date) {
  if (period === "last-30-days") {
    return Array.from({ length: 30 }, (_, index) => addDays(now, index - 29));
  }
  if (period === "this-month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayCount = now.getDate();
    return Array.from({ length: dayCount }, (_, index) => addDays(start, index));
  }
  if (period === "last-month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return Array.from({ length: end.getDate() }, (_, index) => addDays(start, index));
  }
  return Array.from({ length: 7 }, (_, index) => addDays(now, index - 6));
}

function clientName(item: DashboardItem) {
  if (item.appointments?.is_walk_in || !item.appointments?.clients) return "Walk-In";
  return [item.appointments.clients.first_name, item.appointments.clients.last_name]
    .filter(Boolean)
    .join(" ");
}

function fullName(person: DashboardItem["team_members"]) {
  return person ? [person.first_name, person.last_name].filter(Boolean).join(" ") : "Team member";
}

function groupAppointments(items: DashboardItem[]): DashboardAppointment[] {
  const grouped = new Map<string, DashboardAppointment>();
  for (const item of items) {
    if (!item.appointments) continue;
    const current = grouped.get(item.appointment_id);
    const start = new Date(item.start_time);
    const end = new Date(item.end_time);
    if (!current) {
      grouped.set(item.appointment_id, {
        id: item.appointment_id,
        status: item.appointments.status,
        createdAt: item.appointments.created_at,
        clientName: clientName(item),
        start,
        end,
        serviceNames: item.services?.name ? [item.services.name] : ["Service"],
        teamNames: [fullName(item.team_members)],
        durationMinutes: Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)),
      });
      continue;
    }
    if (start < current.start) current.start = start;
    if (end > current.end) current.end = end;
    if (item.services?.name && !current.serviceNames.includes(item.services.name)) {
      current.serviceNames.push(item.services.name);
    }
    const member = fullName(item.team_members);
    if (!current.teamNames.includes(member)) current.teamNames.push(member);
    current.durationMinutes += Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  }
  return [...grouped.values()];
}

function DashboardCard({
  title,
  subtitle,
  menu = false,
  action,
  className,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  menu?: boolean;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "flex min-h-[17rem] flex-col overflow-hidden rounded-xl border-border/70 shadow-none",
        className,
      )}
    >
      <CardHeader className="flex-row items-start justify-between space-y-0 px-6 pb-4 pt-6">
        <div className="min-w-0">
          <CardTitle className="text-xl font-semibold leading-7">{title}</CardTitle>
          {subtitle ? (
            <CardDescription className="text-body leading-5">{subtitle}</CardDescription>
          ) : null}
        </div>
        {action ??
          (menu ? (
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 -mt-1 size-9 shrink-0 rounded-full"
              aria-label={`${title} menu`}
              onClick={() => toast("Coming soon")}
            >
              <DotsThreeVertical size={20} weight="bold" />
            </Button>
          ) : null)}
      </CardHeader>
      {children}
    </Card>
  );
}

function TimePeriodFilter({
  value,
  onApply,
}: {
  value: TimePeriod;
  onApply: (value: TimePeriod) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TimePeriod>(value);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setDraft(value);
    setOpen(nextOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-1 size-9 shrink-0 rounded-full data-[state=open]:bg-secondary"
          aria-label="Filter by time period"
        >
          <DotsThreeVertical size={20} weight="bold" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={2}
        className="w-[19.25rem] rounded-lg border-border bg-popover p-4 shadow-card"
      >
        <label className="text-body font-semibold leading-none text-popover-foreground">
          Time period
        </label>
        <Select value={draft} onValueChange={(next) => setDraft(next as TimePeriod)}>
          <SelectTrigger className="mt-2 h-11 rounded-md border-input bg-card px-4 text-body font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_PERIODS.map((period) => (
              <SelectItem key={period.value} value={period.value}>
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="mt-6 grid grid-cols-[auto_1fr] gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full px-5 text-body font-semibold"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            className="h-11 rounded-full bg-ink px-6 text-body font-semibold text-ink-foreground shadow-none hover:bg-ink/90"
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
          >
            Apply changes
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ChartBar;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-52 flex-1 flex-col items-center justify-center px-6 pb-6 text-center">
      <Icon size={40} weight="regular" className="text-primary" />
      <p className="mt-4 text-title font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-body text-muted-foreground">{children}</p>
    </div>
  );
}

const STATUS_PILL: Record<string, string> = {
  booked: "bg-status-booked text-status-booked-foreground",
  confirmed: "bg-status-booked text-status-booked-foreground",
  arrived: "bg-status-arrived text-status-arrived-foreground",
  started: "bg-status-arrived text-status-arrived-foreground",
  completed: "bg-status-completed text-status-completed-foreground",
  no_show: "bg-status-cancelled text-status-cancelled-foreground",
  cancelled: "bg-status-cancelled text-status-cancelled-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-3 text-caption font-medium leading-4",
        STATUS_PILL[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {statusTone(status).label}
    </span>
  );
}

function AppointmentList({
  appointments,
  locale,
  timeZone,
  compactDate = false,
}: {
  appointments: DashboardAppointment[];
  locale: string;
  timeZone: string;
  /** "Tue 11:00" instead of "Tue, 13 Oct 2026 11:00" — used for today's list. */
  compactDate?: boolean;
}) {
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", timeZone });
  const month = new Intl.DateTimeFormat(locale, { month: "short", timeZone });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone });
  const fullDate = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  });
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  });
  return (
    <div className="max-h-[22rem] overflow-y-auto px-3 pb-3">
      {appointments.map((appointment) => (
        <div
          key={appointment.id}
          className="flex gap-4 border-b border-border/70 px-0 py-4 last:border-b-0"
        >
          <div className="w-7 shrink-0 pt-2.5 text-center">
            <span className="block text-heading font-semibold tabular-nums text-foreground">
              {day.format(appointment.start)}
            </span>
            <span className="block text-body text-foreground">
              {month.format(appointment.start)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body text-muted-foreground">
                {compactDate
                  ? weekday.format(appointment.start)
                  : fullDate.format(appointment.start)}{" "}
                {time.format(appointment.start)}
              </span>
              <StatusBadge status={appointment.status} />
            </div>
            <p className="mt-0.5 truncate text-heading font-semibold text-foreground">
              {appointment.serviceNames.join(", ")}
            </p>
            <p className="truncate text-body text-muted-foreground">
              {appointment.clientName}, {formatDuration(appointment.durationMinutes)} with{" "}
              {appointment.teamNames.map((name) => name.split(" ")[0]).join(", ")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RankTable({
  label,
  rows,
  empty,
}: {
  label: string;
  rows: Array<{ key: string; name: string; current: React.ReactNode; previous: React.ReactNode }>;
  empty: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="grid grid-cols-[1fr_7rem_7rem] border-b border-border/70 px-6 py-4 text-body font-semibold text-foreground">
        <span>{label}</span>
        <span className="text-right">This month</span>
        <span className="text-right">Last month</span>
      </div>
      {rows.length ? (
        <div className="max-h-72 overflow-y-auto">
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[1fr_7rem_7rem] border-b border-border/70 px-6 py-3.5 text-caption text-foreground last:border-b-0"
            >
              <span className="truncate">{row.name}</span>
              <span className="text-right tabular-nums">{row.current}</span>
              <span className="text-right tabular-nums">{row.previous}</span>
            </div>
          ))}
        </div>
      ) : (
        empty
      )}
    </div>
  );
}

export function HomeDashboard() {
  const { data: business, isLoading: businessLoading } = useBusiness();
  const locale = useMemo(() => {
    const browserLocale = typeof navigator !== "undefined" ? navigator.language : "en";
    try {
      return new Intl.Locale(browserLocale).baseName;
    } catch {
      return "en";
    }
  }, []);
  const timeZone = business?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const now = useMemo(() => new Date(), []);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("last-7-days");
  const [activityPeriod, setActivityPeriod] = useState<TimePeriod>("last-7-days");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["home-dashboard", business?.id],
    enabled: Boolean(business?.id),
    queryFn: async () => {
      if (!business)
        return {
          items: [] as DashboardItem[],
          services: [] as ServiceRow[],
          sales: [] as SaleRow[],
        };
      const rangeStart = new Date(now);
      rangeStart.setMonth(rangeStart.getMonth() - 2, 1);
      rangeStart.setHours(0, 0, 0, 0);
      const rangeEnd = addDays(now, 8);

      const [itemsResult, servicesResult, salesResult] = await Promise.all([
        supabase
          .from("appointment_items")
          .select(
            "id, appointment_id, start_time, end_time, price, services(id, name), team_members(first_name, last_name), appointments!inner(id, status, is_walk_in, created_at, clients(first_name, last_name))",
          )
          .eq("business_id", business.id)
          .gte("start_time", rangeStart.toISOString())
          .lt("start_time", rangeEnd.toISOString())
          .order("start_time", { ascending: false }),
        supabase
          .from("services")
          .select("id, name")
          .eq("business_id", business.id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("sales")
          .select("id, total, sale_date, team_member_id, team_members(first_name, last_name)")
          .eq("business_id", business.id)
          .eq("status", "completed")
          .gte("sale_date", rangeStart.toISOString())
          .lt("sale_date", rangeEnd.toISOString()),
      ]);
      if (itemsResult.error) throw itemsResult.error;
      if (servicesResult.error) throw servicesResult.error;
      if (salesResult.error) throw salesResult.error;
      return {
        items: itemsResult.data as unknown as DashboardItem[],
        services: servicesResult.data as ServiceRow[],
        sales: salesResult.data as unknown as SaleRow[],
      };
    },
    staleTime: 60_000,
  });

  const dashboard = useMemo(() => {
    const items = data?.items ?? [];
    const activeItems = items.filter((item) => item.appointments?.status !== "cancelled");
    const appointments = groupAppointments(activeItems);
    const todayKey = dateKey(now, timeZone);
    const selectedDates = periodDates(timePeriod, now);
    const recentKeys = selectedDates.map((date) => dateKey(date, timeZone));
    const activityKeys = new Set(
      periodDates(activityPeriod, now).map((date) => dateKey(date, timeZone)),
    );
    const nextKeys = new Set(
      Array.from({ length: 8 }, (_, index) => dateKey(addDays(now, index), timeZone)),
    );
    const recentItems = activeItems.filter((item) =>
      recentKeys.includes(dateKey(new Date(item.start_time), timeZone)),
    );
    const recentAppointments = groupAppointments(recentItems);
    const upcoming = appointments
      .filter(
        (appointment) =>
          appointment.end >= now && nextKeys.has(dateKey(appointment.start, timeZone)),
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const today = upcoming.filter(
      (appointment) => dateKey(appointment.start, timeZone) === todayKey,
    );

    // Like Fresha, "Upcoming appointments" covers the next 7 days starting tomorrow,
    // and counts cancellations too (they are excluded from every other card).
    const upcomingDates = Array.from({ length: 7 }, (_, index) => addDays(now, index + 1));
    const upcomingKeys = upcomingDates.map((date) => dateKey(date, timeZone));
    const upcomingAll = groupAppointments(
      items.filter((item) => upcomingKeys.includes(dateKey(new Date(item.start_time), timeZone))),
    );
    const upcomingChart = upcomingDates.map((date, index) => {
      const onDay = upcomingAll.filter(
        (appointment) => dateKey(appointment.start, timeZone) === upcomingKeys[index],
      );
      return {
        label: new Intl.DateTimeFormat(locale, {
          day: "numeric",
          weekday: "short",
          timeZone,
        }).format(date),
        confirmed: onDay.filter((appointment) => appointment.status === "confirmed").length,
        // Still to happen: completed (checked out early) and no-shows aren't upcoming bookings.
        booked: onDay.filter((appointment) =>
          ["booked", "arrived", "started"].includes(appointment.status),
        ).length,
        cancelled: onDay.filter((appointment) => appointment.status === "cancelled").length,
      };
    });
    const upcomingTotals = upcomingChart.reduce(
      (sum, day) => ({
        confirmed: sum.confirmed + day.confirmed,
        booked: sum.booked + day.booked,
        cancelled: sum.cancelled + day.cancelled,
      }),
      { confirmed: 0, booked: 0, cancelled: 0 },
    );

    const sales = data?.sales ?? [];
    const chart = recentKeys.map((key) => ({
      key,
      label: new Intl.DateTimeFormat(locale, { day: "numeric", weekday: "short", timeZone }).format(
        activeItems.find((item) => dateKey(new Date(item.start_time), timeZone) === key)?.start_time
          ? new Date(
              activeItems.find((item) => dateKey(new Date(item.start_time), timeZone) === key)
                ?.start_time ?? now,
            )
          : selectedDates[recentKeys.indexOf(key)],
      ),
      sales: sales
        .filter((sale) => dateKey(new Date(sale.sale_date), timeZone) === key)
        .reduce((sum, sale) => sum + Number(sale.total ?? 0), 0),
      appointments: new Set(
        recentItems
          .filter((item) => dateKey(new Date(item.start_time), timeZone) === key)
          .map((item) => item.appointment_id),
      ).size,
    }));

    const currentMonth = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      timeZone,
    }).format(now);
    const previousDate = new Date(now);
    previousDate.setMonth(previousDate.getMonth() - 1);
    const previousMonth = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      timeZone,
    }).format(previousDate);
    const monthKey = (value: string) =>
      new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone }).format(
        new Date(value),
      );
    const serviceCounts = (data?.services ?? [])
      .map((service) => ({
        ...service,
        current: new Set(
          activeItems
            .filter(
              (item) =>
                item.services?.id === service.id && monthKey(item.start_time) === currentMonth,
            )
            .map((item) => item.appointment_id),
        ).size,
        previous: new Set(
          activeItems
            .filter(
              (item) =>
                item.services?.id === service.id && monthKey(item.start_time) === previousMonth,
            )
            .map((item) => item.appointment_id),
        ).size,
      }))
      .sort(
        (a, b) => b.current - a.current || b.previous - a.previous || a.name.localeCompare(b.name),
      );

    const memberMap = new Map<string, { name: string; current: number; previous: number }>();
    for (const sale of sales) {
      const key = sale.team_member_id ?? "unassigned";
      const entry = memberMap.get(key) ?? {
        name: fullName(sale.team_members),
        current: 0,
        previous: 0,
      };
      const month = monthKey(sale.sale_date);
      if (month === currentMonth) entry.current += Number(sale.total ?? 0);
      if (month === previousMonth) entry.previous += Number(sale.total ?? 0);
      memberMap.set(key, entry);
    }
    const topMembers = [...memberMap.values()].sort(
      (a, b) => b.current - a.current || b.previous - a.previous || a.name.localeCompare(b.name),
    );

    return {
      chart,
      recentCount: recentAppointments.length,
      recentValue: recentItems.reduce((sum, item) => sum + Number(item.price ?? 0), 0),
      recentSalesTotal: sales
        .filter((sale) => recentKeys.includes(dateKey(new Date(sale.sale_date), timeZone)))
        .reduce((sum, sale) => sum + Number(sale.total ?? 0), 0),
      topMembers,
      upcomingChart,
      upcomingTotals,
      today,
      activity: appointments
        .filter((appointment) => activityKeys.has(dateKey(appointment.start, timeZone)))
        .sort((a, b) => b.start.getTime() - a.start.getTime())
        .slice(0, 20),
      serviceCounts,
    };
  }, [activityPeriod, data, locale, now, timePeriod, timeZone]);

  const timePeriodLabel =
    TIME_PERIODS.find((period) => period.value === timePeriod)?.label ?? "Last 7 days";
  const activityPeriodLabel =
    TIME_PERIODS.find((period) => period.value === activityPeriod)?.label ?? "Last 7 days";

  if (businessLoading || isLoading) {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-4 p-6 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-80 rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError || !business) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6">
        <Card className="rounded-lg shadow-none">
          <CardContent className="p-8 text-body text-muted-foreground">
            The dashboard could not be loaded. Please refresh and try again.
          </CardContent>
        </Card>
      </div>
    );
  }

  const currency = business.currency;
  const money = (value: number) => formatMoney(value, business.currency, business.country);
  const upcomingTotal =
    dashboard.upcomingTotals.confirmed +
    dashboard.upcomingTotals.booked +
    dashboard.upcomingTotals.cancelled;

  return (
    <div className="min-h-full bg-surface">
      <div className="mx-auto grid w-full max-w-6xl items-start gap-x-8 gap-y-4 p-4 sm:p-6 lg:grid-cols-2">
        <DashboardCard
          title="Recent sales"
          subtitle={timePeriodLabel}
          className="lg:min-h-[33.75rem]"
          action={<TimePeriodFilter value={timePeriod} onApply={setTimePeriod} />}
        >
          <CardContent className="flex flex-1 flex-col px-6 pb-6 pt-0">
            <p className="text-display font-semibold leading-9 tabular-nums text-foreground">
              {money(dashboard.recentSalesTotal)}
            </p>
            <div className="mt-6 text-body text-muted-foreground">
              <p>
                Appointments{" "}
                <span className="font-semibold text-foreground">{dashboard.recentCount}</span>
              </p>
              <p>
                Appointments value{" "}
                <span className="font-semibold text-foreground">
                  {money(dashboard.recentValue)}
                </span>
              </p>
            </div>
            <Suspense fallback={<Skeleton className="mt-6 h-60 w-full rounded-lg" />}>
              <SalesChart data={dashboard.chart} currency={currency} />
            </Suspense>
            <ChartLegend
              items={[
                { label: "Sales", color: "var(--color-primary)" },
                { label: "Appointments", color: "var(--color-chart-appointments)" },
              ]}
            />
          </CardContent>
        </DashboardCard>

        <DashboardCard
          title="Upcoming appointments"
          subtitle="Next 7 days"
          menu
          className="lg:min-h-[33.75rem]"
        >
          {upcomingTotal ? (
            <CardContent className="flex flex-1 flex-col px-6 pb-6 pt-0">
              <p className="text-display font-semibold leading-9 tabular-nums text-foreground">
                {upcomingTotal} booked
              </p>
              <div className="mt-6 text-body text-muted-foreground">
                <p>
                  Confirmed appointments{" "}
                  <span className="font-semibold text-foreground">
                    {dashboard.upcomingTotals.confirmed}
                  </span>
                </p>
                <p>
                  Cancelled appointments{" "}
                  <span className="font-semibold text-foreground">
                    {dashboard.upcomingTotals.cancelled}
                  </span>
                </p>
              </div>
              <Suspense fallback={<Skeleton className="mt-6 h-60 w-full rounded-lg" />}>
                <UpcomingChart data={dashboard.upcomingChart} />
              </Suspense>
              <ChartLegend
                items={[
                  { label: "Confirmed", color: "var(--color-chart-appointments)" },
                  { label: "Booked", color: "var(--color-primary)" },
                  { label: "Cancelled", color: "var(--color-destructive)" },
                ]}
              />
            </CardContent>
          ) : (
            <EmptyState icon={ChartBar} title="Your schedule is empty">
              Make some appointments for schedule data to appear
            </EmptyState>
          )}
        </DashboardCard>

        <DashboardCard
          title="Appointments activity"
          action={<TimePeriodFilter value={activityPeriod} onApply={setActivityPeriod} />}
          subtitle={activityPeriod === "last-7-days" ? undefined : activityPeriodLabel}
          className="min-h-0"
        >
          {dashboard.activity.length ? (
            <AppointmentList
              appointments={dashboard.activity}
              locale={locale}
              timeZone={timeZone}
            />
          ) : (
            <EmptyState icon={CalendarCheck} title="No appointment activity">
              New bookings will appear here as they are added.
            </EmptyState>
          )}
        </DashboardCard>

        <DashboardCard title="Today's next appointments" className="min-h-0">
          {dashboard.today.length ? (
            <AppointmentList
              appointments={dashboard.today}
              locale={locale}
              timeZone={timeZone}
              compactDate
            />
          ) : (
            <EmptyState icon={CalendarBlank} title="No Appointments Today">
              Visit the{" "}
              <Link
                to="/calendar"
                className="font-medium text-primary underline underline-offset-2"
              >
                calendar
              </Link>{" "}
              section to add some appointments
            </EmptyState>
          )}
        </DashboardCard>

        <DashboardCard title="Top services" className="min-h-[17.5rem]">
          <RankTable
            label="Service"
            rows={dashboard.serviceCounts.map((service) => ({
              key: service.id,
              name: service.name,
              current: service.current,
              previous: service.previous,
            }))}
            empty={
              <EmptyState icon={ChartBar} title="No services yet">
                Add services to your menu for data to appear
              </EmptyState>
            }
          />
        </DashboardCard>

        <DashboardCard title="Top team member" className="min-h-[17.5rem]">
          <RankTable
            label="Team member"
            rows={dashboard.topMembers
              .filter((member) => member.current > 0 || member.previous > 0)
              .map((member, index) => ({
                key: `${member.name}-${index}`,
                name: member.name,
                current: money(member.current),
                previous: money(member.previous),
              }))}
            empty={
              <EmptyState icon={TrendUp} title="No sales this month">
                Create some sales for sales data to appear
              </EmptyState>
            }
          />
        </DashboardCard>
      </div>
    </div>
  );
}
