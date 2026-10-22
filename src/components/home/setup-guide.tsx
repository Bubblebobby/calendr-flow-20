import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AddressBook,
  CalendarPlus,
  CaretDown,
  CaretRight,
  CheckCircle,
  Circle,
  Globe,
  Receipt,
  RocketLaunch,
  Tag,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";

import { useSetupGuide, type SetupItem, type SetupStepKey } from "@/lib/setup-guide";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/*
 * Square's setup guide, for Bookly. On Home: "Set up your business…", how many steps are done,
 * and a card for each step left (the first marked UP NEXT, with Dismiss). In the top bar:
 * "Continue setup" opens Square's progress card — a bar, the percentage and the checklist.
 * Card and type sizes are measured from Square's dashboard.
 */

const STEP_ICONS: Record<SetupStepKey, Icon> = {
  services: Tag,
  team: UsersThree,
  booking: Globe,
  clients: AddressBook,
  appointment: CalendarPlus,
  sale: Receipt,
};

const GREEN = "#1f8a3e";
const stepButton =
  "inline-flex h-9 items-center justify-center rounded-full px-5 text-[14px] font-medium transition-colors";

/** The guide on Home: nothing for staff, or once every step is done. */
export function SetupGuide({ className }: { className?: string }) {
  const guide = useSetupGuide();
  if (!guide.visible) return null;
  return (
    <section aria-labelledby="setup-guide-title" className={className}>
      <h2
        id="setup-guide-title"
        className="text-[28px] font-normal leading-9 tracking-[-0.5px] text-foreground sm:text-[36px] sm:leading-10"
      >
        Set up your business to start taking bookings
      </h2>
      <p className="mt-2 text-[14px] leading-5 text-muted-foreground">
        {guide.completed} of {guide.total} steps completed
      </p>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {guide.remaining.map((item, index) => (
          <li key={item.key}>
            <StepCard item={item} upNext={index === 0} onDismiss={() => guide.dismiss(item.key)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function StepCard({
  item,
  upNext,
  onDismiss,
}: {
  item: SetupItem;
  upNext: boolean;
  onDismiss: () => void;
}) {
  const StepIcon = STEP_ICONS[item.key];
  return (
    <div className="flex h-full flex-col rounded-xl border border-[#f0f0f0] bg-card p-6">
      {upNext ? (
        <p
          className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.06em]"
          style={{ color: GREEN }}
        >
          <StepIcon size={24} />
          Up next
        </p>
      ) : (
        <StepIcon size={24} className="text-foreground" />
      )}
      <h3 className="mt-3 text-base font-medium leading-6 text-foreground">{item.title}</h3>
      <p className="mt-2 text-[14px] leading-5 text-muted-foreground">{item.text}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <Link
          to={item.to}
          search={item.search as never}
          className={cn(
            stepButton,
            upNext
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-secondary text-foreground hover:bg-[#e5e5e5]",
          )}
        >
          {item.action}
        </Link>
        {upNext ? (
          <button
            type="button"
            onClick={onDismiss}
            className={cn(stepButton, "text-foreground hover:bg-secondary")}
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Top-bar "Continue setup": Square's sidebar progress card — a bar, "Complete your setup" with
 * the percentage, and the checklist (ticked steps greyed out).
 */
export function SetupMenu() {
  const guide = useSetupGuide();
  const [open, setOpen] = useState(false);
  if (!guide.visible) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="mr-1 hidden h-10 items-center gap-2 rounded-full bg-primary px-4 text-body font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:inline-flex">
        <RocketLaunch size={18} />
        Continue setup
        <CaretDown
          size={14}
          weight="bold"
          className={cn("transition-transform", open && "rotate-180")}
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] rounded-xl p-0">
        <div className="rounded-t-xl bg-[#f7f7f7] p-4">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={guide.percent}
            aria-label="Setup progress"
            className="h-1.5 overflow-hidden rounded-full bg-[#dadada]"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${guide.percent}%` }}
            />
          </div>
          <p className="mt-3 flex justify-between text-[14px] leading-5 text-muted-foreground">
            <span>Complete your setup</span>
            <span className="tabular-nums">{guide.percent}%</span>
          </p>
        </div>
        <ul className="p-2">
          {guide.items.map((item) => {
            const finished = item.done || item.dismissed;
            return (
              <li key={item.key}>
                <Link
                  to={item.to}
                  search={item.search as never}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 text-[14px] leading-5 transition-colors hover:bg-secondary"
                >
                  {finished ? (
                    <CheckCircle
                      size={18}
                      weight="fill"
                      className="shrink-0 text-muted-foreground"
                    />
                  ) : (
                    <Circle size={18} className="shrink-0 text-foreground" />
                  )}
                  <span className={finished ? "text-muted-foreground" : "text-foreground"}>
                    {item.title}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border p-2">
          <Link
            to="/home"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between rounded-lg px-2 py-2 text-[14px] font-medium transition-colors hover:bg-secondary"
          >
            Open setup guide
            <CaretRight size={14} weight="bold" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
