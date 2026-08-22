import { Link } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import type { ReactNode } from "react";

import authPreview from "@/assets/auth-preview.jpg";

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
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
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

      {/* Right: centred showcase card (one for now, room for a set later) */}
      <div className="hidden items-center justify-center bg-secondary px-10 py-12 lg:flex">
        <figure className="surface-flat w-full max-w-md overflow-hidden text-center">
          <img
            src={authPreview}
            alt="Bright, modern salon reception area"
            width={1024}
            height={1280}
            loading="lazy"
            className="h-[420px] w-full rounded-t-[inherit] object-cover"
          />
          <figcaption className="space-y-1 px-6 py-5">
            <p className="text-sm font-semibold text-foreground">Built for service businesses</p>
            <p className="text-sm text-muted-foreground">
              Salons, spas, barbers and studios run their day on Bookly.
            </p>
          </figcaption>
        </figure>
      </div>
    </div>
  );
}

