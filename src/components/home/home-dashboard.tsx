import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarBlank,
  CalendarCheck,
  ChartBar,
  DotsThreeVertical,
  TrendUp,
} from "@phosphor-icons/react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { formatDuration, formatMoney } from "@/lib/format";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";
import { statusTone } from "@/components/calendar/appointment-detail";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const chartConfig = {
  sales: { label: "Sales", color: "var(--color-chart-1)" },
  appointments: { label: "Appointments", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

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
  subtitle?: string;
  menu?: boolean;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("flex min-h-[19rem] flex-col overflow-hidden rounded-lg shadow-none", className)}>
      <CardHeader className="flex-row items-start justify-between space-y-0 px-5 pb-3 pt-5">
        <div className="min-w-0">
          <CardTitle className="text-base font-semibold leading-tight">{title}</CardTitle>
          {subtitle ? <CardDescription className="mt-1 text-[0.8125rem] leading-none">{subtitle}</CardDescription> : null}
        </div>
        {action ?? (menu ? (
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-2 size-8"
            aria-label={`${title} menu`}
            onClick={() => toast("Coming soon")}
          >
            <DotsThreeVertical size={18} weight="bold" />
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
          variant="outline"
          size="icon"
          className="-mr-1 -mt-1 size-10 shrink-0 rounded-full border-foreground bg-card hover:bg-secondary"
          aria-label="Filter recent sales by time period"
        >
          <DotsThreeVertical size={20} weight="bold" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={2}
        className="w-[19.25rem] rounded-lg border-border bg-popover p-4 shadow-card"
      >
        <label className="text-sm font-semibold leading-none text-popover-foreground">Time period</label>
        <Select value={draft} onValueChange={(next) => setDraft(next as TimePeriod)}>
          <SelectTrigger className="mt-2 h-11 rounded-md border-input bg-card px-4 text-sm font-medium">
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
            className="h-11 rounded-full px-5 text-sm font-semibold"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            className="h-11 rounded-full bg-ink px-6 text-sm font-semibold text-ink-foreground shadow-none hover:bg-ink/90"
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
    <div className="flex min-h-52 flex-1 flex-col items-center justify-center px-6 text-center">
      <Icon size={36} weight="duotone" className="text-primary" />
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{children}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium",
        status === "completed" && "bg-slot-mint text-slot-mint-foreground",
        (status === "arrived" || status === "started") && "bg-slot-amber text-slot-amber-foreground",
        (status === "booked" || status === "confirmed") && "bg-slot-blue text-slot-blue-foreground",
        status === "no_show" && "bg-muted text-muted-foreground",
        status === "cancelled" && "bg-destructive/10 text-destructive",
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} />
      {tone.label}
    </span>
  );
}

function AppointmentList({
  appointments,
  locale,
  timeZone,
}: {
  appointments: DashboardAppointment[];
  locale: string;
  timeZone: string;
}) {
  const day = new Intl.DateTimeFormat(locale, { day: "2-digit", timeZone });
  const month = new Intl.DateTimeFormat(locale, { month: "short", timeZone });
  const dateTime = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  return (
    <div className="max-h-[17.5rem] divide-y divide-border overflow-y-auto">
      {appointments.map((appointment) => (
        <div key={appointment.id} className="flex gap-4 px-5 py-3">
          <div className="w-8 shrink-0 text-center">
            <span className="block text-base font-semibold tabular-nums text-foreground">
              {day.format(appointment.start)}
            </span>
            <span className="block text-[0.625rem] uppercase text-muted-foreground">
              {month.format(appointment.start)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{dateTime.format(appointment.start)}</span>
              <StatusBadge status={appointment.status} />
            </div>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">
              {appointment.serviceNames.join(", ")}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {appointment.clientName}, {formatDuration(appointment.durationMinutes)} with {appointment.teamNames.join(", ")}
            </p>
          </div>
        </div>
      ))}
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
        return { items: [] as DashboardItem[], services: [] as ServiceRow[], sales: [] as SaleRow[] };
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
    const activityKeys = new Set(periodDates(activityPeriod, now).map((date) => dateKey(date, timeZone)));
    const nextKeys = new Set(Array.from({ length: 8 }, (_, index) => dateKey(addDays(now, index), timeZone)));
    const recentItems = activeItems.filter((item) => recentKeys.includes(dateKey(new Date(item.start_time), timeZone)));
    const recentAppointments = groupAppointments(recentItems);
    const upcoming = appointments
      .filter((appointment) => appointment.end >= now && nextKeys.has(dateKey(appointment.start, timeZone)))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const today = upcoming.filter((appointment) => dateKey(appointment.start, timeZone) === todayKey);

    const sales = data?.sales ?? [];
    const chart = recentKeys.map((key) => ({
      key,
      label: new Intl.DateTimeFormat(locale, { day: "numeric", weekday: "short", timeZone }).format(
        activeItems.find((item) => dateKey(new Date(item.start_time), timeZone) === key)?.start_time
          ? new Date(activeItems.find((item) => dateKey(new Date(item.start_time), timeZone) === key)?.start_time ?? now)
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

    const currentMonth = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone }).format(now);
    const previousDate = new Date(now);
    previousDate.setMonth(previousDate.getMonth() - 1);
    const previousMonth = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone }).format(previousDate);
    const monthKey = (value: string) =>
      new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone }).format(new Date(value));
    const serviceCounts = (data?.services ?? []).map((service) => ({
      ...service,
      current: new Set(
        activeItems
          .filter((item) => item.services?.id === service.id && monthKey(item.start_time) === currentMonth)
          .map((item) => item.appointment_id),
      ).size,
      previous: new Set(
        activeItems
          .filter((item) => item.services?.id === service.id && monthKey(item.start_time) === previousMonth)
          .map((item) => item.appointment_id),
      ).size,
    })).sort((a, b) => b.current - a.current || b.previous - a.previous || a.name.localeCompare(b.name));

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
    const topMembers = [...memberMap.values()]
      .sort((a, b) => b.current - a.current || b.previous - a.previous || a.name.localeCompare(b.name));

    return {
      chart,
      recentCount: recentAppointments.length,
      recentValue: recentItems.reduce((sum, item) => sum + Number(item.price ?? 0), 0),
      recentSalesTotal: sales
        .filter((sale) => recentKeys.includes(dateKey(new Date(sale.sale_date), timeZone)))
        .reduce((sum, sale) => sum + Number(sale.total ?? 0), 0),
      topMembers,
      upcoming,
      today,
      activity: appointments
        .filter((appointment) => activityKeys.has(dateKey(appointment.start, timeZone)))
        .sort((a, b) => b.start.getTime() - a.start.getTime())
        .slice(0, 20),
      serviceCounts,
    };
  }, [activityPeriod, data, locale, now, timePeriod, timeZone]);

  const timePeriodLabel = TIME_PERIODS.find((period) => period.value === timePeriod)?.label ?? "Last 7 days";
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
          <CardContent className="p-8 text-sm text-muted-foreground">
            The dashboard could not be loaded. Please refresh and try again.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto grid w-full max-w-6xl gap-4 p-4 sm:p-6 lg:grid-cols-2">
        <DashboardCard
          title="Recent sales"
          subtitle={timePeriodLabel}
          action={<TimePeriodFilter value={timePeriod} onApply={setTimePeriod} />}
        >
          <CardContent className="flex flex-1 flex-col px-5 pb-4 pt-0">
            <p className="text-2xl font-semibold leading-tight tabular-nums text-foreground">
              {formatMoney(dashboard.recentSalesTotal, business.currency, business.country)}
            </p>
            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
              <p>Appointments <span className="font-semibold text-foreground">{dashboard.recentCount}</span></p>
              <p>
                Appointments value{" "}
                <span className="font-semibold text-foreground">
                  {formatMoney(dashboard.recentValue, business.currency, business.country)}
                </span>
              </p>
            </div>
            <ChartContainer config={chartConfig} className="mt-3 h-44 w-full aspect-auto">
              <LineChart data={dashboard.chart} margin={{ top: 8, right: 10, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} />
                <YAxis tickLine={false} axisLine={false} fontSize={10} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="sales" stroke="var(--color-sales)" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="appointments" stroke="var(--color-appointments)" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ChartContainer>
            <div className="mt-1 flex items-center gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-1" />Sales</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-chart-2" />Appointments</span>
            </div>
          </CardContent>
        </DashboardCard>

        <DashboardCard title="Upcoming appointments" subtitle="Next 7 days" menu>
          {dashboard.upcoming.length ? (
            <CardContent className="px-0 pb-0">
              <AppointmentList appointments={dashboard.upcoming} locale={locale} timeZone={timeZone} />
            </CardContent>
          ) : (
            <EmptyState icon={ChartBar} title="Your schedule is empty">
              Make some appointments for schedule data to appear
            </EmptyState>
          )}
        </DashboardCard>

        <DashboardCard
          title="Appointments activity"
          subtitle={activityPeriodLabel}
          action={<TimePeriodFilter value={activityPeriod} onApply={setActivityPeriod} />}
        >
          {dashboard.activity.length ? (
            <AppointmentList appointments={dashboard.activity} locale={locale} timeZone={timeZone} />
          ) : (
            <EmptyState icon={CalendarCheck} title="No appointment activity">
              New bookings will appear here as they are added.
            </EmptyState>
          )}
        </DashboardCard>

        <DashboardCard title="Today's next appointments">
          {dashboard.today.length ? (
            <AppointmentList appointments={dashboard.today} locale={locale} timeZone={timeZone} />
          ) : (
            <EmptyState icon={CalendarBlank} title="No Appointments Today">
              Visit the{" "}
              <Link to="/calendar" className="font-medium text-primary underline underline-offset-2">
                calendar
              </Link>{" "}
              section to add some appointments
            </EmptyState>
          )}
        </DashboardCard>

        <DashboardCard title="Top services">
          <CardContent className="px-0 pb-0">
            <div className="grid grid-cols-[1fr_6rem_6rem] border-y border-border bg-muted/40 px-5 py-2 text-[0.6875rem] font-semibold text-muted-foreground">
              <span>Service</span><span className="text-right">This month</span><span className="text-right">Last month</span>
            </div>
            <div className="max-h-56 divide-y divide-border overflow-y-auto">
              {dashboard.serviceCounts.length ? dashboard.serviceCounts.map((service) => (
                <div key={service.id} className="grid grid-cols-[1fr_6rem_6rem] px-5 py-3 text-xs">
                  <span className="truncate font-medium text-foreground">{service.name}</span>
                  <span className="text-right tabular-nums text-foreground">{service.current}</span>
                  <span className="text-right tabular-nums text-muted-foreground">{service.previous}</span>
                </div>
              )) : (
                <p className="px-5 py-8 text-center text-xs text-muted-foreground">No services yet</p>
              )}
            </div>
          </CardContent>
        </DashboardCard>

        <DashboardCard title="Top team member">
          {dashboard.topMembers.length ? (
            <CardContent className="px-0 pb-0">
              <div className="grid grid-cols-[1fr_6rem_6rem] border-y border-border bg-muted/40 px-5 py-2 text-[0.6875rem] font-semibold text-muted-foreground">
                <span>Team member</span><span className="text-right">This month</span><span className="text-right">Last month</span>
              </div>
              <div className="max-h-56 divide-y divide-border overflow-y-auto">
                {dashboard.topMembers.map((member) => (
                  <div key={member.name} className="grid grid-cols-[1fr_6rem_6rem] px-5 py-3 text-xs">
                    <span className="truncate font-medium text-foreground">{member.name}</span>
                    <span className="text-right tabular-nums text-foreground">
                      {formatMoney(member.current, business.currency, business.country)}
                    </span>
                    <span className="text-right tabular-nums text-muted-foreground">
                      {formatMoney(member.previous, business.currency, business.country)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          ) : (
            <EmptyState icon={TrendUp} title="No sales this month">
              Create some sales for sales data to appear
            </EmptyState>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}