import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarBlank,
  CaretDown,
  GearSix,
  Heart,
  MagnifyingGlass,
  SignOut,
  Star,
  Storefront,
  UserCircle,
  Wallet,
} from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import {
  categoryLabel,
  initialsOf,
  isCustomerAccount,
  useCustomer,
  type VenueCard,
} from "@/lib/customer";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const ACCOUNT_LINKS = [
  { to: "/account/appointments", label: "Appointments", icon: CalendarBlank },
  { to: "/account/wallet", label: "Wallet", icon: Wallet },
  { to: "/account/favourites", label: "Favourites", icon: Heart },
  { to: "/account/profile", label: "Profile", icon: UserCircle },
  { to: "/account/settings", label: "Settings", icon: GearSix },
] as const;

/** Top bar for everything customers see: logo, search, and sign-in or the account menu. */
export function CustomerHeader({ search = true }: { search?: boolean }) {
  const customer = useCustomer();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = isCustomerAccount(customer.data) ? customer.data : null;
  const businessLogin = customer.data && !me;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-3 px-4 sm:px-8">
        <Link to="/discover" className="text-[1.375rem] font-bold tracking-tight">
          bookly
        </Link>
        {search ? (
          <Link
            to="/discover"
            className="mx-auto hidden h-11 w-full max-w-md items-center gap-2 rounded-full border border-border px-4 text-body text-muted-foreground shadow-sm hover:bg-secondary md:flex"
          >
            <MagnifyingGlass size={18} /> Search salons and treatments
          </Link>
        ) : (
          <span className="flex-1" />
        )}
        <div className="ml-auto flex items-center gap-2">
          {customer.isLoading ? null : businessLogin ? (
            <a
              href="/dashboard"
              className="flex h-10 items-center gap-2 rounded-full border border-border px-4 text-body font-semibold hover:bg-secondary"
            >
              <Storefront size={18} /> Your business dashboard
            </a>
          ) : me ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Account menu"
                className="flex h-11 items-center gap-1 rounded-full border border-border pl-1 pr-3 hover:bg-secondary"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-caption font-semibold text-primary">
                  {initialsOf(me.full_name || me.email)}
                </span>
                <CaretDown size={14} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 rounded-xl p-2">
                <p className="truncate px-3 py-2 text-body font-semibold">
                  {me.full_name || me.email}
                </p>
                {ACCOUNT_LINKS.map(({ to, label, icon: Icon }) => (
                  <DropdownMenuItem key={to} asChild className="rounded-lg px-3 py-2.5 text-body">
                    <Link to={to}>
                      <Icon size={18} /> {label}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="rounded-lg px-3 py-2.5 text-body"
                  onSelect={async () => {
                    await supabase.auth.signOut();
                    queryClient.clear();
                    void navigate({ to: "/discover" });
                  }}
                >
                  <SignOut size={18} /> Log out
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  asChild
                  className="rounded-lg px-3 py-2.5 text-body text-muted-foreground"
                >
                  <a href="/">
                    <Storefront size={18} /> Bookly for business
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <a
                href="/"
                className="hidden h-10 items-center rounded-full px-4 text-body font-semibold hover:bg-secondary sm:flex"
              >
                For businesses
              </a>
              <Link
                to="/sign-in"
                search={{
                  next:
                    typeof window === "undefined"
                      ? undefined
                      : window.location.pathname + window.location.search,
                }}
                className="flex h-10 items-center rounded-full bg-ink px-5 text-body font-semibold text-ink-foreground hover:bg-ink/90"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** Rating as stars plus the number, e.g. "4.8 ★★★★★ (12)". */
export function Rating({
  value,
  count,
  size = 14,
}: {
  value: number | null;
  count: number;
  size?: number;
}) {
  if (!count || value == null)
    return <span className="text-caption text-muted-foreground">No reviews yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-body">
      <span className="font-semibold">{Number(value).toFixed(1)}</span>
      <Stars value={Number(value)} size={size} />
      <span className="text-muted-foreground">({count})</span>
    </span>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex text-[#f5a623]" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} weight={value >= n - 0.25 ? "fill" : "regular"} />
      ))}
    </span>
  );
}

const SWATCHES = [
  ["#e8f0ff", "#bcd3ff"],
  ["#ffe4ec", "#ffb3c8"],
  ["#dff5ec", "#9fdcc2"],
  ["#fff1d6", "#ffd38a"],
  ["#e0efff", "#a6cdfa"],
];

/** Salons don't have photos yet, so each gets a soft colour panel with its initials. */
export function SalonVisual({ name, className }: { name: string; className?: string }) {
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const [from, to] = SWATCHES[hash % SWATCHES.length]!;
  return (
    <div
      className={cn("flex items-center justify-center", className)}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      aria-hidden
    >
      <span className="text-[2.5rem] font-bold tracking-tight text-ink/70">{initialsOf(name)}</span>
    </div>
  );
}

export function VenueTile({ venue, action }: { venue: VenueCard; action?: React.ReactNode }) {
  const category = venue.categories?.[0];
  return (
    <div className="group relative">
      <Link to="/salon/$slug" params={{ slug: venue.slug }} className="block">
        <SalonVisual
          name={venue.name}
          className="aspect-[4/3] w-full rounded-xl transition-opacity group-hover:opacity-90"
        />
        <p className="mt-3 truncate text-heading font-semibold">{venue.name}</p>
        <Rating value={venue.rating} count={venue.review_count} size={12} />
        <p className="truncate text-caption text-muted-foreground">
          {[venue.area, category ? categoryLabel(category) : null].filter(Boolean).join(" · ")}
        </p>
        {venue.from_price ? (
          <p className="text-caption text-muted-foreground">
            From {formatMoney(Number(venue.from_price), venue.currency, venue.country)}
          </p>
        ) : null}
      </Link>
      {action ? <div className="absolute right-2 top-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-card px-6 py-10 text-center shadow-[inset_0_0_0_1px_var(--color-border)]">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent">
        <Icon size={28} className="text-primary" />
      </span>
      <p className="mt-4 text-heading font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-body text-muted-foreground">{text}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export const outlinePill =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-input bg-card px-4 text-body font-semibold hover:bg-secondary";
export const solidPill =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-ink px-5 text-body font-semibold text-ink-foreground hover:bg-ink/90 disabled:opacity-50";
