import { Link } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: ReactNode;
  subtitle: ReactNode;
  children: ReactNode;
};

const FEATURES = [
  "Take online bookings",
  "Fill your calendar",
  "Check clients out fast",
  "Sell gift cards and packages",
  "Track stock",
  "Pay your team",
  "See how you're doing",
];
const HIGHLIGHT = 1;

/** Shared split layout for the sign-in and onboarding screens. */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="theme-fresha grid min-h-[100svh] bg-background lg:h-[100svh] lg:grid-cols-2 lg:overflow-hidden">
      {/* Left: everything centre-aligned; scrolls only when it cannot fit */}
      <div className="flex flex-col items-center overflow-y-auto px-5 py-8 sm:px-6 lg:px-16">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <CalendarCheck className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">Bookly</span>
        </Link>

        <div className="flex w-full max-w-[440px] flex-1 flex-col justify-center py-8 text-center">
          <h1 className="text-[2rem] font-normal leading-[1.08] tracking-[-0.02em] text-foreground sm:text-[2.5rem] lg:text-[3rem]">
            {title}
          </h1>
          <p className="mt-3 text-base leading-snug text-muted-foreground sm:text-lg">{subtitle}</p>

          <div className="surface-flat mt-7 p-5 text-center sm:p-7">{children}</div>
        </div>
      </div>

      {/* Right: what Bookly does, on a dark panel (Square-style). */}
      <div className="relative hidden h-full flex-col justify-center overflow-hidden bg-[#101010] px-16 lg:flex">
        <ul aria-label="What you can do with Bookly" className="space-y-1">
          {FEATURES.map((feature, index) => (
            <li
              key={feature}
              className={
                index === HIGHLIGHT
                  ? "text-[1.75rem] font-medium leading-10 text-white"
                  : "text-[1.75rem] font-medium leading-10 text-white/35"
              }
            >
              {feature}
            </li>
          ))}
        </ul>
        <p className="mt-10 max-w-sm text-body text-white/60">
          Calendar, online booking, checkout, clients, stock, team and reports — in one place.
        </p>
      </div>
    </div>
  );
}
