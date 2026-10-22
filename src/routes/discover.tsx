import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarBlank, MagnifyingGlass, MapPin, Storefront } from "@phosphor-icons/react";

import {
  CustomerHeader,
  EmptyState,
  outlinePill,
  SalonVisual,
  solidPill,
  VenueTile,
} from "@/components/customer/customer-ui";
import { FavouriteButton } from "@/components/customer/favourites";
import {
  bookAgainHref,
  DISCOVER_CATEGORIES,
  fetchVenues,
  formatInZone,
  isUpcoming,
  readRecent,
  useMyAppointments,
  useSessionUserId,
} from "@/lib/customer";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type Search = { q?: string | undefined; category?: string | undefined; city?: string | undefined };

export const Route = createFileRoute("/discover")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(typeof search["q"] === "string" && search["q"] ? { q: search["q"] } : {}),
    ...(typeof search["category"] === "string" && search["category"]
      ? { category: search["category"] }
      : {}),
    ...(typeof search["city"] === "string" && search["city"] ? { city: search["city"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Bookly — Book salons, barbers and spas near you" },
      {
        name: "description",
        content: "Discover salons, barbers, spas and beauty experts, and book online in seconds.",
      },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [q, setQ] = useState(search.q ?? "");
  const [city, setCity] = useState(search.city ?? "");
  useEffect(() => {
    setQ(search.q ?? "");
    setCity(search.city ?? "");
  }, [search.q, search.city]);

  const filtering = !!(search.q || search.category || search.city);
  const venues = useQuery({
    queryKey: ["venues", search.q ?? "", search.category ?? "", search.city ?? ""],
    queryFn: () => fetchVenues(search),
  });

  // Starts with the session, alongside the profile (business logins simply get none back).
  const sessionUser = useSessionUserId();
  const appointments = useMyAppointments(!!sessionUser.data);
  const list = appointments.data ?? [];
  const next = list.filter((a) => isUpcoming(a)).at(-1) ?? null;
  // One "book again" tile per salon, most recent visit first.
  const bookAgain = list
    .filter((a) => !isUpcoming(a) && a.status !== "cancelled" && bookAgainHref(a))
    .filter((a, index, all) => all.findIndex((b) => b.business.id === a.business.id) === index)
    .slice(0, 6);

  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => setRecentIds(readRecent()), []);
  const recent = useQuery({
    queryKey: ["venues", "ids", recentIds],
    enabled: recentIds.length > 0,
    queryFn: async () => {
      const rows = await fetchVenues({ ids: recentIds });
      return recentIds
        .map((id) => rows.find((r) => r.id === id))
        .filter((r): r is NonNullable<typeof r> => !!r);
    },
  });

  const setCategory = (category: string | undefined) =>
    void navigate({
      search: (prev) => ({ ...prev, category: prev.category === category ? undefined : category }),
    });

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader search={false} />

      <section className="bg-gradient-to-b from-[#f2f6ff] to-white px-4 pb-10 pt-12 sm:px-8 sm:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-[2.25rem] font-bold leading-tight sm:text-[3rem]">
            Book local selfcare services
          </h1>
          <p className="mt-3 text-heading text-muted-foreground">
            Discover salons, barbers, spas and beauty experts, and book online in seconds.
          </p>
        </div>
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            void navigate({
              search: (prev) => ({
                ...prev,
                q: q.trim() || undefined,
                city: city.trim() || undefined,
              }),
            });
          }}
          className="mx-auto mt-8 flex max-w-3xl flex-col gap-2 rounded-3xl bg-white p-2 shadow-[0_8px_30px_rgba(20,20,43,0.08)] sm:flex-row sm:items-center sm:rounded-full"
        >
          <label className="flex h-12 flex-1 items-center gap-2 rounded-full px-4">
            <MagnifyingGlass size={20} className="shrink-0 text-muted-foreground" />
            <span className="sr-only">Treatment or salon</span>
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="All treatments and salons"
              className="w-full bg-transparent text-body outline-none"
            />
          </label>
          <span className="hidden h-8 w-px bg-border sm:block" />
          <label className="flex h-12 flex-1 items-center gap-2 rounded-full px-4">
            <MapPin size={20} className="shrink-0 text-muted-foreground" />
            <span className="sr-only">City or area</span>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="City or area"
              className="w-full bg-transparent text-body outline-none"
            />
          </label>
          <button type="submit" className={cn(solidPill, "h-12 px-8")}>
            Search
          </button>
        </form>
        <div className="mx-auto mt-6 flex max-w-5xl gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center">
          {DISCOVER_CATEGORIES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={search.category === id}
              onClick={() => setCategory(id)}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-body",
                search.category === id
                  ? "border-ink bg-ink text-ink-foreground"
                  : "border-border bg-white hover:bg-secondary",
              )}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1200px] space-y-12 px-4 pb-20 sm:px-8">
        {!filtering && next ? (
          <section>
            <h2 className="text-title font-semibold">Your next appointment</h2>
            <Link
              to="/account/appointments"
              search={{ id: next.id }}
              className="mt-4 flex max-w-xl items-center gap-4 rounded-2xl bg-card p-3 shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-secondary/60"
            >
              <SalonVisual
                name={next.business.name}
                className="size-20 shrink-0 rounded-xl [&>span]:text-title"
              />
              <span className="min-w-0">
                <span className="block truncate text-heading font-semibold">
                  {next.business.name}
                </span>
                <span className="flex items-center gap-1 text-body text-muted-foreground">
                  <CalendarBlank size={16} />
                  {formatInZone(next.start, next.business.timezone, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="block truncate text-caption text-muted-foreground">
                  {next.items.map((i) => i.name).join(", ")}
                </span>
              </span>
            </Link>
          </section>
        ) : null}

        {!filtering && bookAgain.length ? (
          <Row title="Book again">
            {bookAgain.map((a) => (
              <div
                key={a.id}
                className="w-64 shrink-0 rounded-2xl bg-card p-3 shadow-[inset_0_0_0_1px_var(--color-border)]"
              >
                <SalonVisual
                  name={a.business.name}
                  className="aspect-[16/9] w-full rounded-xl [&>span]:text-title"
                />
                <p className="mt-3 truncate text-heading font-semibold">{a.business.name}</p>
                <p className="truncate text-caption text-muted-foreground">
                  {formatMoney(Number(a.total), a.business.currency, a.business.country)} ·{" "}
                  {a.items.map((i) => i.name).join(", ")}
                </p>
                <a href={bookAgainHref(a)!} className={cn(outlinePill, "mt-3 w-full")}>
                  Rebook
                </a>
              </div>
            ))}
          </Row>
        ) : null}

        {!filtering && recent.data?.length ? (
          <Row title="Recently viewed">
            {recent.data.map((venue) => (
              <div key={venue.id} className="w-64 shrink-0">
                <VenueTile venue={venue} />
              </div>
            ))}
          </Row>
        ) : null}

        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-title font-semibold">
              {!filtering
                ? "Salons on Bookly"
                : venues.isLoading
                  ? "Searching…"
                  : `${venues.data?.length ?? 0} ${venues.data?.length === 1 ? "salon" : "salons"} found`}
            </h2>
            {filtering ? (
              <button
                type="button"
                onClick={() => void navigate({ search: {} })}
                className="text-body font-semibold text-primary"
              >
                Clear search
              </button>
            ) : null}
          </div>
          {venues.isLoading ? (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-secondary" />
              ))}
            </div>
          ) : venues.isError ? (
            <p className="mt-6 text-body text-destructive">
              Couldn&apos;t load salons. Please refresh.
            </p>
          ) : venues.data?.length ? (
            <div className="mt-6 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {venues.data.map((venue) => (
                <VenueTile
                  key={venue.id}
                  venue={venue}
                  action={<FavouriteButton businessId={venue.id} compact />}
                />
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState
                icon={Storefront}
                title={filtering ? "No salons match your search" : "No salons yet"}
                text={
                  filtering
                    ? "Try another treatment, area or category."
                    : "Salons appear here once they turn on online booking."
                }
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-title font-semibold">{title}</h2>
      <div className="-mx-4 mt-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8">
        {children}
      </div>
    </section>
  );
}
