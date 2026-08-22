import { Link } from "@tanstack/react-router";
import { Bell, CaretRight, MagnifyingGlass, RocketLaunch } from "@phosphor-icons/react";

export function TopBar({ notifications = 3 }: { notifications?: number }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-5">
      <Link to="/home" className="text-2xl font-bold tracking-tight text-foreground">
        bookly
      </Link>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <RocketLaunch size={18} weight="fill" />
          Continue setup
          <CaretRight size={14} weight="bold" />
        </button>

        <button
          type="button"
          aria-label="Search"
          className="flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary"
        >
          <MagnifyingGlass size={22} />
        </button>

        <button
          type="button"
          aria-label={`Notifications (${notifications})`}
          className="relative flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary"
        >
          <Bell size={22} />
          {notifications > 0 ? (
            <span className="absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold leading-5 text-destructive-foreground">
              {notifications}
            </span>
          ) : null}
        </button>
      </div>
    </header>
  );
}
