import { timeToMinutes, type BusinessHour } from "@/lib/business-hours";
import { cn } from "@/lib/utils";
import { EventChip } from "./roster-grid";
import { HATCH_STYLE } from "./time-grid";
import { sameDay, type CalendarEvent, type TeamMember } from "./calendar-data";

const MAX_CHIPS = 3;

export function MonthGrid({
  anchor,
  days,
  members,
  events,
  hours,
  now,
  locale,
  onDayClick,
  onEventHover,
  onEventLeave,
  onEventClick,
}: {
  anchor: Date;
  days: Date[];
  members: TeamMember[];
  events: CalendarEvent[];
  hours: BusinessHour[] | undefined;
  now: Date;
  locale: string;
  onDayClick: (date: Date) => void;
  onEventHover: (event: React.MouseEvent<HTMLElement>, appointment: CalendarEvent, member: TeamMember) => void;
  onEventLeave: () => void;
  onEventClick: (appointment: CalendarEvent) => void;
}) {
  const byId = new Map(members.map((member) => [member.id, member]));
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" });
  const monthName = new Intl.DateTimeFormat(locale, { month: "long" });
  const weeks = days.length / 7;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-card">
      <div className="sticky top-0 z-10 grid min-w-[42rem] grid-cols-7 bg-card shadow-[0_6px_8px_-6px_rgb(0_0_0/0.12)]">
        {days.slice(0, 7).map((date) => (
          <div key={date.toISOString()} className="px-3 py-3 text-[0.9375rem] text-foreground">
            {weekday.format(date)}
          </div>
        ))}
      </div>
      <div
        className="grid min-h-[36rem] min-w-[42rem] flex-1 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${weeks}, minmax(7.5rem, 1fr))` }}
      >
        {days.map((date) => {
          const day = hours?.find((entry) => entry.day_of_week === date.getDay());
          const closed = !day?.is_open || timeToMinutes(day.open_time) === null;
          const outside = date.getMonth() !== anchor.getMonth();
          const isToday = sameDay(date, now);
          const dayEvents = events.filter(
            (appointment) => byId.has(appointment.teamMemberId) && sameDay(appointment.start, date),
          );
          return (
            <div
              key={date.toISOString()}
              role="button"
              tabIndex={0}
              onClick={() => onDayClick(date)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onDayClick(date);
              }}
              className="min-w-0 cursor-pointer space-y-1 border-l border-t border-[var(--grid-line-strong)] p-1.5 first:border-l-0 hover:bg-primary/5 [&:nth-child(7n+1)]:border-l-0"
              style={closed || outside ? HATCH_STYLE : undefined}
            >
              <span
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[0.75rem] font-semibold tabular-nums",
                  isToday ? "bg-primary text-primary-foreground" : outside || closed ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {date.getDate() === 1 ? `${date.getDate()} ${monthName.format(date)}` : date.getDate()}
              </span>
              {dayEvents.slice(0, MAX_CHIPS).map((appointment) => (
                <EventChip
                  key={appointment.id}
                  appointment={appointment}
                  member={byId.get(appointment.teamMemberId)}
                  showEnd={false}
                  onHover={onEventHover}
                  onLeave={onEventLeave}
                  onClick={onEventClick}
                />
              ))}
              {dayEvents.length > MAX_CHIPS ? (
                <span className="block px-1.5 text-[0.75rem] font-medium text-primary">
                  +{dayEvents.length - MAX_CHIPS} more
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
