import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { timeToMinutes, type BusinessHour } from "@/lib/business-hours";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "./calendar-toolbar";
import {
  HOUR_HEIGHT,
  SLOT_HEIGHT,
  SLOT_MINUTES,
  formatTime,
  memberName,
  minutesOfDay,
  sameDay,
  type CalendarEvent,
  type TeamMember,
} from "./calendar-data";

export type GridColumn = { key: string; member: TeamMember; date: Date };

const DAY_HEIGHT = 24 * HOUR_HEIGHT;
const GUTTER = "w-16";

/** Diagonal hatching for hours nobody can be booked (Fresha's closed-time pattern). */
export const HATCH_STYLE: React.CSSProperties = {
  backgroundColor: "var(--hatch-bg)",
  backgroundImage:
    "repeating-linear-gradient(135deg, var(--hatch-line) 0 1px, transparent 1px 9px)",
};

const GRID_LINES: React.CSSProperties = {
  backgroundImage: [
    `repeating-linear-gradient(to bottom, var(--grid-line-strong) 0 1px, transparent 1px ${HOUR_HEIGHT}px)`,
    `repeating-linear-gradient(to bottom, var(--grid-line) 0 1px, transparent 1px ${SLOT_HEIGHT}px)`,
  ].join(","),
};

function openRange(hours: BusinessHour[] | undefined, date: Date): [number, number] | null {
  const day = hours?.find((entry) => entry.day_of_week === date.getDay());
  if (!day?.is_open) return null;
  const open = timeToMinutes(day.open_time);
  const close = timeToMinutes(day.close_time);
  if (open === null || close === null || close <= open) return null;
  return [open, close];
}

export function DateHeader({ date, now, locale }: { date: Date; now: Date; locale: string }) {
  const isToday = sameDay(date, now);
  const isPast = !isToday && date < now;
  return (
    <div className="flex items-center gap-2 px-3">
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full text-[0.9375rem] tabular-nums",
          isToday ? "bg-primary font-semibold text-primary-foreground" : isPast ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {date.getDate()}
      </span>
      <span
        className={cn(
          "truncate text-[0.9375rem]",
          isToday ? "font-medium text-primary" : isPast ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date)}
      </span>
    </div>
  );
}

export function TimeGrid({
  columns,
  headerMode,
  events,
  hours,
  now,
  locale,
  picking,
  onSlotClick,
  onEventHover,
  onEventLeave,
  onEventClick,
}: {
  columns: GridColumn[];
  /** "members": one column per team member (Day view). "dates": one column per day for a single member. */
  headerMode: "members" | "dates";
  events: CalendarEvent[];
  hours: BusinessHour[] | undefined;
  now: Date;
  locale: string;
  /** "Select a time to book" mode — every slot is highlighted on hover. */
  picking: boolean;
  onSlotClick: (event: React.MouseEvent<HTMLElement>, column: GridColumn, minutes: number) => void;
  onEventHover: (event: React.MouseEvent<HTMLElement>, appointment: CalendarEvent, member: TeamMember) => void;
  onEventLeave: () => void;
  onEventClick: (appointment: CalendarEvent) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);
  const [hover, setHover] = useState<{ column: string; minutes: number } | null>(null);
  const nowMinutes = minutesOfDay(now);
  const showsToday = columns.some((column) => sameDay(column.date, now));
  const scrollKey = columns.map((column) => column.key).join("|");

  // Land on opening time (or a little before "now" for today) instead of midnight.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || scrolledFor.current === scrollKey || !hours) return;
    const opens = columns
      .map((column) => openRange(hours, column.date)?.[0])
      .filter((value): value is number => value !== undefined);
    const target = showsToday ? Math.min(nowMinutes - 60, Math.min(...opens, nowMinutes)) : opens.length ? Math.min(...opens) : 9 * 60;
    el.scrollTop = Math.max(0, (target / 60) * HOUR_HEIGHT - 8);
    scrolledFor.current = scrollKey;
  }, [columns, hours, nowMinutes, scrollKey, showsToday]);

  // Keep the scrollbar gutter in sync so headers line up with columns.
  const [scrollbar, setScrollbar] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setScrollbar(el.offsetWidth - el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function slotFromPointer(event: React.MouseEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    return Math.max(0, Math.min(24 * 60 - SLOT_MINUTES, Math.floor(y / SLOT_HEIGHT) * SLOT_MINUTES));
  }

  const singleMember = headerMode === "dates" ? columns[0]?.member : undefined;
  const compactEvents = columns.length >= 5;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      {/* Column headers */}
      <div
        className="relative z-20 flex shrink-0 bg-card shadow-[0_6px_8px_-6px_rgb(0_0_0/0.12)]"
        style={{ paddingRight: scrollbar }}
      >
        <div className={cn(GUTTER, "shrink-0")} />
        {columns.map((column) =>
          headerMode === "members" ? (
            <div key={column.key} className="flex min-w-[7.5rem] flex-1 flex-col items-center gap-2 px-2 py-3">
              <MemberAvatar member={column.member} size={56} className="ring-2" />
              <span className="max-w-full truncate text-[0.8125rem] font-semibold text-foreground">
                {memberName(column.member)}
              </span>
            </div>
          ) : (
            <div key={column.key} className="flex h-[4.25rem] min-w-[6.5rem] flex-1 items-center">
              <DateHeader date={column.date} now={now} locale={locale} />
            </div>
          ),
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        <div className="relative flex" style={{ height: DAY_HEIGHT }}>
          {/* Time gutter — single-member views pin the member's avatar at the top */}
          <div className={cn(GUTTER, "relative shrink-0 bg-card")}>
            {singleMember ? (
              <div className="sticky top-0 z-10 flex flex-col items-center gap-1 bg-card pb-2 pt-1">
                <MemberAvatar member={singleMember} size={40} />
                <span className="max-w-full truncate px-1 text-[0.75rem] font-semibold">{singleMember.first_name}</span>
              </div>
            ) : null}
            {Array.from({ length: 24 }, (_, hour) =>
              hour === 0 ? null : (
                <span
                  key={hour}
                  className="absolute right-2 text-[0.8125rem] font-semibold tabular-nums text-foreground"
                  style={{ top: hour * HOUR_HEIGHT + 4 }}
                >
                  {formatTime(hour * 60)}
                </span>
              ),
            )}
            {showsToday ? (
              <span
                className="absolute right-1 z-10 -translate-y-1/2 rounded-full border border-destructive bg-card px-1.5 text-[0.75rem] font-medium leading-5 tabular-nums text-destructive"
                style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
              >
                {formatTime(nowMinutes)}
              </span>
            ) : null}
          </div>

          {columns.map((column) => {
            const range = openRange(hours, column.date);
            const columnEvents = events.filter(
              (appointment) => appointment.teamMemberId === column.member.id && sameDay(appointment.start, column.date),
            );
            const isToday = sameDay(column.date, now);
            const hovered = hover?.column === column.key ? hover.minutes : null;
            const withinHours = (minutes: number) => range !== null && minutes >= range[0] && minutes < range[1];

            return (
              <div
                key={column.key}
                className={cn(
                  "relative min-w-[7.5rem] flex-1 border-l border-[var(--grid-line-strong)]",
                  headerMode === "dates" && "min-w-[6.5rem]",
                  picking ? "cursor-copy" : "cursor-pointer",
                )}
                style={GRID_LINES}
                onMouseMove={(event) => {
                  const minutes = slotFromPointer(event);
                  if (hovered !== minutes) setHover({ column: column.key, minutes });
                }}
                onMouseLeave={() => setHover(null)}
                onClick={(event) => {
                  const minutes = slotFromPointer(event);
                  if (picking || withinHours(minutes)) onSlotClick(event, column, minutes);
                }}
              >
                {/* Closed hours */}
                {range === null ? (
                  <div className="pointer-events-none absolute inset-0" style={HATCH_STYLE} />
                ) : (
                  <>
                    <div className="pointer-events-none absolute inset-x-0 top-0" style={{ ...HATCH_STYLE, height: (range[0] / 60) * HOUR_HEIGHT }} />
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0"
                      style={{ ...HATCH_STYLE, top: (range[1] / 60) * HOUR_HEIGHT }}
                    />
                  </>
                )}

                {/* Hovered slot with its start time, like Fresha */}
                {hovered !== null && (picking || withinHours(hovered)) ? (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-[5] rounded-[4px] bg-primary/10 px-1.5 text-[0.75rem] font-medium leading-6 text-primary"
                    style={{ top: (hovered / SLOT_MINUTES) * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                  >
                    {formatTime(hovered)}
                  </div>
                ) : null}

                {columnEvents.map((appointment) => {
                  const start = minutesOfDay(appointment.start);
                  const end = sameDay(appointment.start, appointment.end) ? minutesOfDay(appointment.end) : 24 * 60;
                  const height = Math.max(SLOT_HEIGHT, ((end - start) / SLOT_MINUTES) * SLOT_HEIGHT - 2);
                  const roomy = height >= SLOT_HEIGHT * 3;
                  return (
                    <button
                      type="button"
                      key={appointment.id}
                      className={cn(
                        "absolute inset-x-1 z-10 overflow-hidden rounded-[4px] px-1.5 py-1 text-left text-[0.8125rem] leading-[1.15rem] text-[#0d0d0d] transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        appointment.status === "no_show" && "opacity-60",
                      )}
                      style={{
                        top: (start / SLOT_MINUTES) * SLOT_HEIGHT + 1,
                        height,
                        backgroundColor: column.member.calendar_color || "#a5d8f3",
                      }}
                      onMouseEnter={(event) => onEventHover(event, appointment, column.member)}
                      onMouseLeave={onEventLeave}
                      onMouseMove={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEventClick(appointment);
                      }}
                    >
                      {compactEvents && roomy ? (
                        <>
                          <span className="block truncate">
                            {formatTime(start)} - {formatTime(end)}
                          </span>
                          <span className="block truncate font-semibold">{appointment.title}</span>
                          <span className="block truncate">{appointment.serviceName}</span>
                        </>
                      ) : (
                        <>
                          <span className="block truncate">
                            {formatTime(start)} - {formatTime(end)} <span className="font-semibold">{appointment.title}</span>
                          </span>
                          {roomy || height > SLOT_HEIGHT * 1.5 ? (
                            <span className="block truncate">{appointment.serviceName}</span>
                          ) : null}
                        </>
                      )}
                    </button>
                  );
                })}

                {/* Current time */}
                {isToday || (headerMode === "members" && showsToday) ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-[15] h-px bg-destructive"
                    style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
