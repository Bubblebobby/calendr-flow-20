import { Link } from "@tanstack/react-router";
import {
  AddressBook,
  CalendarPlus,
  CaretRight,
  CheckCircle,
  Globe,
  Receipt,
  RocketLaunch,
  Tag,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";

import { useSetupGuide, type SetupItem, type SetupStepKey } from "@/lib/setup-guide";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Square's setup guide, for Bookly, on its own page (/setup) that "Continue setup" opens:
 * the heading and step count, Square's progress card (bar and percentage), a card for each step
 * left (the first marked UP NEXT, with Dismiss) and the steps already done. Card and type sizes
 * are measured from Square's dashboard.
 */

const STEP_ICONS: Record<SetupStepKey, Icon> = {
  services: Tag,
  team: UsersThree,
  booking: Globe,
  clients: AddressBook,
  appointment: CalendarPlus,
  sale: Receipt,
};

const GREEN = "var(--success)";
const stepButton =
  "inline-flex h-9 items-center justify-center rounded-full px-5 text-[14px] font-medium transition-colors";

/** Top-bar "Continue setup": opens the setup page, until every step is done. */
export function SetupButton() {
  const guide = useSetupGuide();
  if (!guide.visible) return null;
  return (
    <Link
      to="/setup"
      className="mr-1 hidden h-10 items-center gap-2 rounded-full bg-primary px-4 text-body font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:inline-flex"
    >
      <RocketLaunch size={18} />
      Continue setup
      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[12px] tabular-nums">
        {guide.completed}/{guide.total}
      </span>
      <CaretRight size={14} weight="bold" />
    </Link>
  );
}

export function SetupPage() {
  const guide = useSetupGuide();
  const finished = guide.items.filter((item) => item.done || item.dismissed);

  return (
    <div className="min-h-full bg-surface">
      <div className="mx-auto w-full max-w-4xl p-4 sm:p-8">
        <h1 className="text-[28px] font-normal leading-9 text-foreground sm:text-[36px] sm:leading-10">
          Set up your business to start taking bookings
        </h1>

        {!guide.ready && !guide.isError ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[206px] rounded-xl" />
            ))}
          </div>
        ) : guide.isError ? (
          <Notice>The setup guide couldn't load. Please refresh and try again.</Notice>
        ) : !guide.isAdmin ? (
          <Notice>Only the owner and admins can set up the business.</Notice>
        ) : (
          <>
            <p className="mt-2 text-[14px] leading-5 text-muted-foreground">
              {guide.completed} of {guide.total} steps completed
            </p>

            {/* Square's progress card. */}
            <div className="mt-6 rounded-xl bg-muted p-4">
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

            {guide.remaining.length > 0 ? (
              <ul className="mt-6 grid gap-4 md:grid-cols-2">
                {guide.remaining.map((item, index) => (
                  <li key={item.key}>
                    <StepCard
                      item={item}
                      upNext={index === 0}
                      onDismiss={() => guide.dismiss(item.key)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-6 flex flex-col items-start gap-4 rounded-xl border border-border bg-card p-6">
                <CheckCircle size={32} weight="fill" style={{ color: GREEN }} />
                <div>
                  <h2 className="text-base font-medium leading-6 text-foreground">
                    You're all set up
                  </h2>
                  <p className="mt-1 text-[14px] leading-5 text-muted-foreground">
                    Your business is ready to take bookings.
                  </p>
                </div>
                <Link
                  to="/home"
                  className={cn(
                    stepButton,
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  Go to Home
                </Link>
              </div>
            )}

            {finished.length > 0 ? (
              <section className="mt-10">
                <h2 className="text-base font-medium leading-6 text-foreground">Completed</h2>
                <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
                  {finished.map((item) => (
                    <li key={item.key}>
                      <Link
                        to={item.to}
                        search={item.search as never}
                        className="flex items-center gap-3 px-6 py-4 transition-colors hover:bg-secondary/60"
                      >
                        <CheckCircle
                          size={20}
                          weight="fill"
                          className="shrink-0 text-muted-foreground"
                        />
                        <span className="flex-1 text-[14px] leading-5 text-muted-foreground">
                          {item.title}
                          {item.dismissed && !item.done ? " (dismissed)" : ""}
                        </span>
                        <CaretRight size={14} className="text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-6 text-[14px] leading-5 text-muted-foreground">
      {children}
    </div>
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
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-6">
      {upNext ? (
        <p
          className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wide"
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
