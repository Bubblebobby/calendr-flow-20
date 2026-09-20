import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarPlus,
  CaretLeft,
  CaretRight,
  CaretDown,
  ArrowClockwise,
  CalendarX,
  FadersHorizontal,
  Gear,
  UserPlus,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/use-business";
import { timeToMinutes, useBusinessHours } from "@/lib/business-hours";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { AppointmentDialog } from "@/components/calendar/appointment-dialog";
import { AppointmentDetail, statusTone } from "@/components/calendar/appointment-detail";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";


const SLOT_MINUTES = 15;
const SLOT_HEIGHT = 18; // px — 72px per hour keeps a full day scannable
const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;

type TeamMember = {
  id: string;
  first_name: string;
  last_name: string | null;
  avatar_color: string;
  calendar_color: string;
  initials: string | null;
  job_title: string | null;
};

function memberName(m: TeamMember) {
  return [m.first_name, m.last_name].filter(Boolean).join(" ");
}

function deriveInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function useTeamMembers(businessId: string | undefined) {
  return useQuery({
    queryKey: ["calendar-team-members", businessId],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, first_name, last_name, avatar_color, calendar_color, initials, job_title")
        .eq("business_id", businessId!)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
  });
}

type CalendarEvent = {
  id: string;
  appointmentId: string;
  team_member_id: string;
  startMinutes: number;
  endMinutes: number;
  title: string;
  email: string | null;
  serviceName: string;
  status: string;
  price: number | null;
};

function useAppointments(businessId: string | undefined, day: Date) {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  return useQuery({
    queryKey: ["calendar-appointments", businessId, dayStart.toDateString()],
    enabled: Boolean(businessId),
    queryFn: async (): Promise<CalendarEvent[]> => {
      const { data, error } = await supabase
        .from("appointment_items")
        .select(
          "id, appointment_id, team_member_id, start_time, end_time, price, services(name), appointments(status, is_walk_in, clients(first_name, last_name, email))",
        )
        .eq("business_id", businessId!)
        .gte("start_time", dayStart.toISOString())
        .lt("start_time", dayEnd.toISOString());
      if (error) throw error;

      return (data ?? [])
        .filter((row: any) => row.appointments?.status !== "cancelled")
        .map((row: any) => {
          const start = new Date(row.start_time);
          const end = new Date(row.end_time);
          const client = row.appointments?.clients;
          return {
            id: row.id,
            appointmentId: row.appointment_id,
            team_member_id: row.team_member_id,
            startMinutes: start.getHours() * 60 + start.getMinutes(),
            endMinutes: end.getHours() * 60 + end.getMinutes(),
            title: client
              ? [client.first_name, client.last_name].filter(Boolean).join(" ")
              : "Walk-in",
            email: client?.email ?? null,
            serviceName: row.services?.name ?? "Service",
            status: row.appointments?.status ?? "booked",
            price: row.price,
          } satisfies CalendarEvent;
        });
    },
  });
}


function formatSlotLabel(minutes: number, locale: string) {
  const date = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
}

export function DayCalendar() {
  const { data: business } = useBusiness();
  const { data: members, isLoading: loadingMembers } = useTeamMembers(business?.id);
  const { data: hours } = useBusinessHours(business?.id);


  const [selected, setSelected] = useState(() => new Date());
  const { data: appointments } = useAppointments(business?.id, selected);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [quickAction, setQuickAction] = useState<{
    member: TeamMember;
    minutes: number;
    x: number;
    y: number;
  } | null>(null);
  const [bookingSlot, setBookingSlot] = useState<{
    member: TeamMember;
    minutes: number;
  } | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<{
    appointment: CalendarEvent;
    member: TeamMember;
    x: number;
    y: number;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const didScroll = useRef(false);

  const locale = typeof navigator !== "undefined" ? navigator.language : "en";

  const dayHours = useMemo(
    () => hours?.find((h) => h.day_of_week === selected.getDay()),
    [hours, selected],
  );

  const openMinutes = dayHours?.is_open ? timeToMinutes(dayHours.open_time) : null;
  const closeMinutes = dayHours?.is_open ? timeToMinutes(dayHours.close_time) : null;

  const slots = useMemo(
    () => Array.from({ length: SLOTS_PER_DAY }, (_, i) => i * SLOT_MINUTES),
    [],
  );

  // Land on the day's opening hours instead of midnight.
  useLayoutEffect(() => {
    didScroll.current = false;
  }, [selected]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || didScroll.current || !hours) return;
    const target = openMinutes ?? 9 * 60;
    el.scrollTop = Math.max(0, (target / SLOT_MINUTES) * SLOT_HEIGHT - SLOT_HEIGHT * 4);
    didScroll.current = true;
  }, [hours, openMinutes, selected]);

  function shiftDay(delta: number) {
    setSelected((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + delta);
      return next;
    });
  }

  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(selected);

  const currency = business?.currency;

  function formatPrice(value: number | null) {
    if (value === null || !currency) return null;
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
  }

  function showAppointment(
    event: React.MouseEvent<HTMLDivElement>,
    appointment: CalendarEvent,
    member: TeamMember,
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = 372;
    const x = Math.min(
      Math.max(16, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - 16,
    );
    const preferredTop = rect.top - 220;
    setHoveredEvent({
      appointment,
      member,
      x,
      y: preferredTop >= 16 ? preferredTop : Math.min(window.innerHeight - 210, rect.bottom + 10),
    });
  }

  function handleSlotClick(
    event: React.MouseEvent<HTMLButtonElement>,
    member: TeamMember,
    minutes: number,
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    // Anchor to the slot; clamp so the popup never clips off-screen.
    const popupWidth = 300;
    const popupHeight = 230;
    const x = Math.min(rect.left + 12, window.innerWidth - popupWidth - 16);
    const y = Math.min(rect.top, window.innerHeight - popupHeight - 16);
    setQuickAction({ member, minutes, x: Math.max(16, x), y: Math.max(16, y) });
  }

  function handleQuickAction(action: "appointment" | "group" | "block") {
    const slot = quickAction;
    setQuickAction(null);
    if (!slot) return;
    if (action === "appointment") {
      setBookingSlot({ member: slot.member, minutes: slot.minutes });
      return;
    }
    toast("Coming soon", {
      description:
        action === "group"
          ? "Group appointments are on the way."
          : "Blocked time is on the way.",
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Compact calendar toolbar */}
      <div className="flex min-h-16 flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
        <Button variant="outline" className="rounded-full px-4" onClick={() => setSelected(new Date())}>
          Today
        </Button>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous day"
            onClick={() => shiftDay(-1)}
            className="rounded-l-full rounded-r-none"
          >
            <CaretLeft size={16} weight="bold" />
          </Button>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="min-w-44 rounded-none border-x-0 px-5 font-semibold"
              >
                {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selected}
                onSelect={(date) => {
                  if (date) setSelected(date);
                  setPickerOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next day"
            onClick={() => shiftDay(1)}
            className="rounded-l-none rounded-r-full"
          >
            <CaretRight size={16} weight="bold" />
          </Button>
        </div>
        <Button variant="outline" className="rounded-full px-4" onClick={() => toast("Team filtering is coming soon")}>
          Scheduled team <CaretDown size={14} />
        </Button>
        <Button variant="outline" size="icon" className="rounded-full" aria-label="Calendar filters" onClick={() => toast("Calendar filters are coming soon")}>
          <FadersHorizontal size={18} />
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon" className="rounded-full" aria-label="Calendar settings" onClick={() => toast("Calendar settings are coming soon")}>
            <Gear size={18} />
          </Button>
          <Button variant="outline" size="icon" className="rounded-full" aria-label="Refresh calendar" onClick={() => window.location.reload()}>
            <ArrowClockwise size={18} />
          </Button>
          <Button variant="outline" className="rounded-full px-4" onClick={() => toast("More calendar views are coming soon")}>
            Day <CaretDown size={14} />
          </Button>
          <Button className="rounded-full bg-ink px-5 text-ink-foreground hover:bg-ink/90" onClick={() => toast("Choose an open time on the calendar to add a booking")}>
            Add <CaretDown size={14} />
          </Button>
        </div>
      </div>

      {loadingMembers ? (
        <div className="flex flex-1 gap-3 p-5">
          <Skeleton className="h-full w-16" />
          <Skeleton className="h-full flex-1" />
        </div>
      ) : !members || members.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="surface-card flex max-w-md flex-col items-center gap-3 p-10 text-center">
            <UsersThree size={32} className="text-muted-foreground" />
            <p className="text-base font-semibold text-foreground">No team members yet</p>
            <p className="text-sm text-muted-foreground">
              The calendar shows one column per active team member. Add your first team member to
              start scheduling appointments.
            </p>
            <Button asChild className="mt-2">
              <Link to="/team">Add team members</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Column headers */}
          <div className="flex shrink-0 border-b border-border bg-card pr-[15px]">
            <div className="w-16 shrink-0 border-r border-border" />
            {members.map((member) => (
              <div
                key={member.id}
                className="min-w-0 flex-1 border-r border-border last:border-r-0"
              >
                <div className="flex h-16 items-center justify-center gap-2 px-3">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: member.avatar_color }}
                  >
                    {member.initials || deriveInitials(memberName(member))}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {memberName(member)}
                    </span>
                    {member.job_title ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {member.job_title}
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Scrollable grid */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-card">
            <div className="flex">
              {/* Time gutter */}
              <div className="w-16 shrink-0 border-r border-border bg-card">
                {slots.map((minutes) =>
                  minutes % 60 === 0 ? (
                    <div
                      key={minutes}
                      style={{ height: SLOT_HEIGHT * 4 }}
                      className="relative"
                    >
                      <span className="absolute right-2 top-0 -translate-y-1/2 text-[11px] font-medium tabular-nums text-muted-foreground">
                        {minutes === 0 ? "" : formatSlotLabel(minutes, locale)}
                      </span>
                    </div>
                  ) : null,
                )}
              </div>

              {/* Member columns */}
              {members.map((member) => (
                <div
                  key={member.id}
                  className="relative min-w-0 flex-1 border-r border-border last:border-r-0"
                >
                  {/* Booked appointments overlay the slot grid */}
                  {(appointments ?? [])
                    .filter((a) => a.team_member_id === member.id)
                    .map((a) => (
                      <div
                        key={a.id}
                        className="absolute inset-x-0.5 z-10 overflow-hidden rounded-[3px] border border-primary/70 bg-slot-blue px-2 py-1.5 text-left text-slot-blue-foreground transition-[filter] hover:brightness-[0.98]"
                        style={{
                          top: (a.startMinutes / SLOT_MINUTES) * SLOT_HEIGHT,
                          height: Math.max(
                            SLOT_HEIGHT,
                            ((a.endMinutes - a.startMinutes) / SLOT_MINUTES) * SLOT_HEIGHT,
                          ),
                        }}
                        title={`${formatSlotLabel(a.startMinutes, locale)} · ${a.title}`}
                        onMouseEnter={(event) => showAppointment(event, a, member)}
                        onMouseLeave={() => setHoveredEvent(null)}
                      >
                        <p className="truncate text-xs text-slot-blue-foreground">
                          {formatSlotLabel(a.startMinutes, locale)} – {formatSlotLabel(a.endMinutes, locale)} <span className="font-semibold">{a.title}</span>
                        </p>
                        <p className="truncate text-xs text-slot-blue-foreground">
                          {a.serviceName}
                        </p>
                      </div>
                    ))}

                  {slots.map((minutes) => {
                    const withinHours =
                      openMinutes !== null &&
                      closeMinutes !== null &&
                      minutes >= openMinutes &&
                      minutes < closeMinutes;
                    const isHour = minutes % 60 === 0;
                    const isHalf = minutes % 60 === 30;

                    if (!withinHours) {
                      return (
                        <div
                          key={minutes}
                          aria-disabled="true"
                          style={{
                            height: SLOT_HEIGHT,
                            backgroundImage:
                              "repeating-linear-gradient(135deg, transparent 0 6px, oklch(0.22 0.03 240 / 0.05) 6px 7px)",
                          }}
                          className={cn(
                            "bg-muted/40",
                            isHour
                              ? "border-t border-border"
                              : isHalf
                                ? "border-t border-border/50"
                                : "border-t border-transparent",
                          )}
                        />
                      );
                    }

                    return (
                      <button
                        key={minutes}
                        type="button"
                        onClick={(event) => handleSlotClick(event, member, minutes)}
                        title={`${formatSlotLabel(minutes, locale)} · ${memberName(member)}`}
                        style={{ height: SLOT_HEIGHT }}
                        className={cn(
                            "block w-full cursor-pointer text-left transition-colors duration-75",
                          "hover:bg-primary/10 active:bg-primary/20",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                          isHour
                            ? "border-t border-border"
                            : isHalf
                              ? "border-t border-border/50"
                              : "border-t border-transparent",
                        )}
                      >
                        <span className="sr-only">
                          {`Book ${formatSlotLabel(minutes, locale)} with ${memberName(member)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {hoveredEvent ? (
        <div
          className="pointer-events-none fixed z-[70] w-[372px] overflow-hidden rounded-lg border border-border bg-popover shadow-xl animate-in fade-in-0 zoom-in-95 duration-150"
          style={{ left: hoveredEvent.x, top: hoveredEvent.y }}
          role="status"
        >
          <div className="flex h-11 items-center justify-between bg-primary px-5 text-sm text-primary-foreground">
            <span>{formatSlotLabel(hoveredEvent.appointment.startMinutes, locale)} – {formatSlotLabel(hoveredEvent.appointment.endMinutes, locale)}</span>
            <span className="capitalize">{hoveredEvent.appointment.status.replace("_", " ")}</span>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-semibold text-primary">
                {deriveInitials(hoveredEvent.appointment.title)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-popover-foreground">{hoveredEvent.appointment.title}</p>
                {hoveredEvent.appointment.email ? <p className="truncate text-sm text-muted-foreground">{hoveredEvent.appointment.email}</p> : null}
              </div>
            </div>
            <div className="mt-5 flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-popover-foreground">{hoveredEvent.appointment.serviceName}</p>
                <p className="text-sm text-muted-foreground">{memberName(hoveredEvent.member)} · {Math.max(0, hoveredEvent.appointment.endMinutes - hoveredEvent.appointment.startMinutes)} min</p>
              </div>
              {formatPrice(hoveredEvent.appointment.price) ? <p className="font-semibold text-popover-foreground">{formatPrice(hoveredEvent.appointment.price)}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Quick-action popup anchored to the clicked slot */}
      {quickAction ? (
        <div
          role="presentation"
          className="fixed inset-0 z-50"
          onClick={() => setQuickAction(null)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuickAction(null);
          }}
        >
          <div
            role="menu"
            aria-label="Slot actions"
            className="surface-card absolute w-[300px] overflow-hidden rounded-xl p-0 shadow-lg"
            style={{ left: quickAction.x, top: quickAction.y }}
            onClick={(event) => event.stopPropagation()}
            ref={(node) => node?.focus()}
            tabIndex={-1}
          >
            <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                {formatSlotLabel(quickAction.minutes, locale)} — {memberName(quickAction.member)}
              </p>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setQuickAction(null)}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X size={14} weight="bold" />
              </button>
            </div>
            <div className="flex flex-col gap-0.5 p-2">
              <button
                type="button"
                role="menuitem"
                onClick={() => handleQuickAction("appointment")}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary active:bg-secondary/80"
              >
                <CalendarPlus size={18} className="text-muted-foreground" />
                Add appointment
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleQuickAction("group")}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary active:bg-secondary/80"
              >
                <UserPlus size={18} className="text-muted-foreground" />
                Add group appointment
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleQuickAction("block")}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary active:bg-secondary/80"
              >
                <CalendarX size={18} className="text-muted-foreground" />
                Block time
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AppointmentDialog
        slot={
          bookingSlot
            ? { member: bookingSlot.member, minutes: bookingSlot.minutes, date: selected }
            : null
        }
        business={business}
        team={members ?? []}
        onClose={() => setBookingSlot(null)}
      />

    </div>
  );
}
