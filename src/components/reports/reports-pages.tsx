import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CaretRight,
  ChartBar,
  DownloadSimple,
  ListBullets,
  Star,
  Table,
} from "@phosphor-icons/react";

import { DateRangeButton, PageHeader, SearchBox, makeRange, pillButton, rangeBounds, rangeLabel, type DateRange } from "@/components/sales/list-ui";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import { formatHours } from "@/lib/team-shifts";
import { useBusiness } from "@/lib/use-business";
import { cn } from "@/lib/utils";
import { csvCell } from "@/lib/csv";

import {
  REPORT_CATEGORIES,
  REPORTS,
  reportById,
  type Column,
  type ReportCategory,
  type Row,
} from "./report-definitions";

const FAVOURITES_KEY = "bookly:report-favourites";

function useFavourites() {
  const [favourites, setFavourites] = useState<string[]>([]);
  useEffect(() => {
    try {
      setFavourites(JSON.parse(localStorage.getItem(FAVOURITES_KEY) ?? "[]"));
    } catch {
      setFavourites([]);
    }
  }, []);
  const toggle = (id: string) =>
    setFavourites((current) => {
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      try {
        localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: keep for this visit only */
      }
      return next;
    });
  return { favourites, toggle };
}

const card = "rounded-xl bg-card shadow-[inset_0_0_0_1px_var(--color-border)]";

// ─── Home ───────────────────────────────────────────────────────────────────

export function ReportsHome() {
  const { favourites } = useFavourites();
  const available = REPORTS.filter((r) => r.category !== "Dashboards");
  const entries = [
    { key: "all", label: "All reports", icon: <ListBullets size={20} />, count: available.length },
    { key: "favourites", label: "Favourites", icon: <Star size={20} />, count: favourites.length },
    { key: "dashboards", label: "Dashboards", icon: <ChartBar size={20} />, count: REPORTS.filter((r) => r.category === "Dashboards").length },
    { key: "standard", label: "Standard", icon: <Table size={20} />, count: available.filter((r) => r.load).length },
  ];
  return (
    <div className="space-y-8">
      <PageHeader title="Reports" subtitle="Access all of your Bookly reports." />
      <ul className={cn(card, "divide-y divide-border")}>
        {entries.map((entry) => (
          <li key={entry.key}>
            <Link
              to="/reports"
              search={{ view: entry.key as never }}
              className="flex h-14 items-center gap-4 px-5 text-body font-medium transition-colors hover:bg-secondary"
            >
              <span className="text-muted-foreground">{entry.icon}</span>
              <span className="flex-1">{entry.label}</span>
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-secondary px-2 text-caption font-semibold text-muted-foreground">
                {entry.count}
              </span>
              <CaretRight size={16} className="text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Report list ────────────────────────────────────────────────────────────

export function ReportsList({ view }: { view: "all" | "favourites" | "dashboards" | "standard" }) {
  const { favourites, toggle } = useFavourites();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ReportCategory | "all">("all");
  const title = { all: "All reports", favourites: "Favourites", dashboards: "Dashboards", standard: "Standard reports" }[view];

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    return REPORTS.filter((r) => {
      if (view === "dashboards" && r.category !== "Dashboards") return false;
      if (view !== "dashboards" && r.category === "Dashboards" && view !== "all") return false;
      if (view === "favourites" && !favourites.includes(r.id)) return false;
      if (view === "standard" && !r.load) return false;
      if (category !== "all" && r.category !== category) return false;
      return !term || `${r.name} ${r.description}`.toLowerCase().includes(term);
    });
  }, [view, favourites, category, search]);

  return (
    <div className="space-y-6">
      <BackLink />
      <PageHeader title={title} subtitle="Access all of your Bookly reports." />
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={search} onChange={setSearch} placeholder="Search reports" />
      </div>
      {view !== "dashboards" ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["all", ...REPORT_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-body font-medium transition-colors",
                category === c ? "bg-ink text-ink-foreground" : "border border-input bg-card hover:bg-secondary",
              )}
            >
              {c === "all" ? "All reports" : c}
            </button>
          ))}
        </div>
      ) : null}
      <ul className={cn(card, "divide-y divide-border")}>
        {list.map((report) => (
          <li key={report.id} className="flex items-center gap-4 px-5 py-4">
            <Link to="/reports/$reportId" params={{ reportId: report.id }} className="min-w-0 flex-1 group">
              <span className="flex items-center gap-2">
                <span className="text-heading font-semibold group-hover:underline">{report.name}</span>
                {report.unavailable ? (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-caption font-semibold text-muted-foreground">Not available yet</span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-body text-muted-foreground">{report.description}</span>
            </Link>
            <button
              type="button"
              aria-label={favourites.includes(report.id) ? `Remove ${report.name} from favourites` : `Add ${report.name} to favourites`}
              onClick={() => toggle(report.id)}
              className="flex size-10 items-center justify-center rounded-full hover:bg-secondary"
            >
              <Star size={20} weight={favourites.includes(report.id) ? "fill" : "regular"} className={favourites.includes(report.id) ? "text-[#f5a623]" : "text-muted-foreground"} />
            </button>
          </li>
        ))}
        {list.length === 0 ? (
          <li className="px-5 py-10 text-center text-body text-muted-foreground">
            {view === "favourites" ? "Star a report to add it to your favourites." : "No reports match your search."}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function BackLink({ to = "home", label = "Reports" }: { to?: string; label?: string }) {
  return (
    <Link
      to="/reports"
      search={to === "home" ? {} : { view: to as never }}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-input px-4 text-body font-medium hover:bg-secondary"
    >
      <ArrowLeft size={16} /> {label}
    </Link>
  );
}

// ─── Report page ────────────────────────────────────────────────────────────

export function ReportPage({ reportId }: { reportId: string }) {
  const report = reportById(reportId);
  const navigate = useNavigate();
  const { data: business } = useBusiness();
  const { favourites, toggle } = useFavourites();
  const [range, setRange] = useState<DateRange>(() => makeRange("monthToDate"));
  const bounds = rangeBounds(range);

  const result = useQuery({
    queryKey: ["report", reportId, business?.id, bounds.from, bounds.to],
    enabled: Boolean(business?.id && report?.load),
    queryFn: () => report!.load!(business!.id, bounds),
  });

  if (!report) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-body text-muted-foreground">This report doesn&apos;t exist.</p>
      </div>
    );
  }

  const format = (value: Row[string], column: Column) => {
    if (value === null || value === undefined || value === "") return "";
    switch (column.format) {
      case "money":
        return business ? formatMoney(Number(value), business.currency, business.country) : String(value);
      case "number":
        return Number(value).toLocaleString();
      case "percent":
        return `${(Number(value) * 100).toFixed(1)}%`;
      case "hours":
        return formatHours(Math.round(Number(value)));
      case "date":
        return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(String(value)));
      case "datetime":
        return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(String(value)));
      default:
        return String(value);
    }
  };

  const exportCsv = () => {
    if (!result.data) return;
    const lines = [report.columns.map((c) => c.label), ...result.data.rows.map((row) => report.columns.map((c) => format(row[c.key] ?? null, c)))];
    if (result.data.total) lines.push(report.columns.map((c) => format(result.data!.total![c.key] ?? null, c)));
    const csv = "﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `${report.id}-${rangeLabel(range).toLowerCase().replace(/\s+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const numeric = (c: Column) => c.format && c.format !== "text" && c.format !== "date" && c.format !== "datetime";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => navigate({ to: "/reports", search: { view: "all" } })} className="inline-flex h-10 items-center gap-2 rounded-full border border-input px-4 text-body font-medium hover:bg-secondary">
          <ArrowLeft size={16} /> Back
        </button>
        <span className="text-body text-muted-foreground">
          All reports · {report.category} · <span className="text-foreground">{report.name}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-display font-semibold">
            {report.name}
            <button
              type="button"
              aria-label={favourites.includes(report.id) ? "Remove from favourites" : "Add to favourites"}
              onClick={() => toggle(report.id)}
              className="flex size-9 items-center justify-center rounded-full hover:bg-secondary"
            >
              <Star size={22} weight={favourites.includes(report.id) ? "fill" : "regular"} className={favourites.includes(report.id) ? "text-[#f5a623]" : "text-muted-foreground"} />
            </button>
          </h1>
          <p className="mt-1 text-body text-muted-foreground">{report.description}</p>
        </div>
        {report.load ? (
          <button type="button" disabled={!result.data?.rows.length} onClick={exportCsv} className={cn(pillButton, "border border-input bg-card hover:bg-secondary")}>
            <DownloadSimple size={18} /> Export CSV
          </button>
        ) : null}
      </div>

      {report.id === "performance-dashboard" ? (
        <PerformanceDashboard range={range} onRange={setRange} />
      ) : report.unavailable || !report.load ? (
        <div className={cn(card, "px-6 py-12 text-center")}>
          <p className="text-heading font-semibold">Not available yet</p>
          <p className="mt-1 text-body text-muted-foreground">{report.unavailable}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-toolbar p-4">
            <DateRangeButton value={range} onChange={setRange} />
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[720px]">
              <thead>
                <tr>
                  {report.columns.map((c) => (
                    <th key={c.key} className={cn("px-4", numeric(c) && "text-right")}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.isLoading ? (
                  <tr>
                    <td colSpan={report.columns.length} className="px-4 py-12 text-center text-muted-foreground">
                      Loading report…
                    </td>
                  </tr>
                ) : result.isError ? (
                  <tr>
                    <td colSpan={report.columns.length} className="px-4 py-12 text-center text-destructive">
                      Couldn&apos;t load this report: {(result.error as Error).message}
                    </td>
                  </tr>
                ) : (
                  <>
                    {result.data?.total && result.data.rows.length ? (
                      <tr className="bg-secondary font-semibold">
                        {report.columns.map((c) => (
                          <td key={c.key} className={cn("px-4", numeric(c) && "text-right")}>
                            {format(result.data!.total![c.key] ?? null, c)}
                          </td>
                        ))}
                      </tr>
                    ) : null}
                    {result.data?.rows.map((row, index) => (
                      <tr key={index}>
                        {report.columns.map((c) => (
                          <td key={c.key} className={cn("px-4", numeric(c) && "text-right tabular-nums")}>
                            {format(row[c.key] ?? null, c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {result.data && result.data.rows.length === 0 ? (
                      <tr>
                        <td colSpan={report.columns.length} className="px-4 py-12 text-center text-muted-foreground">
                          No data for {rangeLabel(range).toLowerCase()}. Try a different date range.
                        </td>
                      </tr>
                    ) : null}
                  </>
                )}
              </tbody>
            </table>
          </div>
          {result.data ? (
            <p className="text-center text-caption text-muted-foreground">
              Viewing {result.data.rows.length} {result.data.rows.length === 1 ? "result" : "results"}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function PerformanceDashboard({ range, onRange }: { range: DateRange; onRange: (r: DateRange) => void }) {
  const { data: business } = useBusiness();
  const bounds = rangeBounds(range);
  const stats = useQuery({
    queryKey: ["performance-dashboard", business?.id, bounds.from, bounds.to],
    enabled: Boolean(business?.id),
    queryFn: async () => {
      const id = business!.id;
      const sales = supabase.from("sales").select("total, status").eq("business_id", id).eq("status", "completed");
      const items = supabase.from("appointment_items").select("price, appointments(status, client_id, clients(client_source))").eq("business_id", id);
      const clients = supabase.from("clients").select("id", { count: "exact", head: true }).eq("business_id", id);
      const [s, i, c] = await Promise.all([
        bounds.from ? sales.gte("sale_date", bounds.from).lt("sale_date", bounds.to!) : sales,
        bounds.from ? items.gte("start_time", bounds.from).lt("start_time", bounds.to!) : items,
        bounds.from ? clients.gte("created_at", bounds.from).lt("created_at", bounds.to!) : clients,
      ]);
      const error = s.error ?? i.error ?? c.error;
      if (error) throw error;
      const salesTotal = (s.data ?? []).reduce((acc, r) => acc + Number(r.total), 0);
      const rows = (i.data ?? []) as unknown as { price: number | null; appointments: { status: string; clients: { client_source: string | null } | null } | null }[];
      const kept = rows.filter((r) => r.appointments && !["cancelled", "no_show"].includes(r.appointments.status));
      return {
        sales: salesTotal,
        salesCount: s.data?.length ?? 0,
        appointments: kept.length,
        cancelled: rows.length - kept.length,
        online: kept.filter((r) => r.appointments?.clients?.client_source === "online_booking").length,
        booked: kept.reduce((acc, r) => acc + Number(r.price ?? 0), 0),
        newClients: c.count ?? 0,
      };
    },
  });
  const money = (n: number) => (business ? formatMoney(n, business.currency, business.country) : String(n));
  const d = stats.data;
  const tiles = d
    ? [
        { label: "Total sales", value: money(d.sales), note: `${d.salesCount} sales` },
        { label: "Average sale", value: money(d.salesCount ? d.sales / d.salesCount : 0), note: "Per completed sale" },
        { label: "Appointments", value: d.appointments.toLocaleString(), note: `${d.cancelled} cancelled or no-show` },
        { label: "Booked value", value: money(d.booked), note: "Appointments in the period" },
        { label: "Online bookings", value: d.online.toLocaleString(), note: d.appointments ? `${Math.round((d.online / d.appointments) * 100)}% of appointments` : "—" },
        { label: "New clients", value: d.newClients.toLocaleString(), note: "Added in the period" },
      ]
    : [];
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-toolbar p-4">
        <DateRangeButton value={range} onChange={onRange} />
      </div>
      {stats.isLoading ? (
        <p className="text-body text-muted-foreground">Loading…</p>
      ) : stats.isError ? (
        <p className="text-body text-destructive">Couldn&apos;t load the dashboard.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.label} className={cn(card, "p-6")}>
              <p className="text-body text-muted-foreground">{tile.label}</p>
              <p className="mt-2 text-display font-semibold tabular-nums">{tile.value}</p>
              <p className="mt-1 text-caption text-muted-foreground">{tile.note}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
