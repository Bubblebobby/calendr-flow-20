import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Skeleton loaders: grey placeholders in the shape of what's coming, used instead of "Loading…"
 * text. Each block is announced once to screen readers as "Loading"; the bars themselves are
 * hidden from them. Widths vary row to row so a table or list doesn't look like a barcode.
 */

const WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/12", "w-7/12", "w-1/3"];
const width = (index: number) => WIDTHS[index % WIDTHS.length];

/** Screen-reader wrapper for a loading block. */
function Loading({
  label = "Loading",
  className,
  children,
  as: Tag = "div",
}: {
  label?: string | undefined;
  className?: string | undefined;
  children: React.ReactNode;
  as?: "div" | "tbody";
}) {
  return (
    <Tag role="status" aria-busy="true" aria-label={label} className={className}>
      {children}
    </Tag>
  );
}

/**
 * Rows for an existing table's <tbody> while it loads (the header stays real). Put it in place of
 * the rows; `avatar` adds a round photo in the first cell.
 */
export function SkeletonRows({
  cols,
  rows = 6,
  avatar = false,
  label,
}: {
  cols: number;
  rows?: number;
  avatar?: boolean;
  label?: string;
}) {
  return (
    <>
      <tr className="sr-only">
        <td colSpan={cols} role="status" aria-label={label ?? "Loading"} />
      </tr>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} aria-hidden className="border-b border-border last:border-b-0">
          {Array.from({ length: cols }, (_, col) => (
            <td key={col} className="px-4 py-4">
              {col === 0 && avatar ? (
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className={cn("h-3.5", width(row))} />
                    <Skeleton className={cn("h-3", width(row + 2))} />
                  </div>
                </div>
              ) : (
                <Skeleton className={cn("h-3.5", col === 0 ? width(row) : width(row + col))} />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** A whole table-shaped card (header row and body rows), for lists that render no table yet. */
export function SkeletonTable({
  cols = 5,
  rows = 6,
  label,
  className,
}: {
  cols?: number;
  rows?: number;
  label?: string;
  className?: string;
}) {
  return (
    <Loading
      label={label}
      className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}
    >
      <div aria-hidden className="flex gap-6 border-b border-border bg-muted px-4 py-3.5">
        {Array.from({ length: cols }, (_, col) => (
          <Skeleton key={col} className="h-3 flex-1" />
        ))}
      </div>
      <div aria-hidden>
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="flex items-center gap-6 border-b border-border px-4 py-4 last:border-b-0"
          >
            {Array.from({ length: cols }, (_, col) => (
              <div key={col} className="flex-1">
                <Skeleton className={cn("h-3.5", width(row + col))} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** A vertical list: optional square/round thumbnail, a title line and a detail line per row. */
export function SkeletonList({
  rows = 5,
  thumb = "none",
  label,
  className,
}: {
  rows?: number;
  thumb?: "none" | "round" | "square";
  label?: string;
  className?: string;
}) {
  return (
    <Loading label={label} className={cn("space-y-3", className)}>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} aria-hidden className="flex items-center gap-3 py-1">
          {thumb !== "none" ? (
            <Skeleton
              className={cn("size-10 shrink-0", thumb === "round" ? "rounded-full" : "rounded-lg")}
            />
          ) : null}
          <div className="flex-1 space-y-2">
            <Skeleton className={cn("h-3.5", width(row))} />
            <Skeleton className={cn("h-3", width(row + 3))} />
          </div>
          <Skeleton className="h-3.5 w-16 shrink-0" />
        </div>
      ))}
    </Loading>
  );
}

/** A form card: a label and an input-sized bar per field. */
export function SkeletonForm({
  fields = 4,
  label,
  className,
}: {
  fields?: number;
  label?: string;
  className?: string;
}) {
  return (
    <Loading
      label={label}
      className={cn("space-y-5 rounded-xl border border-border bg-card p-6 sm:p-8", className)}
    >
      {Array.from({ length: fields }, (_, field) => (
        <div key={field} aria-hidden className="space-y-2">
          <Skeleton className={cn("h-3.5", field % 2 ? "w-28" : "w-36")} />
          <Skeleton className="h-12 w-full rounded-[8px]" />
        </div>
      ))}
    </Loading>
  );
}

/** A page title, subtitle and action buttons, matching the real page header. */
export function SkeletonHeader({ actions = 2 }: { actions?: number }) {
  return (
    <div aria-hidden className="flex items-start justify-between gap-4">
      <div className="flex-1 space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: actions }, (_, index) => (
          <Skeleton key={index} className="h-12 w-24 rounded-full" />
        ))}
      </div>
    </div>
  );
}

/** A full-page form (title + form card), for edit screens waiting on their record. */
export function SkeletonFormPage({ label, fields = 5 }: { label?: string; fields?: number }) {
  return (
    <Loading label={label} className="mx-auto w-full max-w-3xl space-y-8 px-6 py-10">
      <div aria-hidden className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-3.5 w-96 max-w-full" />
      </div>
      <div aria-hidden className="space-y-5 rounded-xl border border-border bg-card p-6 sm:p-8">
        {Array.from({ length: fields }, (_, field) => (
          <div key={field} className="space-y-2">
            <Skeleton className={cn("h-3.5", field % 2 ? "w-28" : "w-36")} />
            <Skeleton className="h-12 w-full rounded-[8px]" />
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** Stat tiles (label + number), e.g. a reports summary. */
export function SkeletonStats({ count = 4, label }: { count?: number; label?: string }) {
  return (
    <Loading label={label} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          aria-hidden
          className="space-y-3 rounded-xl border border-border bg-card p-6"
        >
          <Skeleton className={cn("h-3.5", width(index))} />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </Loading>
  );
}

/** Pill-shaped time slots for booking screens. */
export function SkeletonSlots({
  count = 12,
  label = "Loading times",
}: {
  count?: number;
  label?: string;
}) {
  return (
    <Loading label={label} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} aria-hidden className="h-11 rounded-full" />
      ))}
    </Loading>
  );
}

/** Cards with a picture and two lines, e.g. salons or favourites. */
export function SkeletonCards({ count = 3, label }: { count?: number; label?: string }) {
  return (
    <Loading label={label} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} aria-hidden className="space-y-3">
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
          <Skeleton className={cn("h-4", width(index))} />
          <Skeleton className={cn("h-3", width(index + 2))} />
        </div>
      ))}
    </Loading>
  );
}

/** A narrow centred card (booking, manage-booking, receipt pages). */
export function SkeletonPanel({
  label,
  lines = 6,
  className,
}: {
  label?: string;
  lines?: number;
  className?: string;
}) {
  return (
    <Loading
      label={label}
      className={cn(
        "w-full max-w-md space-y-4 rounded-2xl bg-card p-8 shadow-[inset_0_0_0_1px_var(--color-border)]",
        className,
      )}
    >
      <div aria-hidden className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-3/4" />
      </div>
      <div aria-hidden className="space-y-3 pt-2">
        {Array.from({ length: lines }, (_, line) => (
          <div key={line} className="flex justify-between gap-6">
            <Skeleton className={cn("h-3.5", width(line))} />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
      <Skeleton aria-hidden className="mt-2 h-12 w-full rounded-full" />
    </Loading>
  );
}

/** The dashboard frame (top bar, icon rail, page header and a table) while sign-in is checked. */
export function SkeletonAppShell() {
  return (
    <Loading
      label="Loading Bookly"
      className="flex h-[100svh] w-full flex-col overflow-hidden bg-background"
    >
      <div
        aria-hidden
        className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card pl-4 pr-6 sm:pr-8"
      >
        <Skeleton className="h-7 w-24" />
        <div className="flex items-center gap-3">
          <Skeleton className="hidden h-10 w-40 rounded-full sm:block" />
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="size-12 rounded-full" />
        </div>
      </div>
      <div aria-hidden className="flex min-h-0 flex-1">
        <div className="flex w-[72px] flex-col items-center gap-2 border-r border-border bg-card py-3">
          {Array.from({ length: 9 }, (_, index) => (
            <Skeleton key={index} className="size-10 rounded-md" />
          ))}
        </div>
        <div className="flex-1 space-y-6 overflow-hidden p-4 sm:p-8">
          <SkeletonHeader />
          <SkeletonTable cols={5} rows={7} />
        </div>
      </div>
    </Loading>
  );
}
