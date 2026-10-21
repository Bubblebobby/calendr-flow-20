import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";

import { cn } from "@/lib/utils";

const BUSINESS_FEATURES = [
  "Take online bookings",
  "Fill your calendar",
  "Check clients out fast",
  "Sell gift cards and packages",
  "Send reminders",
  "Track stock",
  "Pay your team",
  "See how you're doing",
];

type AuthShellProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Right-hand panel: rotating feature list, heading and line of text. */
  features?: string[];
  panelTitle?: ReactNode;
  panelText?: ReactNode;
};

/**
 * Split sign-in layout modelled on Square's: a plain left-aligned form on the left (no card),
 * and on the right a dark panel cycling through what the product does, with a short pitch below.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  features = BUSINESS_FEATURES,
  panelTitle = "See what Bookly can do",
  panelText = "Calendar, online booking, checkout, clients, stock, team pay and reports — everything your salon runs on, in one place.",
}: AuthShellProps) {
  return (
    <div className="theme-fresha grid min-h-[100svh] bg-background lg:grid-cols-2">
      {/* Left: logo top-left, form left-aligned in the middle. */}
      <div className="flex flex-col px-5 py-6 sm:px-10 lg:border-r lg:border-border lg:px-16">
        <Link to="/" className="flex w-fit items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-ink text-ink-foreground">
            <CalendarCheck className="size-4" />
          </span>
          <span className="text-heading font-semibold tracking-tight text-foreground">Bookly</span>
        </Link>

        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="w-full max-w-[420px]">
            <h1 className="text-[1.75rem] font-semibold leading-9 tracking-[-0.015em] text-foreground">
              {title}
            </h1>
            {subtitle ? <div className="mt-2 text-body text-foreground">{subtitle}</div> : null}
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>

      {/* Right: dark feature reel, then the pitch on white. */}
      <div className="hidden flex-col justify-center px-12 py-10 lg:flex xl:px-16">
        <div className="relative h-[380px] overflow-hidden rounded-md bg-[#101010]">
          <FeatureReel features={features} />
          <PreviewCard />
        </div>
        <h2 className="mt-8 text-[1.5rem] font-semibold leading-8 text-foreground">{panelTitle}</h2>
        <p className="mt-2 max-w-md text-body text-muted-foreground">{panelText}</p>
      </div>
    </div>
  );
}

const ROW = 40; // px per feature line

/** One feature at a time comes into focus as the list scrolls past (still for reduced motion). */
function FeatureReel({ features }: { features: string[] }) {
  const [active, setActive] = useState(1);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((i) => (i + 1) % features.length), 2400);
    return () => window.clearInterval(timer);
  }, [features.length]);

  return (
    <ul
      aria-label="What you can do with Bookly"
      className="absolute left-8 top-1/2 transition-transform duration-700 ease-out"
      style={{ transform: `translateY(${-(active + 0.5) * ROW}px)` }}
    >
      {features.map((feature, index) => (
        <li
          key={feature}
          className={cn(
            "whitespace-nowrap text-[1.25rem] font-medium leading-10 transition-colors duration-700",
            index === active ? "text-white" : "text-white/30",
          )}
        >
          {feature}
        </li>
      ))}
    </ul>
  );
}

/** A small, static picture of a day in the calendar (no screenshots needed). */
function PreviewCard() {
  const rows = [
    { time: "09:00", name: "Ada · Blow dry", tone: "bg-[#dbe8ff] text-[#0b3d91]" },
    { time: "10:30", name: "Chi · Gel nails", tone: "bg-[#e6f5ea] text-[#1f6b35]" },
    { time: "12:00", name: "Tolu · Haircut", tone: "bg-[#fdf3e2] text-[#8a5300]" },
  ];
  return (
    <div className="absolute right-4 top-1/2 w-44 -translate-y-1/2 rounded-lg bg-white p-2.5 shadow-xl">
      <p className="text-caption font-medium text-foreground">Today</p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <li key={row.time} className="flex items-center gap-2">
            <span className="w-9 text-[0.6875rem] text-muted-foreground tabular-nums">
              {row.time}
            </span>
            <span
              className={cn(
                "flex-1 truncate rounded px-2 py-1 text-[0.6875rem] font-medium",
                row.tone,
              )}
            >
              {row.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
