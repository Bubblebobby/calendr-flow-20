import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, CalendarX, UserPlus, UsersThree, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { useBusiness } from "@/lib/use-business";
import { useBusinessHours } from "@/lib/business-hours";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppointmentDialog } from "@/components/calendar/appointment-dialog";
import { AppointmentDetail } from "@/components/calendar/appointment-detail";
import { CalendarToolbar, type AddAction } from "./calendar-toolbar";
import { MonthGrid } from "./month-grid";
import { RosterGrid } from "./roster-grid";
import { TimeGrid, type GridColumn } from "./time-grid";
import {
  addDays,
  deriveInitials,
  formatDateTime,
  formatTime,
  memberName,
  selectMembers,
  shiftAnchor,
  startOfDay,
  useCalendarEvents,
  useCurrentUserId,
  useTeamMembers,
  viewDays,
  type CalendarEvent,
  type CalendarView,
  type TeamMember,
  type TeamSelection,
} from "./calendar-data";

export type CalendarSearch = { view?: CalendarView; date?: string; team?: string };

/** Re-renders every 30s so the now-line keeps moving. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export function CalendarPage({
  view,
  anchor,
  selection,
  onNavigate,
}: {
  view: CalendarView;
  anchor: Date;
  selection: TeamSelection;
  onNavigate: (next: { view?: CalendarView; date?: Date; team?: TeamSelection }) => void;
}) {
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const { data: allMembers, isLoading: loadingMembers } = useTeamMembers(business?.id);
  const { data: currentUserId } = useCurrentUserId();
  const { data: hours } = useBusinessHours(business?.id);
  const now = useNow();
  const locale = typeof navigator !== "undefined" ? navigator.language : "en";

  const days = useMemo(() => viewDays(view, anchor), [view, anchor]);
  const rangeStart = days[0]!;
  const rangeEnd = addDays(days[days.length - 1]!, 1);
  const { data: events = [] } = useCalendarEvents(business?.id, rangeStart, rangeEnd);
  const members = useMemo(
    () => selectMembers(allMembers ?? [], selection, currentUserId),
    [allMembers, selection, currentUserId],
  );

  const [picking, setPicking] = useState(false);
  const [quickAction, setQuickAction] = useState<{ column: GridColumn; minutes: number; x: number; y: number } | null>(null);
  const [bookingSlot, setBookingSlot] = useState<{ member: TeamMember; minutes: number; date: Date } | null>(null);
  const [hovered, setHovered] = useState<{ appointment: CalendarEvent; member: TeamMember; x: number; y: number } | null>(null);
  const [detail, setDetail] = useState<{ id: string; label: string } | null>(null);
  const [detailMinimized, setDetailMinimized] = useState(false);

  useEffect(() => {
    if (!picking) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setPicking(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picking]);

  const soon = (feature: string) => toast(`${feature} is coming in the next calendar stage`);

  function handleAdd(action: AddAction) {
    if (action === "appointment") {
      setPicking(true);
      return;
    }
    soon(
      {
        group: "Group appointments",
        blocked: "Blocked time",
        sale: "New sale from the calendar",
        "quick-payment": "Quick payment",
        appointment: "",
      }[action],
    );
  }

  function showAppointment(event: React.MouseEvent<HTMLElement>, appointment: CalendarEvent, member: TeamMember) {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = 372;
    const x = Math.min(Math.max(16, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 16);
    const preferredTop = rect.top - 220;
    setHovered({
      appointment,
      member,
      x,
      y: preferredTop >= 16 ? preferredTop : Math.min(window.innerHeight - 210, rect.bottom + 10),
    });
  }

  function openAppointment(appointment: CalendarEvent) {
    setHovered(null);
    setDetailMinimized(false);
    setDetail({ id: appointment.appointmentId, label: `${appointment.title} · ${formatDateTime(appointment.start)}` });
  }

  function handleSlotClick(event: React.MouseEvent<HTMLElement>, column: GridColumn, minutes: number) {
    if (picking) {
      setPicking(false);
      setBookingSlot({ member: column.member, minutes, date: column.date });
      return;
    }
    const popupWidth = 300;
    const popupHeight = 230;
    const x = Math.min(event.clientX + 8, window.innerWidth - popupWidth - 16);
    const y = Math.min(event.clientY - 12, window.innerHeight - popupHeight - 16);
    setQuickAction({ column, minutes, x: Math.max(16, x), y: Math.max(16, y) });
  }

  function handleQuickAction(action: "appointment" | "group" | "block") {
    const slot = quickAction;
    setQuickAction(null);
    if (!slot) return;
    if (action === "appointment") {
      setBookingSlot({ member: slot.column.member, minutes: slot.minutes, date: slot.column.date });
      return;
    }
    soon(action === "group" ? "Group appointments" : "Blocked time");
  }

  // Multi-member 3-day/week views drill into the day view, like Fresha.
  const openDay = (date: Date) => onNavigate({ view: "day", date });

  const currency = business?.currency;
  const formatPrice = (value: number | null) =>
    value === null || !currency ? null : new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);

  let body: React.ReactNode;
  if (loadingMembers) {
    body = (
      <div className="flex flex-1 gap-3 bg-card p-5">
        <Skeleton className="h-full w-16" />
        <Skeleton className="h-full flex-1" />
      </div>
    );
  } else if (!allMembers || allMembers.length === 0) {
    body = (
      <div className="flex flex-1 items-center justify-center bg-card p-8">
        <div className="surface-card flex max-w-md flex-col items-center gap-3 p-10 text-center">
          <UsersThree size={32} className="text-muted-foreground" />
          <p className="text-base font-semibold text-foreground">No team members yet</p>
          <p className="text-sm text-muted-foreground">
            The calendar shows one column per active team member. Add your first team member to start scheduling
            appointments.
          </p>
          <Button asChild className="mt-2">
            <Link to="/team">Add team members</Link>
          </Button>
        </div>
      </div>
    );
  } else if (view === "month") {
    body = (
      <MonthGrid
        anchor={anchor}
        days={days}
        members={members}
        events={events}
        hours={hours}
        now={now}
        locale={locale}
        onDayClick={openDay}
        onEventHover={showAppointment}
        onEventLeave={() => setHovered(null)}
        onEventClick={openAppointment}
      />
    );
  } else if (view !== "day" && members.length > 1) {
    body = (
      <RosterGrid
        view={view}
        days={days}
        members={members}
        events={events}
        hours={hours}
        now={now}
        locale={locale}
        onCellClick={(_, date) => openDay(date)}
        onEventHover={showAppointment}
        onEventLeave={() => setHovered(null)}
        onEventClick={openAppointment}
      />
    );
  } else {
    const columns: GridColumn[] =
      view === "day"
        ? members.map((member) => ({ key: `${member.id}-${days[0]!.toDateString()}`, member, date: days[0]! }))
        : days.map((date) => ({ key: `${members[0]!.id}-${date.toDateString()}`, member: members[0]!, date }));
    body = (
      <TimeGrid
        columns={columns}
        headerMode={view === "day" ? "members" : "dates"}
        events={events}
        hours={hours}
        now={now}
        locale={locale}
        picking={picking}
        onSlotClick={handleSlotClick}
        onEventHover={showAppointment}
        onEventLeave={() => setHovered(null)}
        onEventClick={openAppointment}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {picking ? (
        <div className="flex h-12 shrink-0 items-center justify-center gap-3 bg-primary px-4 text-primary-foreground">
          <span className="text-[0.9375rem] font-semibold">Select a time to book</span>
          <button
            type="button"
            onClick={() => setPicking(false)}
            className="absolute right-4 h-8 rounded-full bg-card px-4 text-[0.8125rem] font-semibold text-foreground hover:bg-secondary"
          >
            Close
          </button>
        </div>
      ) : null}

      <CalendarToolbar
        view={view}
        anchor={anchor}
        days={days}
        locale={locale}
        members={allMembers ?? []}
        selection={selection}
        currentUserId={currentUserId}
        onToday={() => onNavigate({ date: startOfDay(new Date()) })}
        onShift={(direction) => onNavigate({ date: shiftAnchor(view, anchor, direction) })}
        onPickDate={(date) => onNavigate({ date })}
        onViewChange={(next) => onNavigate({ view: next })}
        onSelectionChange={(team) => onNavigate({ team })}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] })}
        onAdd={handleAdd}
        onSoon={soon}
      />

      {body}

      {hovered ? (
        <div
          className="pointer-events-none fixed z-[70] w-[372px] overflow-hidden rounded-xl border border-border bg-popover shadow-xl animate-in fade-in-0 zoom-in-95 duration-150"
          style={{ left: hovered.x, top: hovered.y }}
          role="status"
        >
          <div className="flex h-11 items-center justify-between bg-primary px-5 text-sm text-primary-foreground">
            <span>
              {formatDateTime(hovered.appointment.start)} - {formatDateTime(hovered.appointment.end)}
            </span>
            <span className="capitalize">{hovered.appointment.status.replace("_", " ")}</span>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-semibold text-primary">
                {deriveInitials(hovered.appointment.title)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-popover-foreground">{hovered.appointment.title}</p>
                {hovered.appointment.email ? (
                  <p className="truncate text-sm text-muted-foreground">{hovered.appointment.email}</p>
                ) : null}
              </div>
            </div>
            <div className="mt-5 flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-popover-foreground">{hovered.appointment.serviceName}</p>
                <p className="text-sm text-muted-foreground">
                  {memberName(hovered.member)} ·{" "}
                  {Math.max(0, Math.round((hovered.appointment.end.getTime() - hovered.appointment.start.getTime()) / 60000))}{" "}
                  min
                </p>
              </div>
              {formatPrice(hovered.appointment.price) ? (
                <p className="font-semibold text-popover-foreground">{formatPrice(hovered.appointment.price)}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

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
                {formatTime(quickAction.minutes)} — {memberName(quickAction.column.member)}
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
              {(
                [
                  ["appointment", "Add appointment", CalendarPlus],
                  ["group", "Add group appointment", UserPlus],
                  ["block", "Add blocked time", CalendarX],
                ] as const
              ).map(([action, label, Icon]) => (
                <button
                  key={action}
                  type="button"
                  role="menuitem"
                  onClick={() => handleQuickAction(action)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary active:bg-secondary/80"
                >
                  <Icon size={18} className="text-muted-foreground" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <AppointmentDialog
        slot={bookingSlot}
        business={business}
        team={allMembers ?? []}
        onClose={() => setBookingSlot(null)}
      />

      <AppointmentDetail
        appointmentId={detail && !detailMinimized ? detail.id : null}
        business={business}
        onClose={() => {
          setDetail(null);
          setDetailMinimized(false);
        }}
        onMinimize={() => setDetailMinimized(true)}
      />

      {detail && detailMinimized ? (
        <button
          type="button"
          onClick={() => setDetailMinimized(false)}
          className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground shadow-lg transition-colors hover:bg-secondary"
        >
          {detail.label}
          <span className="text-xs text-muted-foreground">Reopen</span>
        </button>
      ) : null}
    </div>
  );
}
