import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarCheck, CheckCircle } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

// Short enough to sit beside the preview at 32px, like Square's list.
const BUSINESS_FEATURES = [
  "Take online bookings",
  "Fill your calendar",
  "Check clients out fast",
  "Sell gift cards",
  "Send reminders",
  "Run promotions",
  "Track your stock",
  "Pay your team",
  "Build repeat business",
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
 * Split sign-in layout matching Square's (measured from their sign-in page): logo near the top
 * left edge; a full-width, left-aligned form on the left; on the right a tall, square-cornered
 * dark panel with a scrolling 32px feature list and a preview flush to its right edge, then a
 * 32px pitch heading and 18px text below.
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
    <div className="theme-fresha grid min-h-[100svh] bg-white lg:grid-cols-2">
      {/* Left */}
      <div className="flex flex-col lg:border-r lg:border-[#f0f0f0]">
        <Link to="/" className="ml-5 mt-8 flex w-fit items-center gap-2 sm:ml-6 lg:mt-11">
          <span className="flex size-[22px] items-center justify-center rounded-[4px] bg-[#101010] text-white">
            <CalendarCheck size={15} weight="bold" />
          </span>
          <span className="text-[22px] font-medium leading-7 tracking-[-0.01em] text-[#101010]">
            Bookly
          </span>
        </Link>

        <div className="flex flex-1 flex-col justify-center px-5 py-12 sm:px-10 lg:px-[72px]">
          <h1 className="text-[28px] font-bold leading-9 text-[#101010]">{title}</h1>
          {subtitle ? (
            <div className="mt-4 text-base leading-6 text-[#101010]">{subtitle}</div>
          ) : null}
          <div className="mt-4">{children}</div>
        </div>
      </div>

      {/* Right */}
      <div className="hidden flex-col px-16 pb-12 pt-6 lg:flex">
        <div className="relative h-[max(420px,calc(100svh-280px))] overflow-hidden bg-[#101010]">
          <FeatureReel features={features} />
          <PreviewCard />
        </div>
        <h2 className="mt-10 text-[32px] font-bold leading-10 text-[#101010]">{panelTitle}</h2>
        <p className="mt-4 max-w-[560px] text-lg leading-7 text-[#666]">{panelText}</p>
      </div>
    </div>
  );
}

const ROW = 43; // px per feature line (32px type)

/**
 * The list scrolls one line at a time and the line in focus turns white. It's drawn three times
 * over so the panel is always full; after each full lap it snaps back a lap (without animating)
 * so it loops seamlessly. Still for reduced motion.
 */
function FeatureReel({ features }: { features: string[] }) {
  const count = features.length;
  const [step, setStep] = useState({ pos: count + 1, animate: true });
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setStep((s) => ({ pos: s.pos + 1, animate: true })),
      2400,
    );
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (step.pos < 2 * count) return;
    const snap = window.setTimeout(() => setStep({ pos: step.pos - count, animate: false }), 750);
    return () => window.clearTimeout(snap);
  }, [step.pos, count]);

  const lines = [...features, ...features, ...features];
  return (
    <ul
      aria-label="What you can do with Bookly"
      className={cn(
        "absolute left-4 top-[45%]",
        step.animate && "transition-transform duration-700 ease-out",
      )}
      style={{ transform: `translateY(${-(step.pos + 0.5) * ROW}px)` }}
    >
      {lines.map((feature, index) => (
        <li
          key={index}
          aria-hidden={index < count || index >= 2 * count}
          className={cn(
            "whitespace-nowrap text-[32px] font-bold leading-[43px]",
            step.animate && "transition-colors duration-700",
            index === step.pos ? "text-white" : "text-white/20",
          )}
        >
          {feature}
        </li>
      ))}
    </ul>
  );
}

/**
 * Stands in for Square's photo: a calendar card flush against the panel's right edge, with a
 * small confirmation chip. Shown when there's room beside the list.
 */
function PreviewCard() {
  const rows = [
    { time: "09:00", name: "Ada · Blow dry", tone: "bg-[#dbe8ff] text-[#0b3d91]" },
    { time: "10:30", name: "Chi · Gel nails", tone: "bg-[#e6f5ea] text-[#1f6b35]" },
    { time: "12:00", name: "Tolu · Haircut", tone: "bg-[#fdf3e2] text-[#8a5300]" },
    { time: "14:15", name: "Ife · Lashes", tone: "bg-[#fdecef] text-[#9b1c3a]" },
  ];
  return (
    <div className="absolute right-0 top-[32%] hidden h-[196px] w-[245px] rounded-l-md bg-[#f7f7f7] p-3 min-[1400px]:block">
      <p className="text-[11px] font-medium text-[#101010]">Today</p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <li key={row.time} className="flex items-center gap-2">
            <span className="w-9 text-[10px] tabular-nums text-[#666]">{row.time}</span>
            <span
              className={cn("flex-1 truncate rounded px-2 py-1 text-[10px] font-medium", row.tone)}
            >
              {row.name}
            </span>
          </li>
        ))}
      </ul>
      <div className="absolute -bottom-3 right-3 w-[150px] rounded-md bg-white p-2 shadow-lg">
        <CheckCircle size={12} weight="fill" className="text-[#1f8a3e]" />
        <p className="mt-0.5 text-[8px] font-medium text-[#1f8a3e]">Booking confirmed</p>
        <p className="text-[11px] font-bold text-[#101010]">Gel nails, 10:30</p>
        <p className="text-[8px] text-[#666]">Reminder sent</p>
      </div>
    </div>
  );
}

// ── Form pieces, sized from Square's sign-in page ──
// Field: 64px tall, 6px corners, 1px #dadada border (2px #101010 when focused), a 16px medium
// label at the top with 16px text below. Buttons: 48px pills with 16px medium text; primary
// #101010, secondary #f0f0f0. The field sits 32px above Continue.

export const authPrimaryButton =
  "flex h-12 w-full items-center justify-center rounded-full bg-[#101010] text-base font-medium text-white transition-colors hover:bg-[#2b2b2b] disabled:bg-[#dadada] disabled:text-[#959595]";
export const authSecondaryButton =
  "flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#f0f0f0] text-base font-medium text-[#101010] transition-colors hover:bg-[#e4e4e4] disabled:opacity-60";

export function AuthField({
  label,
  ...input
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block h-16 rounded-[6px] border border-[#dadada] px-4 py-[7px] transition-colors hover:border-[#959595] focus-within:border-2 focus-within:border-[#101010] focus-within:px-[15px] focus-within:py-[6px]">
      <span className="block text-base font-medium leading-6 text-[#101010]">{label}</span>
      <input
        {...input}
        className="block h-6 w-full bg-transparent text-base leading-6 text-[#101010] outline-none"
      />
    </label>
  );
}

export function AuthDivider() {
  return (
    <div className="my-6 flex items-center gap-8">
      <span className="h-px flex-1 bg-[#f0f0f0]" />
      <span className="text-base text-[#101010]">or</span>
      <span className="h-px flex-1 bg-[#f0f0f0]" />
    </div>
  );
}
