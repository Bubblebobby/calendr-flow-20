import { useEffect, useState } from "react";
import { CaretDown, MagnifyingGlass, SlidersHorizontal, X } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Header-size button (48px, 17px semibold), Fresha's Options/Add. Add colour classes on top. */
export const pillButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-[1.0625rem] font-semibold transition-colors disabled:opacity-50";

/** Title + subtitle on the left, actions on the right — Fresha's list page header. */
export function PageHeader({
  title,
  subtitle,
  learnMore,
  actions,
}: {
  title: string;
  subtitle: string;
  learnMore?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-[1.75rem] font-semibold leading-9 text-foreground">
          {title}
        </h1>
        <p className="mt-1 max-w-xl text-[0.9375rem] text-muted-foreground">
          {subtitle}{" "}
          {learnMore ? (
            <span className="cursor-pointer font-medium text-primary hover:underline">
              Learn more
            </span>
          ) : null}
        </p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Grey rounded bar holding search + filter chips. */
export function ListToolbar({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-toolbar p-4">
      {children}
      {right ? <div className="ml-auto flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex h-9 w-full max-w-[16rem] items-center gap-2 rounded-full border border-input bg-card px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
      <MagnifyingGlass size={16} className="shrink-0 text-muted-foreground" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

export function ChipButton({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border bg-card px-4 text-[0.9375rem] font-medium transition-colors hover:bg-secondary data-[state=open]:bg-secondary",
        active ? "border-primary text-primary" : "border-input",
      )}
    >
      {children}
    </button>
  );
}

export function FiltersChip({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <ChipButton onClick={onClick} active={count > 0}>
      <SlidersHorizontal size={16} />
      Filters
      {count ? (
        <span className="rounded-full bg-primary px-1.5 text-[0.75rem] text-primary-foreground">
          {count}
        </span>
      ) : null}
    </ChipButton>
  );
}

// ─── Date range ────────────────────────────────────────────────────────────

export type RangePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "last90"
  | "lastMonth"
  | "lastYear"
  | "weekToDate"
  | "monthToDate"
  | "quarterToDate"
  | "yearToDate"
  | "tomorrow"
  | "next7"
  | "nextMonth"
  | "next30"
  | "all"
  | "custom";

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  last30: "Last 30 days",
  last90: "Last 90 days",
  lastMonth: "Last month",
  lastYear: "Last year",
  weekToDate: "Week to date",
  monthToDate: "Month to date",
  quarterToDate: "Quarter to date",
  yearToDate: "Year to date",
  tomorrow: "Tomorrow",
  next7: "Next 7 days",
  nextMonth: "Next month",
  next30: "Next 30 days",
  all: "All time",
  custom: "Custom",
};

export type DateRange = { preset: RangePreset; from: Date | null; to: Date | null };

const day = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};
const shift = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/** Inclusive start and end days for a preset (null = unbounded). */
export function presetRange(
  preset: RangePreset,
  now = new Date(),
): { from: Date | null; to: Date | null } {
  const today = day(now);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: shift(today, -1), to: shift(today, -1) };
    case "last7":
      return { from: shift(today, -6), to: today };
    case "last30":
      return { from: shift(today, -29), to: today };
    case "last90":
      return { from: shift(today, -89), to: today };
    case "lastMonth":
      return {
        from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        to: new Date(today.getFullYear(), today.getMonth(), 0),
      };
    case "lastYear":
      return {
        from: new Date(today.getFullYear() - 1, 0, 1),
        to: new Date(today.getFullYear() - 1, 11, 31),
      };
    case "weekToDate":
      return { from: shift(today, -((today.getDay() + 6) % 7)), to: today };
    case "monthToDate":
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today };
    case "quarterToDate":
      return {
        from: new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1),
        to: today,
      };
    case "yearToDate":
      return { from: new Date(today.getFullYear(), 0, 1), to: today };
    case "tomorrow":
      return { from: shift(today, 1), to: shift(today, 1) };
    case "next7":
      return { from: today, to: shift(today, 6) };
    case "nextMonth":
      return {
        from: new Date(today.getFullYear(), today.getMonth() + 1, 1),
        to: new Date(today.getFullYear(), today.getMonth() + 2, 0),
      };
    case "next30":
      return { from: today, to: shift(today, 29) };
    default:
      return { from: null, to: null };
  }
}

export function makeRange(preset: RangePreset): DateRange {
  return { preset, ...presetRange(preset) };
}

/** [from, toExclusive) ISO bounds for querying timestamps. */
export function rangeBounds(range: DateRange) {
  return {
    from: range.from ? day(range.from).toISOString() : null,
    to: range.to ? shift(day(range.to), 1).toISOString() : null,
  };
}

const iso = (date: Date | null) =>
  date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : "";
const fromIso = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};

export function rangeLabel(range: DateRange) {
  if (range.preset !== "custom") return RANGE_LABELS[range.preset];
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
  return range.from && range.to ? `${fmt.format(range.from)} - ${fmt.format(range.to)}` : "Custom";
}

export function DateRangeButton({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-full border border-input bg-card px-4 text-[0.9375rem] font-medium transition-colors hover:bg-secondary data-[state=open]:bg-secondary"
        >
          {rangeLabel(value)}
          <CaretDown size={12} weight="bold" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[min(40rem,calc(100vw-2rem))] rounded-2xl p-4 shadow-xl"
      >
        <label className="block text-[0.875rem] font-semibold">
          Date range
          <select
            value={draft.preset}
            onChange={(event) => setDraft(makeRange(event.target.value as RangePreset))}
            className="mt-2 h-11 w-full rounded-lg border border-border bg-card px-3 text-[0.9375rem] font-normal"
          >
            {(Object.keys(RANGE_LABELS) as RangePreset[]).map((key) => (
              <option key={key} value={key}>
                {RANGE_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(["from", "to"] as const).map((edge) => (
            <label key={edge} className="text-[0.875rem] font-semibold">
              {edge === "from" ? "Starting Date" : "Ending Date"}
              <input
                type="date"
                value={iso(draft[edge])}
                onChange={(event) =>
                  setDraft({ ...draft, preset: "custom", [edge]: fromIso(event.target.value) })
                }
                className="mt-2 h-11 w-full rounded-lg border border-border px-3 text-[0.9375rem] font-normal"
              />
            </label>
          ))}
        </div>
        <Calendar
          mode="range"
          numberOfMonths={2}
          weekStartsOn={1}
          defaultMonth={draft.from ?? new Date()}
          selected={draft.from ? { from: draft.from, to: draft.to ?? undefined } : undefined}
          onSelect={(selected) =>
            setDraft({
              preset: "custom",
              from: selected?.from ?? null,
              to: selected?.to ?? selected?.from ?? null,
            })
          }
          className="mt-2 p-0"
        />
        <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={cn(pillButton, "h-10 hover:bg-secondary")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
            className={cn(pillButton, "h-10 bg-ink text-ink-foreground hover:bg-ink/90")}
          >
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Filter modal ──────────────────────────────────────────────────────────

export function FilterModal({
  open,
  onClose,
  onClear,
  onApply,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onClear: () => void;
  onApply: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[34rem] rounded-2xl p-9 [&>button]:hidden">
        <div className="flex items-center justify-between">
          <DialogTitle className="text-xl font-semibold">Filters</DialogTitle>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-full bg-secondary hover:bg-muted"
          >
            <X size={18} />
          </button>
        </div>
        <DialogDescription className="sr-only">Narrow the list.</DialogDescription>
        <div className="mt-4 space-y-5">{children}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClear}
            className={cn(pillButton, "border border-input hover:bg-secondary")}
          >
            Clear filters
          </button>
          <button
            type="button"
            onClick={onApply}
            className={cn(pillButton, "bg-ink text-ink-foreground hover:bg-ink/90")}
          >
            Apply
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[0.9375rem] font-semibold">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-lg border border-border bg-card px-4 text-[0.9375rem] font-normal"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Fresha's centred empty state inside a bordered card. */
export function EmptyCard({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-16 text-center">
      <span className="text-primary">{icon}</span>
      <p className="mt-4 text-[1.0625rem] font-semibold">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-[0.875rem] text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Fresha's "INCLUDED IN YOUR PLAN" intro page for features not set up yet. */
export function FeatureIntro({
  eyebrow = "INCLUDED IN YOUR PLAN",
  title,
  body,
  bullets,
  cta = "Start now",
  onStart,
  art,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  bullets: string[];
  cta?: string;
  onStart: () => void;
  art?: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-10 py-6 lg:grid-cols-[1fr_minmax(16rem,22rem)]">
      <div>
        <p className="text-[0.8125rem] font-semibold tracking-wide text-[#1f8a3e]">{eyebrow}</p>
        <h1 className="mt-3 text-[2.25rem] font-semibold leading-tight">{title}</h1>
        <p className="mt-4 max-w-lg text-[1rem] text-muted-foreground">{body}</p>
        <ul className="mt-5 space-y-3">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-3 text-[0.9375rem]">
              <span className="mt-0.5 text-foreground">✓</span>
              {bullet}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex items-center gap-5">
          <button
            type="button"
            onClick={onStart}
            className={cn(pillButton, "h-12 bg-ink px-7 text-ink-foreground hover:bg-ink/90")}
          >
            {cta}
          </button>
          <span className="cursor-pointer text-[0.9375rem] font-semibold hover:underline">
            Learn more
          </span>
        </div>
      </div>
      {art ? (
        <div className="hidden rounded-[2rem] bg-gradient-to-br from-[#ebe8ff] via-[#f3f0ff] to-[#dff4f1] p-8 lg:block">
          {art}
        </div>
      ) : null}
    </div>
  );
}
