import { timeToMinutes, type BusinessHour } from "@/lib/business-hours";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "./calendar-toolbar";
import { DateHeader, HATCH_STYLE } from "./time-grid";
import {
  formatDateTime,
  sameDay,
  type CalendarEvent,
  type CalendarView,
  type TeamMember,
} from "./calendar-data";

function isClosed(hours: BusinessHour[] | undefined, date: Date) {
  const day = hours?.find((entry) => entry.day_of_week === date.getDay());
  return !day?.is_open || timeToMinutes(day.open_time) === null;
}

export function EventChip({
  appointment,
  member,
  showEnd,
  onHover,
  onLeave,
  onClick,
}: {
  appointment: CalendarEvent;
  member: TeamMember | undefined;
  showEnd: boolean;
  onHover: (event: React.MouseEvent<HTMLElement>, appointment: CalendarEvent, member: TeamMember) => void;
  onLeave: () => void;
  onClick: (appointment: CalendarEvent) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "block w-full truncate rounded-[4px] px-1.5 text-left text-[0.75rem] leading-6 text-[#0d0d0d] transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        appointment.status === "no_show" && "opacity-60",
      )}
      style={{ backgroundColor: member?.calendar_color || "#a5d8f3" }}
      onMouseEnter={(event) => member && onHover(event, appointment, member)}
      onMouseLeave={onLeave}
      onClick={(event) => {
        event.stopPropagation();
        onClick(appointment);
      }}
    >
      {formatDateTime(appointment.start)}
      {showEnd ? ` - ${formatDateTime(appointment.end)}` : ""} <span className="font-semibold">{appointment.title}</span>
    </button>
  );
}

/** 3-day / week view with several team members: one row per member, one column per day. */
export function RosterGrid({
  view,
  days,
  members,
  events,
  hours,
  now,
  locale,
  onCellClick,
  onEventHover,
  onEventLeave,
  onEventClick,
}: {
  view: CalendarView;
  days: Date[];
  members: TeamMember[];
  events: CalendarEvent[];
  hours: BusinessHour[] | undefined;
  now: Date;
  locale: string;
  onCellClick: (member: TeamMember, date: Date) => void;
  onEventHover: (event: React.MouseEvent<HTMLElement>, appointment: CalendarEvent, member: TeamMember) => void;
  onEventLeave: () => void;
  onEventClick: (appointment: CalendarEvent) => void;
}) {
  const template = `5rem repeat(${days.length}, minmax(${view === "week" ? "5.25rem" : "10rem"}, 1fr))`;
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-card">
      <div className="min-w-full">
        <div
          className="sticky top-0 z-20 grid bg-card shadow-[0_6px_8px_-6px_rgb(0_0_0/0.12)]"
          style={{ gridTemplateColumns: template }}
        >
          <div />
          {days.map((date) => (
            <div key={date.toISOString()} className="flex h-[4.25rem] min-w-0 items-center overflow-hidden">
              <DateHeader date={date} now={now} locale={locale} />
            </div>
          ))}
        </div>

        {members.map((member) => (
          <div
            key={member.id}
            className="grid border-b border-[var(--grid-line-strong)]"
            style={{ gridTemplateColumns: template, minHeight: "15rem" }}
          >
            <div className="flex flex-col items-center justify-center gap-1.5 px-1 text-center">
              <MemberAvatar member={member} size={40} />
              <span className="line-clamp-2 text-[0.75rem] font-semibold leading-4 text-foreground">
                {member.first_name} {member.last_name}
              </span>
            </div>
            {days.map((date) => {
              const cellEvents = events.filter(
                (appointment) => appointment.teamMemberId === member.id && sameDay(appointment.start, date),
              );
              return (
                <div
                  key={date.toISOString()}
                  role="button"
                  tabIndex={0}
                  aria-label={`Add appointment for ${member.first_name} on ${date.toDateString()}`}
                  onClick={() => onCellClick(member, date)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onCellClick(member, date);
                  }}
                  className="cursor-pointer space-y-1 border-l border-[var(--grid-line-strong)] p-1 hover:bg-primary/5"
                  style={isClosed(hours, date) ? HATCH_STYLE : undefined}
                >
                  {cellEvents.map((appointment) => (
                    <EventChip
                      key={appointment.id}
                      appointment={appointment}
                      member={member}
                      showEnd={view === "3day"}
                      onHover={onEventHover}
                      onLeave={onEventLeave}
                      onClick={onEventClick}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
