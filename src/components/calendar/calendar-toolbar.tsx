import { useMemo, useState } from "react";
import {
  ArrowClockwise,
  CalendarBlank,
  CalendarDots,
  CalendarPlus,
  CalendarX,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
  ClockCountdown,
  CreditCard,
  FadersHorizontal,
  Gear,
  MagnifyingGlass,
  Rows,
  SquaresFour,
  Tag,
  UserCircle,
  UsersFour,
  UsersThree,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  VIEW_LABELS,
  deriveInitials,
  memberName,
  type CalendarView,
  type TeamMember,
  type TeamSelection,
} from "./calendar-data";

export type AddAction = "appointment" | "group" | "blocked" | "sale" | "quick-payment";

const outline =
  "inline-flex h-9 items-center justify-center border border-input bg-card text-body font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-secondary";

export function IconButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(outline, "size-9 rounded-full", className)}
    >
      {children}
    </button>
  );
}

export function MemberAvatar({
  member,
  size = 32,
  className,
}: {
  member: TeamMember;
  size?: number;
  className?: string;
}) {
  const name = memberName(member);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-info ring-1 ring-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.3),
        lineHeight: 1.4,
        backgroundColor: "#ebf8fe",
      }}
    >
      {member.avatar_url ? (
        <img src={member.avatar_url} alt="" className="size-full object-cover" />
      ) : (
        member.initials || deriveInitials(name)
      )}
    </span>
  );
}

function rangeLabel(view: CalendarView, days: Date[], anchor: Date, locale: string) {
  if (view === "day") {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(anchor);
  }
  if (view === "month") {
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(anchor);
  }
  const first = days[0]!;
  const last = days[days.length - 1]!;
  const sameMonth = first.getMonth() === last.getMonth();
  const month = new Intl.DateTimeFormat(locale, { month: "short" });
  return sameMonth
    ? `${month.format(first)} ${first.getDate()} – ${last.getDate()}, ${last.getFullYear()}`
    : `${month.format(first)} ${first.getDate()} – ${month.format(last)} ${last.getDate()}, ${last.getFullYear()}`;
}

function TeamSelector({
  members,
  selection,
  currentUserId,
  onChange,
}: {
  members: TeamMember[];
  selection: TeamSelection;
  currentUserId: string | null | undefined;
  onChange: (selection: TeamSelection) => void;
}) {
  const [query, setQuery] = useState("");
  const me = members.find((member) => member.user_id && member.user_id === currentUserId);
  const pickedIds = useMemo(() => {
    if (selection === "all" || selection === "scheduled")
      return new Set(members.map((member) => member.id));
    if (selection === "me") return new Set(me ? [me.id] : []);
    return new Set(selection.split(",").filter(Boolean));
  }, [members, me, selection]);
  const visible = members.filter((member) =>
    memberName(member).toLowerCase().includes(query.trim().toLowerCase()),
  );
  const allPicked = members.length > 0 && members.every((member) => pickedIds.has(member.id));

  function toggle(id: string) {
    const next = new Set(pickedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (next.size === 0) return;
    onChange(next.size === members.length ? "all" : [...next].join(","));
  }

  const option = (value: TeamSelection, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-body text-foreground hover:bg-secondary",
        selection === value && "bg-accent/60 font-medium",
      )}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Team members"
          title="Team members"
          className={cn(outline, "size-9 rounded-full")}
        >
          <UsersThree size={18} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-72 rounded-xl p-2 shadow-lg">
        <label className="flex h-10 items-center gap-2 rounded-lg border-2 border-primary/70 px-3">
          <MagnifyingGlass size={16} className="text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="h-full flex-1 bg-transparent text-body outline-none placeholder:text-placeholder"
          />
        </label>
        <div className="mt-2 space-y-0.5">
          {option("scheduled", "Scheduled team", <CalendarDots size={18} />)}
          {option("all", "All team", <UsersFour size={18} />)}
          {me
            ? option("me", `${memberName(me)} (You)`, <MemberAvatar member={me} size={22} />)
            : null}
        </div>
        <div className="my-2 h-px bg-border" />
        <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-body font-semibold hover:bg-secondary">
          <Checkbox checked={allPicked} onCheckedChange={() => onChange("all")} />
          All team members
        </label>
        <div className="max-h-64 overflow-y-auto">
          {visible.map((member) => (
            <label
              key={member.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-body hover:bg-secondary"
            >
              <Checkbox
                checked={pickedIds.has(member.id)}
                onCheckedChange={() => toggle(member.id)}
              />
              <MemberAvatar member={member} size={24} />
              <span className="truncate">{memberName(member)}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const VIEW_ICONS: Record<CalendarView, React.ReactNode> = {
  day: <CalendarBlank size={18} />,
  "3day": <Rows size={18} className="rotate-90" />,
  week: <SquaresFour size={18} />,
  month: <CalendarDots size={18} />,
};

export function CalendarToolbar({
  view,
  anchor,
  days,
  locale,
  members,
  selection,
  currentUserId,
  onToday,
  onShift,
  onPickDate,
  onViewChange,
  onSelectionChange,
  onRefresh,
  onAdd,
  onFilters,
  onSettings,
  onWaitlist,
  locked = false,
  filtersOn = false,
}: {
  view: CalendarView;
  anchor: Date;
  days: Date[];
  locale: string;
  members: TeamMember[];
  selection: TeamSelection;
  currentUserId: string | null | undefined;
  onToday: () => void;
  onShift: (direction: 1 | -1) => void;
  onPickDate: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onSelectionChange: (selection: TeamSelection) => void;
  onRefresh: () => void;
  onAdd: (action: AddAction) => void;
  onFilters: () => void;
  onSettings: () => void;
  onWaitlist: () => void;
  /** "Select a time" mode: date navigation and view switching are disabled, like Fresha. */
  locked?: boolean;
  filtersOn?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const unit =
    view === "day" ? "day" : view === "month" ? "month" : view === "week" ? "week" : "3 days";

  return (
    <div className="flex min-h-[4.3rem] shrink-0 flex-wrap items-center gap-2 bg-toolbar px-4 py-4 sm:px-5">
      <button
        type="button"
        disabled={locked}
        onClick={onToday}
        className={cn(
          outline,
          "rounded-full px-4 disabled:pointer-events-none disabled:opacity-40",
        )}
      >
        Today
      </button>

      <div className={cn("flex items-center", locked && "pointer-events-none opacity-40")}>
        <button
          type="button"
          aria-label={`Previous ${unit}`}
          onClick={() => onShift(-1)}
          className={cn(outline, "w-9 rounded-l-full")}
        >
          <CaretLeft size={14} weight="bold" />
        </button>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(outline, "-mx-px min-w-[8.5rem] px-5 sm:min-w-[11rem]")}
            >
              {rangeLabel(view, days, anchor, locale)}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={anchor}
              weekStartsOn={1}
              onSelect={(date) => {
                if (date) onPickDate(date);
                setPickerOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <button
          type="button"
          aria-label={`Next ${unit}`}
          onClick={() => onShift(1)}
          className={cn(outline, "w-9 rounded-r-full")}
        >
          <CaretRight size={14} weight="bold" />
        </button>
      </div>

      <TeamSelector
        members={members}
        selection={selection}
        currentUserId={currentUserId}
        onChange={onSelectionChange}
      />
      <IconButton
        label="Visibility filters"
        onClick={onFilters}
        className={cn("relative", filtersOn && "border-primary text-primary")}
      >
        <FadersHorizontal size={18} />
        {filtersOn ? (
          <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background" />
        ) : null}
      </IconButton>

      <div className="ml-auto flex items-center gap-2">
        <IconButton label="Calendar settings" onClick={onSettings}>
          <Gear size={18} />
        </IconButton>
        <IconButton label="Waitlist" onClick={onWaitlist}>
          <ClockCountdown size={18} />
        </IconButton>

        <div className={cn("flex items-center", locked && "pointer-events-none opacity-40")}>
          <button
            type="button"
            aria-label="Refresh calendar"
            title="Refresh calendar"
            onClick={onRefresh}
            className={cn(outline, "w-9 rounded-l-full")}
          >
            <ArrowClockwise size={16} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(outline, "-ml-px gap-2 rounded-r-full pl-4 pr-3.5")}
              >
                {VIEW_LABELS[view]}
                <CaretDown size={13} weight="bold" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
              {(Object.keys(VIEW_LABELS) as CalendarView[]).map((key) => (
                <DropdownMenuItem
                  key={key}
                  onSelect={() => onViewChange(key)}
                  className={cn(
                    "gap-3 rounded-lg px-3 py-2 text-body",
                    view === key && "bg-accent/60",
                  )}
                >
                  {VIEW_ICONS[key]}
                  <span className="flex-1">{VIEW_LABELS[key]}</span>
                  {view === key ? <Check size={14} weight="bold" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-full bg-ink pl-5 pr-4 text-body font-medium text-ink-foreground transition-colors hover:bg-ink/90 data-[state=open]:bg-ink/90"
            >
              Add
              <CaretDown size={13} weight="bold" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
            {(
              [
                ["appointment", "Appointment", <CalendarPlus key="i" size={18} />],
                ["group", "Group appointment", <UserCircle key="i" size={18} />],
                ["blocked", "Blocked time", <CalendarX key="i" size={18} />],
                ["sale", "Sale", <Tag key="i" size={18} />],
                ["quick-payment", "Quick payment", <CreditCard key="i" size={18} />],
              ] as const
            ).map(([action, label, icon]) => (
              <DropdownMenuItem
                key={action}
                onSelect={() => onAdd(action)}
                className="gap-3 rounded-lg px-3 py-2 text-body"
              >
                {icon}
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
