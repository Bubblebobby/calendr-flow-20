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
    <div className="theme-fresha grid min-h-screen bg-background lg:grid-cols-2">
      {/* Left: everything centre-aligned */}
      <div className="flex flex-col items-center px-6 py-10 lg:px-16">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <CalendarCheck className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">Bookly</span>
        </Link>

        <div className="flex w-full max-w-[440px] flex-1 flex-col justify-center text-center">
          <h1 className="text-[2.75rem] font-bold leading-[1.08] tracking-[-0.03em] text-foreground sm:text-[3.25rem]">
            {title}
          </h1>
          <p className="mt-4 text-lg font-medium leading-snug text-muted-foreground">{subtitle}</p>

          <div className="surface-flat mt-9 p-7 text-center">{children}</div>
        </div>
      </div>

      {/* Right: full-bleed salon image */}
      <div className="relative hidden overflow-hidden lg:flex">
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

