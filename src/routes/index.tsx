import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Store,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bookly — Booking software for salons, spas & studios" },
      {
        name: "description",
        content:
          "Simple, flexible and powerful booking software. Manage appointments, clients, catalog, sales and your team from one dashboard.",
      },
      { property: "og:title", content: "Bookly — Booking software for salons, spas & studios" },
      {
        property: "og:description",
        content: "Simple, flexible and powerful booking software for your business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const navLinks = ["Business types", "Features", "Pricing"];

const staff = [
  { name: "John", tone: "bg-slot-blue text-slot-blue-foreground" },
  { name: "Maria", tone: "bg-slot-amber text-slot-amber-foreground" },
  { name: "Wendy", tone: "bg-slot-pink text-slot-pink-foreground" },
  { name: "Amy", tone: "bg-slot-mint text-slot-mint-foreground" },
  { name: "Michael", tone: "bg-slot-blue text-slot-blue-foreground" },
];

type Slot = {
  column: number;
  start: number;
  span: number;
  time: string;
  client: string;
  service: string;
  tone: string;
};

const slots: Slot[] = [
  { column: 0, start: 0, span: 2, time: "8:00 - 9:00", client: "Brenda Massey", service: "Blow Dry", tone: "bg-slot-blue text-slot-blue-foreground" },
  { column: 1, start: 0, span: 2, time: "8:00 - 9:00", client: "Alena Geidt", service: "Hair cut", tone: "bg-slot-amber text-slot-amber-foreground" },
  { column: 3, start: 1, span: 2, time: "8:30 - 9:45", client: "James Herwitz", service: "Balinese Massage", tone: "bg-slot-mint text-slot-mint-foreground" },
  { column: 2, start: 2, span: 3, time: "9:00 - 10:15", client: "Phillip Dorwart", service: "Beard Grooming", tone: "bg-slot-pink text-slot-pink-foreground" },
  { column: 4, start: 2, span: 3, time: "9:00 - 10:15", client: "Megan White", service: "Hair cut", tone: "bg-slot-amber text-slot-amber-foreground" },
  { column: 3, start: 4, span: 3, time: "9:45 - 11:15", client: "Amy Jones", service: "Haircut and colour", tone: "bg-slot-blue text-slot-blue-foreground" },
  { column: 0, start: 4, span: 2, time: "10:00 - 10:35", client: "Craig Mango", service: "Yoga session", tone: "bg-slot-pink text-slot-pink-foreground" },
  { column: 1, start: 5, span: 2, time: "10:35 - 11:10", client: "Marilyn Carder", service: "Hair and Beard Cut", tone: "bg-slot-mint text-slot-mint-foreground" },
];

const hours = ["8:00 am", "9:00 am", "10:00 am", "11:00 am"];

function Landing() {
  return (
    <div
      className="min-h-screen overflow-x-hidden bg-background"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-6">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-ink-foreground">
              <CalendarCheck className="size-4" />
            </span>
            <span className="text-2xl font-extrabold tracking-tight text-foreground">bookly</span>
          </Link>
          <nav className="hidden items-center gap-8 lg:flex">
            {navLinks.map((label) => (
              <a
                key={label}
                href="#preview"
                className="text-base font-medium text-foreground/85 transition-colors hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="#preview"
            className="hidden items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted active:bg-secondary sm:inline-flex"
          >
            <Store className="size-4" />
            Marketplace
          </a>
          <Button
            asChild
            className="h-12 rounded-full bg-ink px-7 text-base font-semibold text-ink-foreground hover:bg-ink/90 active:bg-ink/80"
          >
            <Link to="/auth">Sign up</Link>
          </Button>
          <button
            type="button"
            className="hidden items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted active:bg-secondary md:inline-flex"
          >
            Menu
            <Menu className="size-4" />
          </button>
        </div>
      </header>

      <main>
        <section className="relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] halo-bg" aria-hidden />

          <div className="relative mx-auto w-full max-w-5xl px-6 pt-16 text-center sm:pt-24">
            <h1 className="text-[2.75rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-6xl lg:text-7xl">
              The #1 software for Salons and Spas
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-foreground/70 sm:text-xl">
              Simple, flexible and powerful booking software for your business.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button
                asChild
                className="h-14 rounded-full bg-ink px-8 text-base font-semibold text-ink-foreground hover:bg-ink/90 active:bg-ink/80"
              >
                <Link to="/auth">Get started now</Link>
              </Button>
              <a
                href="#preview"
                className="inline-flex h-14 items-center gap-3 rounded-full border border-border bg-card px-8 text-base font-semibold text-foreground transition-colors hover:bg-muted active:bg-secondary"
              >
                <Play className="size-4 fill-current" />
                Watch an overview
              </a>
            </div>
          </div>

          <div id="preview" className="relative mx-auto mt-16 w-full max-w-6xl px-6 pb-24">
            <div className="overflow-hidden rounded-t-[2rem] border border-border bg-card shadow-card">
              <DashboardPreview />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Bookly. Booking software for every business.</span>
          <Link to="/auth" className="font-medium text-foreground hover:underline">
            Sign in to your dashboard
          </Link>
        </div>
      </footer>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="min-w-0">
      {/* App top bar */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="text-lg font-extrabold tracking-tight text-foreground">bookly</span>
        <div className="flex items-center gap-4 text-muted-foreground">
          <Search className="size-4" />
          <span className="relative">
            <Bell className="size-4" />
            <span className="absolute -right-1.5 -top-1.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              3
            </span>
          </span>
          <MessageSquare className="size-4" />
          <span className="size-7 rounded-full bg-slot-pink" aria-hidden />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <Chip>Today</Chip>
        <div className="flex items-center gap-1 rounded-full border border-border px-2 py-1.5">
          <ChevronLeft className="size-4 text-muted-foreground" />
          <span className="px-2 text-sm font-medium text-foreground">Wednesday 21 Jun</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </div>
        <Chip icon={<ChevronDown className="size-3.5" />}>Trendy salon</Chip>
        <Chip icon={<ChevronDown className="size-3.5" />}>Scheduled team</Chip>
        <Chip icon={<SlidersHorizontal className="size-3.5" />} />
        <div className="ml-auto flex items-center gap-2">
          <Chip icon={<Settings2 className="size-3.5" />} />
          <Chip icon={<RefreshCw className="size-3.5" />} />
          <Chip icon={<ChevronDown className="size-3.5" />}>Day</Chip>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-ink-foreground">
            <Plus className="size-3.5" />
            Add
          </span>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex">
        <div className="w-14 shrink-0 border-r border-border pt-[68px] sm:w-16">
          {hours.map((hour) => (
            <div key={hour} className="h-24 pr-2 text-right text-[10px] font-medium text-muted-foreground">
              {hour}
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-5 border-b border-border">
            {staff.map((member) => (
              <div key={member.name} className="flex flex-col items-center gap-1.5 py-3">
                <span className={`size-8 rounded-full ${member.tone}`} aria-hidden />
                <span className="text-[11px] font-medium text-foreground">{member.name}</span>
              </div>
            ))}
          </div>

          <div className="relative grid grid-cols-5" style={{ height: `${4 * 96}px` }}>
            {staff.map((member) => (
              <div key={member.name} className="border-r border-border last:border-r-0">
                {hours.map((hour) => (
                  <div key={hour} className="h-24 border-b border-border/70" />
                ))}
              </div>
            ))}

            {slots.map((slot) => (
              <div
                key={`${slot.column}-${slot.start}-${slot.client}`}
                className={`absolute overflow-hidden rounded-md px-2 py-1.5 ${slot.tone}`}
                style={{
                  left: `calc(${slot.column} * 20% + 3px)`,
                  width: "calc(20% - 6px)",
                  top: `${slot.start * 48 + 3}px`,
                  height: `${slot.span * 48 - 6}px`,
                }}
              >
                <p className="truncate text-[10px] font-medium opacity-80">{slot.time}</p>
                <p className="truncate text-xs font-semibold">{slot.client}</p>
                <p className="truncate text-[10px] opacity-80">{slot.service}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ children, icon }: { children?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm font-medium text-foreground">
      {children}
      {icon}
    </span>
  );
}
