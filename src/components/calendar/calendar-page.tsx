import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, CalendarX, UserPlus, UsersThree, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/use-business";
import { useBusinessHours } from "@/lib/business-hours";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckoutScreen, type CheckoutStart } from "@/components/sales/checkout-screen";
import { AppointmentPanel, type PanelTarget, type RebookRequest } from "./appointment-panel";
import { BlockedTimeDrawer, useBlockedTimes, type BlockDraft } from "./blocked-time";
import {
  DEFAULT_PREFS,
  EMPTY_FILTERS,
  FiltersDrawer,
  SettingsDrawer,
  WaitlistDrawer,
  ZOOM_LEVELS,
  filtersActive,
  loadPrefs,
  savePrefs,
  type CalendarFilters,
  type CalendarPrefs,
} from "./calendar-drawers";
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

/** What a slot click does while the purple "Select a time" banner is showing. */
type PickMode =
  | { kind: "book" }
  | { kind: "group" }
  | { kind: "block" }
  | { kind: "reschedule"; appointmentId: string; itemIds: string[] }
  | { kind: "rebook"; request: RebookRequest };

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
  const { data: rawEvents = [] } = useCalendarEvents(business?.id, rangeStart, rangeEnd);
  const { data: rawBlocks = [] } = useBlockedTimes(business?.id, rangeStart, rangeEnd);
  const members = useMemo(
    () => selectMembers(allMembers ?? [], selection, currentUserId),
    [allMembers, selection, currentUserId],
  );

  const { data: services = [] } = useQuery({
    queryKey: ["calendar-services", business?.id],
    enabled: Boolean(business?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, duration_minutes, price")
        .eq("business_id", business!.id)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: serviceIdByItem = new Map<string, string>() } = useQuery({
    queryKey: ["calendar-item-services", business?.id, rangeStart.toISOString(), rawEvents.length],
    enabled: Boolean(business?.id && rawEvents.length),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_items")
        .select("id, service_id")
        .in(
          "id",
          rawEvents.map((event) => event.id),
        );
      if (error) throw error;
      return new Map((data ?? []).map((row) => [row.id, row.service_id as string]));
    },
  });

  // Calendar preferences and filters
  const [prefs, setPrefs] = useState<CalendarPrefs>(DEFAULT_PREFS);
  useEffect(() => setPrefs(loadPrefs()), []);
  const slotHeight = ZOOM_LEVELS[prefs.zoom]?.slot ?? 24;
  const [filters, setFilters] = useState<CalendarFilters>(EMPTY_FILTERS);
  const events = useMemo(() => {
    if (filters.types.length && !filters.types.includes("appointment")) return [];
    return rawEvents.filter(
      (event) =>
        (!filters.statuses.length || filters.statuses.includes(event.status)) &&
        (!filters.serviceIds.length ||
          filters.serviceIds.includes(serviceIdByItem.get(event.id) ?? "")),
    );
  }, [rawEvents, filters, serviceIdByItem]);
  const blocks = filters.types.length && !filters.types.includes("blocked") ? [] : rawBlocks;

  // Interaction state
  const [pick, setPick] = useState<PickMode | null>(null);
  const [quickAction, setQuickAction] = useState<{
    column: GridColumn;
    minutes: number;
    x: number;
    y: number;
  } | null>(null);
  const [panel, setPanel] = useState<PanelTarget | null>(null);
  const [panelMinimized, setPanelMinimized] = useState(false);
  const [blockDraft, setBlockDraft] = useState<BlockDraft | null>(null);
  const [hovered, setHovered] = useState<{
    appointment: CalendarEvent;
    member: TeamMember;
    x: number;
    y: number;
  } | null>(null);
  const [drawer, setDrawer] = useState<null | "filters" | "settings" | "waitlist">(null);
  const [checkout, setCheckout] = useState<CheckoutStart | null>(null);

  useEffect(() => {
    if (!pick) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setPick(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick]);

  function handleAdd(action: AddAction) {
    setQuickAction(null);
    if (action === "appointment") setPick({ kind: "book" });
    else if (action === "blocked") setPick({ kind: "block" });
    else if (action === "group") setPick({ kind: "group" });
    else
      toast(
        action === "sale"
          ? "New sales open from Sales → Daily sales → Add new"
          : "Quick payment arrives with Sales payments",
      );
  }

  function showAppointment(
    event: React.MouseEvent<HTMLElement>,
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
    setHovered({
      appointment,
      member,
      x,
      y: preferredTop >= 16 ? preferredTop : Math.min(window.innerHeight - 210, rect.bottom + 10),
    });
  }

  function openAppointment(appointment: CalendarEvent) {
    setHovered(null);
    setPanelMinimized(false);
    setPanel({ kind: "existing", appointmentId: appointment.appointmentId });
  }

  function openNew(
    member: TeamMember,
    date: Date,
    minutes: number,
    prefill?: { clientId: string | null; serviceIds: string[] },
  ) {
    setPanelMinimized(false);
    setPanel({ kind: "new", member, date, minutes, ...(prefill ? { prefill } : {}) });
  }

  function handleSlotClick(
    event: React.MouseEvent<HTMLElement>,
    column: GridColumn,
    minutes: number,
  ) {
    if (pick) {
      const mode = pick;
      setPick(null);
      if (mode.kind === "block")
        setBlockDraft({ member: column.member, date: column.date, minutes });
      else if (mode.kind === "reschedule")
        setPanel({
          kind: "existing",
          appointmentId: mode.appointmentId,
          moveTo: { member: column.member, date: column.date, minutes },
        });
      else if (mode.kind === "rebook")
        openNew(column.member, column.date, minutes, {
          clientId: mode.request.clientId,
          serviceIds: mode.request.serviceIds,
        });
      else {
        if (mode.kind === "group")
          toast("Saved as a regular appointment until group bookings get their database update");
        openNew(column.member, column.date, minutes);
      }
      return;
    }
    if (!prefs.quickActions) {
      openNew(column.member, column.date, minutes);
      return;
    }
    const popupWidth = 280;
    const popupHeight = 230;
    const x = Math.min(event.clientX - popupWidth / 2, window.innerWidth - popupWidth - 16);
    const y = Math.min(event.clientY - popupHeight - 16, window.innerHeight - popupHeight - 16);
    setQuickAction({ column, minutes, x: Math.max(16, x), y: y < 16 ? event.clientY + 24 : y });
  }

  function handleQuickAction(action: "appointment" | "group" | "block") {
    const slot = quickAction;
    setQuickAction(null);
    if (!slot) return;
    if (action === "block")
      setBlockDraft({ member: slot.column.member, date: slot.column.date, minutes: slot.minutes });
    else {
      if (action === "group")
        toast("Saved as a regular appointment until group bookings get their database update");
      openNew(slot.column.member, slot.column.date, slot.minutes);
    }
  }

  // Multi-member 3-day/week and month views drill into the day view, like Fresha.
  const openDay = (date: Date) => onNavigate({ view: "day", date });

  const currency = business?.currency;
  const formatPrice = (value: number | null) =>
    value === null || !currency
      ? null
      : new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);

  const pickTitle =
    pick?.kind === "block"
      ? "Select a time to block"
      : pick?.kind === "reschedule"
        ? "Select a time to reschedule"
        : "Select a time to book";
  const highlightIds = pick?.kind === "reschedule" ? new Set(pick.itemIds) : undefined;

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
            The calendar shows one column per active team member. Add your first team member to
            start scheduling appointments.
          </p>
          <Button asChild className="mt-2">
            <Link to="/team">Add team members</Link>
          </Button>
        </div>
      </div>
    );
  } else if (view === "month" && !pick) {
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
  } else if (view !== "day" && members.length > 1 && !pick) {
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
    // Picking always happens on a time grid: day view, or a single member's days.
    const gridDays =
      view === "day" || view === "month" || (pick && members.length > 1)
        ? [startOfDay(anchor)]
        : days;
    const asMembers = gridDays.length === 1;
    const columns: GridColumn[] = asMembers
      ? members.map((member) => ({
          key: `${member.id}-${gridDays[0]!.toDateString()}`,
          member,
          date: gridDays[0]!,
        }))
      : gridDays.map((date) => ({
          key: `${members[0]!.id}-${date.toDateString()}`,
          member: members[0]!,
          date,
        }));
    body = (
      <TimeGrid
        columns={columns}
        headerMode={asMembers ? "members" : "dates"}
        events={events}
        blocks={blocks}
        hours={hours}
        now={now}
        locale={locale}
        slotHeight={slotHeight}
        picking={Boolean(pick)}
        {...(highlightIds ? { highlightIds } : {})}
        selectedSlot={
          quickAction ? { columnKey: quickAction.column.key, minutes: quickAction.minutes } : null
        }
        onSlotClick={handleSlotClick}
        onEventHover={showAppointment}
        onEventLeave={() => setHovered(null)}
        onEventClick={openAppointment}
        onBlockClick={(block, member) =>
          setBlockDraft({ member, date: new Date(block.start_time), minutes: 0, existing: block })
        }
      />
    );
  }

  return (
    // While picking a time the calendar covers the app chrome, like Fresha.
    <div
      className={cn("flex min-h-0 flex-col bg-background", pick ? "fixed inset-0 z-40" : "h-full")}
    >
      {pick ? (
        <div className="relative flex h-16 shrink-0 items-center justify-center bg-primary px-16 text-primary-foreground">
          <span className="text-lg font-semibold">{pickTitle}</span>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setPick(null)}
            className="absolute right-5 flex size-9 items-center justify-center rounded-full hover:bg-white/15"
          >
            <X size={20} />
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
        locked={Boolean(pick)}
        filtersOn={filtersActive(filters)}
        onToday={() => onNavigate({ date: startOfDay(new Date()) })}
        onShift={(direction) => onNavigate({ date: shiftAnchor(view, anchor, direction) })}
        onPickDate={(date) => onNavigate({ date })}
        onViewChange={(next) => onNavigate({ view: next })}
        onSelectionChange={(team) => onNavigate({ team })}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
          queryClient.invalidateQueries({ queryKey: ["calendar-blocked-times"] });
        }}
        onAdd={handleAdd}
        onFilters={() => setDrawer("filters")}
        onSettings={() => setDrawer("settings")}
        onWaitlist={() => setDrawer("waitlist")}
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
              {formatDateTime(hovered.appointment.start)} -{" "}
              {formatDateTime(hovered.appointment.end)}
            </span>
            <span className="capitalize">{hovered.appointment.status.replace("_", " ")}</span>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-semibold text-primary">
                {deriveInitials(hovered.appointment.title)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-popover-foreground">
                  {hovered.appointment.title}
                </p>
                {hovered.appointment.email ? (
                  <p className="truncate text-sm text-muted-foreground">
                    {hovered.appointment.email}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-5 flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-popover-foreground">
                  {hovered.appointment.serviceName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {memberName(hovered.member)} ·{" "}
                  {Math.max(
                    0,
                    Math.round(
                      (hovered.appointment.end.getTime() - hovered.appointment.start.getTime()) /
                        60000,
                    ),
                  )}{" "}
                  min
                </p>
              </div>
              {formatPrice(hovered.appointment.price) ? (
                <p className="font-semibold text-popover-foreground">
                  {formatPrice(hovered.appointment.price)}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Empty-slot quick actions, styled like Fresha's popover */}
      {quickAction ? (
        <div
          role="presentation"
          className="fixed inset-0 z-50"
          onClick={() => setQuickAction(null)}
          onKeyDown={(event) => event.key === "Escape" && setQuickAction(null)}
        >
          <div
            role="menu"
            aria-label="Slot actions"
            className="absolute w-[280px] overflow-hidden rounded-xl border border-border bg-card shadow-xl"
            style={{ left: quickAction.x, top: quickAction.y }}
            onClick={(event) => event.stopPropagation()}
            ref={(node) => node?.focus()}
            tabIndex={-1}
          >
            <div className="flex items-center justify-between bg-secondary/80 px-5 py-3.5">
              <p className="text-[1.0625rem] font-semibold">{formatTime(quickAction.minutes)}</p>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setQuickAction(null)}
                className="flex size-7 items-center justify-center rounded-full hover:bg-card"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-2 py-2">
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
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem] hover:bg-secondary"
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setQuickAction(null);
                  setDrawer("settings");
                }}
                className="px-3 pb-2 pt-1 text-[0.875rem] font-medium text-primary hover:underline"
              >
                Quick actions settings
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AppointmentPanel
        target={panel}
        business={business}
        team={allMembers ?? []}
        currentUserId={currentUserId}
        minimized={panelMinimized}
        onClose={() => {
          setPanel(null);
          setPanelMinimized(false);
        }}
        onMinimize={() => setPanelMinimized(true)}
        onFocusDate={(date) => onNavigate({ date, view: view === "month" ? "day" : view })}
        onReschedule={(appointmentId, itemIds) => {
          setPanel(null);
          setPick({ kind: "reschedule", appointmentId, itemIds });
        }}
        onCheckout={(start) => {
          setPanel(null);
          setCheckout(start);
        }}
        onRebook={(request) => {
          setPanel(null);
          setPick({ kind: "rebook", request });
          toast(`Rebooking ${request.label}: pick a new time`);
        }}
      />

      {panel && panelMinimized ? (
        <button
          type="button"
          onClick={() => setPanelMinimized(false)}
          className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground shadow-lg transition-colors hover:bg-secondary"
        >
          {panel.kind === "new" ? "New appointment" : "Appointment"}
          <span className="text-xs text-muted-foreground">Reopen</span>
        </button>
      ) : null}

      <BlockedTimeDrawer
        draft={blockDraft}
        businessId={business?.id}
        team={allMembers ?? []}
        currentUserId={currentUserId}
        onClose={() => setBlockDraft(null)}
      />

      <FiltersDrawer
        open={drawer === "filters"}
        value={filters}
        services={services}
        onApply={setFilters}
        onClose={() => setDrawer(null)}
      />
      <SettingsDrawer
        open={drawer === "settings"}
        value={prefs}
        onApply={(next) => {
          setPrefs(next);
          savePrefs(next);
        }}
        onClose={() => setDrawer(null)}
      />
      <CheckoutScreen open={checkout !== null} start={checkout} onClose={() => setCheckout(null)} />

      <WaitlistDrawer
        open={drawer === "waitlist"}
        businessId={business?.id}
        services={services}
        currentUserId={currentUserId}
        onClose={() => setDrawer(null)}
      />
    </div>
  );
}
