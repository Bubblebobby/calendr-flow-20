import { Link } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import type { ReactNode } from "react";

import salonInterior from "@/assets/salon-interior.jpg.asset.json";

type AuthShellProps = {
  title: ReactNode;
  subtitle: ReactNode;
  children: ReactNode;
};

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
          <h1 className="text-[2rem] font-bold leading-[1.08] tracking-[-0.03em] text-foreground sm:text-[2.5rem] lg:text-[3rem]">
            {title}
          </h1>
          <p className="mt-3 text-base font-medium leading-snug text-muted-foreground sm:text-lg">
            {subtitle}
          </p>

          <div className="surface-flat mt-7 p-5 text-center sm:p-7">{children}</div>
        </div>
      </div>

      {/* Right: full-bleed salon image */}
      <div className="relative hidden h-full overflow-hidden lg:flex">
        <img
          src={salonInterior.url}
          alt="Modern salon interior with arched mirrors and styling chairs"
          width={736}
          height={981}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}

